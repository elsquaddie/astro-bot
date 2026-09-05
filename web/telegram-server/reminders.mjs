import { calculateEvents } from '../src/domain/astronomy.ts';
import { validPlace } from '../src/domain/storage.ts';
import { ApiError, telegramUser } from './auth.mjs';
import { dispatcherReady, dispatch } from './queue.mjs';
const DAY = 86400000;
export function canonicalPlan(input, now = Date.now()) {
  const place = input?.place;
  if (!validPlace(place) || place.name.length > 80) throw new ApiError(400, 'Выберите место наблюдения.');
  if (![0,15,60,1440].includes(input.leadMinutes)) throw new ApiError(400, 'Выберите время напоминания.');
  const id = input.eventId;
  if (typeof id !== 'string' || !/^[A-Za-z0-9-]+:\d{4}-\d{2}-\d{2}$/.test(id)) throw new ApiError(400, 'Выберите событие заново.');
  const peak = Date.parse(id.split(':')[1]);
  if (!Number.isFinite(peak) || peak < now - 2*DAY || peak > now + 367*DAY) throw new ApiError(400, 'Событие вне доступного периода.');
  const cleanPlace = { name: place.name, latitude: place.latitude, longitude: place.longitude, timezone: place.timezone };
  const from = new Date(Math.max(now, peak - 2*DAY));
  const event = calculateEvents(cleanPlace, from, 5).find(event => event.id === id);
  if (!event) throw new ApiError(400, 'Событие уже прошло или не видно из выбранного места.');
  const dueAt = Date.parse(event.best) - input.leadMinutes*60_000;
  if (dueAt < now) throw new ApiError(400, 'Это время напоминания уже прошло. Выберите другое.');
  return { plan: { event, place: cleanPlace, leadMinutes: input.leadMinutes }, dueAt,
    key: `${id}:${place.latitude.toFixed(4)}:${place.longitude.toFixed(4)}` };
}
export async function reminderApi(request, env, send = fetch) {
  if (!env.DB) throw new ApiError(503, 'Напоминания временно недоступны.');
  const user = await telegramUser(request.headers.get('X-Telegram-Init-Data'), env.BOT_TOKEN);
  if (request.method === 'GET') {
    const rows = (await env.DB.prepare("SELECT id,payload,status,due_at,last_error FROM reminders WHERE user_id=? AND event_key NOT LIKE 'delivery-test:%' ORDER BY CASE WHEN status IN ('pending','sending') THEN 0 ELSE 1 END, created_at DESC LIMIT 200").bind(user).all()).results;
    const deliveryTest = await env.DB.prepare("SELECT id,CASE WHEN status='pending' AND end_at <= ? THEN 'expired' ELSE status END AS status,due_at AS dueAt FROM reminders WHERE user_id=? AND event_key LIKE 'delivery-test:%' ORDER BY created_at DESC LIMIT 1").bind(Date.now(),user).first();
    return { deliveryTest, reminders: rows.map(row => ({ id: row.id, plan: JSON.parse(row.payload), status: row.status, dueAt: row.due_at })) };
  }
  if (request.method !== 'POST') throw new ApiError(405, 'Метод не поддерживается.');
  const raw = await request.text();
  if (raw.length > 4096) throw new ApiError(413, 'Слишком большой запрос.');
  let input; try { input = JSON.parse(raw); } catch { throw new ApiError(400, 'Некорректный запрос.'); }
  if (input?.action === 'cancel') {
    if (typeof input.id !== 'string' || input.id.length > 80) throw new ApiError(400, 'Выберите напоминание.');
    const row = await env.DB.prepare("UPDATE reminders SET status='cancelled' WHERE id=? AND user_id=? AND status IN ('pending','failed','cancelled') RETURNING id").bind(input.id,user).first();
    if (!row) throw new ApiError(409, 'Напоминание уже отправлено или обрабатывается.');
    return { ok: true };
  }
  if (input?.action === 'test') {
    const now = Date.now(), dueAt = now;
    // One pending test per user and no more than one new test per five minutes.
    const id = crypto.randomUUID(), key = `delivery-test:${Math.floor(now / 300_000)}`;
    const inserted = await env.DB.prepare("INSERT INTO reminders (id,user_id,event_key,payload,due_at,end_at,status,attempts,retry_at,created_at) SELECT ?,?,?,'{\"deliveryTest\":true}',?,?,'pending',0,?,? WHERE NOT EXISTS (SELECT 1 FROM reminders WHERE user_id=? AND event_key LIKE 'delivery-test:%' AND (status='sending' OR (status='pending' AND end_at > ?) OR created_at > ?)) ON CONFLICT(user_id,event_key) DO NOTHING RETURNING id")
      .bind(id,user,key,dueAt,now+1800000,dueAt,now,user,now,now-300000).first();
    if (!inserted) throw new ApiError(429, 'Проверка уже запущена. Дождитесь сообщения или попробуйте через пять минут.');
    await dispatch(env, now, send, false, id);
    const result = await env.DB.prepare('SELECT status FROM reminders WHERE id=? AND user_id=?').bind(id,user).first();
    return { id, status: result.status, dueAt };
  }
  if (!await dispatcherReady(env)) throw new ApiError(503, 'Доставка напоминаний временно недоступна. Попробуйте позже.');
  const { plan, key, dueAt } = canonicalPlan(input);
  const existing = await env.DB.prepare('SELECT id,status FROM reminders WHERE user_id=? AND event_key=?').bind(user,key).first();
  if (existing) {
    if (existing.status === 'sending' || existing.status === 'sent' || existing.status === 'uncertain')
      throw new ApiError(409, existing.status === 'sent' ? 'Напоминание уже отправлено.' : 'Напоминание уже обрабатывается.');
    const changed = await env.DB.prepare("UPDATE reminders SET payload=?,due_at=?,retry_at=?,end_at=?,status='pending',attempts=0,last_error=NULL WHERE id=? AND status NOT IN ('sending','sent','uncertain') AND (status='pending' OR (SELECT count(*) FROM reminders WHERE user_id=? AND status IN ('pending','sending')) < 100) RETURNING id")
      .bind(JSON.stringify(plan),dueAt,dueAt,Date.parse(plan.event.end),existing.id,user).first();
    if (!changed) throw new ApiError(409, 'Напоминание уже обрабатывается.');
    return { id: existing.id, plan, status: 'pending', dueAt };
  }
  const id = crypto.randomUUID();
  const inserted = await env.DB.prepare("INSERT INTO reminders (id,user_id,event_key,payload,due_at,end_at,status,attempts,retry_at,created_at) SELECT ?,?,?,?,?,?,'pending',0,?,? WHERE (SELECT count(*) FROM reminders WHERE user_id=? AND status IN ('pending','sending')) < 100 ON CONFLICT(user_id,event_key) DO NOTHING RETURNING id")
    .bind(id,user,key,JSON.stringify(plan),dueAt,Date.parse(plan.event.end),dueAt,Date.now(),user).first();
  if (!inserted) throw new ApiError(409, 'Не удалось добавить напоминание. Обновите список: возможно, оно уже добавлено или достигнут лимит 100.');
  return { id, plan, status: 'pending', dueAt };
}

import { viewingGuide } from '../src/domain/viewing.ts';

export async function dispatcherReady(env, now = Date.now()) {
  if (!env.DB || !env.BOT_TOKEN || !env.REMINDER_DISPATCH_SECRET) return false;
  const state = await env.DB.prepare("SELECT value FROM service_state WHERE key = 'dispatch_schedule'").first();
  return !!state && now - state.value < 3_600_000;
}
export function reminderMessage(plan) {
  if (plan.deliveryTest === true) return 'Проверка напоминаний: сообщение дошло 🌙\n\nТак бот будет напоминать о событиях. Приложение можно закрывать.';
  const { event, place } = plan;
  const date = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: place.timezone, hourCycle: 'h23' }).format(new Date(event.best));
  const guide = viewingGuide(event);
  return `${event.title}\n${place.name}, ${date}\n\n${guide.compass}\n${guide.elevation}${guide.target ? '\n'+guide.target : ''}\n\n${event.equipmentDetail}`;
}
export async function dispatch(env, now = Date.now(), send = fetch, scheduled = false, onlyId = null) {
  if (!env.DB || !env.BOT_TOKEN) throw new Error('Dispatcher is not configured');
  const db = env.DB;
  if (!onlyId) await db.prepare("INSERT INTO service_state (key,value) VALUES ('dispatch',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(now).run();
  if (scheduled) await db.prepare("INSERT INTO service_state (key,value) VALUES ('dispatch_schedule',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(now).run();
  // A crashed in-flight attempt may already have reached Telegram. Do not resend it blindly.
  if (!onlyId) await db.prepare("UPDATE reminders SET status='uncertain', last_error='delivery_unknown' WHERE status='sending' AND claimed_at < ?").bind(now - 300_000).run();
  if (!onlyId) await db.prepare("UPDATE reminders SET status='expired', last_error='observation_ended' WHERE status='pending' AND end_at <= ?").bind(now).run();
  const rows = (await db.prepare("SELECT id FROM reminders WHERE status='pending' AND retry_at <= ? AND (? IS NULL OR id=?) ORDER BY retry_at LIMIT 25").bind(now,onlyId,onlyId).all()).results;
  let sent = 0, failed = 0;
  const deadline = Date.now() + 120_000;
  for (const candidate of rows) {
    if (Date.now() >= deadline) break;
    const row = await db.prepare("UPDATE reminders SET status='sending', claimed_at=?, attempts=attempts+1 WHERE id=? AND status='pending' AND retry_at <= ? AND end_at > ? RETURNING *").bind(now, candidate.id, now, now).first();
    if (!row) continue;
    let reply;
    try {
      const response = await send(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(12_000),
        body: JSON.stringify({ chat_id: row.user_id, text: reminderMessage(JSON.parse(row.payload)),
          reply_markup: { inline_keyboard: [[{ text: 'Открыть', web_app: { url: env.TELEGRAM_APP_URL } }]] } }),
      });
      reply = await response.json();
    } catch {
      await db.prepare("UPDATE reminders SET status='uncertain',last_error='delivery_unknown' WHERE id=?").bind(row.id).run(); failed++; continue;
    }
    if (reply.ok && Number.isSafeInteger(reply.result?.message_id)) {
      await db.prepare("UPDATE reminders SET status='sent',sent_at=?,message_id=? WHERE id=?").bind(now,reply.result.message_id,row.id).run(); sent++;
    } else {
      const retry = !onlyId && (reply.error_code === 429 || reply.error_code >= 500) && row.attempts < 3;
      const delay = Math.max(60, Math.min(3600, Number(reply.parameters?.retry_after) || 300));
      await db.prepare('UPDATE reminders SET status=?,retry_at=?,last_error=? WHERE id=?')
        .bind(retry ? 'pending' : 'failed', now + delay*1000, `telegram_${Number(reply.error_code)||'rejected'}`, row.id).run(); failed++;
    }
  }
  return { ok: true, sent, failed };
}

import { ApiError } from './auth.mjs';
import { reminderApi } from './reminders.mjs';
import { dispatch, dispatcherReady } from './queue.mjs';
const json = (value, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });

export function telegramReply(update, appUrl) {
  const message = update?.message;
  if (!message || message.chat?.type !== 'private' || !Number.isSafeInteger(message.chat.id) || message.chat.id <= 0) return { ok: true };
  if (!/^\/(start|help)(?:@[a-zA-Z0-9_]+)?(?:\s|$)/.test(message.text ?? '')) return { ok: true };
  return {
    method: 'sendMessage', chat_id: message.chat.id,
    text: 'Привет! Здесь можно узнать, какие астрономические события видны рядом с вами.\n\nОткройте приложение и выберите город — покажем, когда и куда смотреть и нужен ли телескоп. Нажмите «Напомнить мне» у события, чтобы получить сообщение сюда, в личку.',
    reply_markup: { inline_keyboard: [[{ text: 'Открыть', web_app: { url: appUrl } }]] },
  };
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/health') return json({ ok: true, app: 'smotri-na-nebo', telegram: 'mini-app', reminders: await dispatcherReady(env) });
    if (url.pathname === '/api/reminders') {
      try { return json(await reminderApi(request, env)); }
      catch (error) { return json({ error: error instanceof ApiError ? error.message : 'Не удалось сохранить напоминание.' }, error instanceof ApiError ? error.status : 500); }
    }
    if (url.pathname === '/api/reminders/dispatch') {
      if (request.method !== 'POST' || !env.REMINDER_DISPATCH_SECRET || request.headers.get('Authorization') !== `Bearer ${env.REMINDER_DISPATCH_SECRET}`)
        return json({ error: 'unauthorized' }, 401);
      try { return json(await dispatch(env)); } catch { return json({ error: 'dispatch_failed' }, 500); }
    }
    if (url.pathname === '/api/telegram/webhook') {
      if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
      if (!env.TELEGRAM_WEBHOOK_SECRET || request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== env.TELEGRAM_WEBHOOK_SECRET)
        return json({ error: 'unauthorized' }, 401);
      if (Number(request.headers.get('content-length') ?? 0) > 65536) return json({ error: 'too_large' }, 413);
      const body = await request.text();
      if (body.length > 65536) return json({ error: 'too_large' }, 413);
      let update;
      try { update = JSON.parse(body); } catch { return json({ error: 'invalid_json' }, 400); }
      const appUrl = env.TELEGRAM_APP_URL;
      if (!appUrl || !appUrl.startsWith('https://')) return json({ error: 'not_configured' }, 503);
      // Telegram executes this Bot API method as the webhook response. No bot token
      // enters the browser, and only the originating private chat is used.
      return json(telegramReply(update, appUrl));
    }
    if (url.pathname.startsWith('/api/')) return json({ error: 'not_found' }, 404);
    return env.ASSETS.fetch(request);
  },
};

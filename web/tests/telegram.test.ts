import assert from 'node:assert/strict';
import { test } from 'node:test';
// @ts-expect-error Plain ESM worker has no generated declarations.
import worker, { telegramReply } from '../telegram-server/index.mjs';
const appUrl = 'https://sky.example/';
test('start reply only targets originating private chat with fixed app URL', () => {
  const reply = telegramReply({ message: { chat: { type: 'private', id: 123 }, text: '/start payload' } }, appUrl);
  assert.equal(reply.chat_id, 123);
  assert.equal(reply.reply_markup.inline_keyboard[0][0].text, 'Открыть');
  assert.match(reply.text, /Привет!/);
  assert.match(reply.text, /в личку/);
  assert.equal(reply.reply_markup.inline_keyboard[0][0].web_app.url, appUrl);
  assert.deepEqual(telegramReply({ message: { chat: { type: 'group', id: -123 }, text: '/start' } }, appUrl), { ok: true });
  assert.deepEqual(telegramReply({ message: { chat: { type: 'private', id: 123 }, text: 'hello' } }, appUrl), { ok: true });
});
test('webhook rejects missing secret and invalid payload before responding', async () => {
  const env = { TELEGRAM_WEBHOOK_SECRET: 'test-secret', TELEGRAM_APP_URL: appUrl };
  assert.equal((await worker.fetch(new Request('https://sky.example/api/telegram/webhook', { method: 'POST', body: '{}' }), env)).status, 401);
  const request = (body: string) => new Request('https://sky.example/api/telegram/webhook', { method: 'POST', body,
    headers: { 'X-Telegram-Bot-Api-Secret-Token': 'test-secret' } });
  assert.equal((await worker.fetch(request('{'), env)).status, 400);
  assert.equal((await worker.fetch(request('x'.repeat(65537)), env)).status, 413);
  assert.equal((await worker.fetch(request('{}'), env)).status, 200);
});

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const bytes = new TextEncoder();
async function hmac(key, value) {
  const imported = await crypto.subtle.importKey('raw', typeof key === 'string' ? bytes.encode(key) : key,
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', imported, bytes.encode(value));
}
export async function telegramUser(initData, token, now = Date.now()) {
  if (!token) throw new ApiError(503, 'Напоминания временно недоступны.');
  if (typeof initData !== 'string' || initData.length > 8192) throw new ApiError(401, 'Откройте приложение через Telegram.');
  const params = new URLSearchParams(initData);
  const seen = new Set();
  for (const [key] of params) { if (seen.has(key)) throw new ApiError(401, 'Некорректные данные Telegram.'); seen.add(key); }
  const hash = params.get('hash'); params.delete('hash');
  if (!hash || !/^[a-f0-9]{64}$/.test(hash)) throw new ApiError(401, 'Откройте приложение через Telegram.');
  const check = [...params].sort(([a],[b]) => a.localeCompare(b)).map(([key,value]) => `${key}=${value}`).join('\n');
  const digest = new Uint8Array(await hmac(await hmac('WebAppData', token), check));
  const expected = [...digest].map(value => value.toString(16).padStart(2, '0')).join('');
  let difference = 0;
  for (let i = 0; i < 64; i++) difference |= expected.charCodeAt(i) ^ hash.charCodeAt(i);
  if (difference) throw new ApiError(401, 'Не удалось подтвердить вход через Telegram.');
  const stamp = Number(params.get('auth_date')) * 1000;
  if (!stamp || stamp > now + 60_000 || now - stamp > 3_600_000) throw new ApiError(401, 'Переоткройте приложение в Telegram и попробуйте ещё раз.');
  let user;
  try { user = JSON.parse(params.get('user')); } catch { /* handled below */ }
  if (!Number.isSafeInteger(user?.id) || user.id <= 0 || user.is_bot) throw new ApiError(401, 'Не удалось подтвердить пользователя.');
  return user.id;
}

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { SavedPlan } from '../domain/types';

export interface RemoteReminder { id: string; plan: SavedPlan; status: string; dueAt: number }
export const reminderStatus: Record<string, string> = {
  pending: 'Бот напомнит в личку', sending: 'Отправляем', sent: 'Напоминание отправлено',
  failed: 'Не удалось отправить. Проверьте, что бот не заблокирован.',
  uncertain: 'Не удалось проверить доставку. Повторно не отправляем.', expired: 'Время наблюдения прошло', cancelled: 'Напоминание отменено',
};
async function api(method: string, body?: unknown) {
  const auth = window.Telegram?.WebApp?.initData;
  if (!auth) throw new Error('Откройте приложение через @astro_timing_bot.');
  let response;
  try { response = await fetch('/api/reminders', { method, headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': auth },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20_000) }); }
  catch { throw new Error('Нет связи с сервером. Проверьте список перед повторной попыткой.'); }
  const result = await response.json();
  if (!response.ok) throw new Error(response.status === 401 ? 'Закройте приложение и откройте заново через бота.' : result.error || 'Не удалось подключиться.');
  return result;
}
export async function allowMessages() {
  const app = window.Telegram?.WebApp;
  if (!app?.initData) throw new Error('Откройте приложение через бота.');
  if (!app.isVersionAtLeast('6.9')) throw new Error('Обновите Telegram, чтобы подключить напоминания.');
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Разрешение не получено. Попробуйте ещё раз.')), 30_000);
    app.requestWriteAccess(granted => { clearTimeout(timer); granted ? resolve() : reject(new Error('Разрешите боту писать вам, чтобы получать напоминания.')); });
  });
}
interface Service {
  inside: boolean; available: boolean; records: RemoteReminder[]; error: string; loading: boolean;
  refresh(): Promise<void>; save(plan: SavedPlan): Promise<RemoteReminder>; cancel(id: string): Promise<void>;
}
const Context = createContext<Service | null>(null);
export const useReminders = () => useContext(Context);
export function RemindersProvider({ inside, children }: { inside: boolean; children: ReactNode }) {
  const [records, setRecords] = useState<RemoteReminder[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [available, setAvailable] = useState(false);
  async function refresh() {
    if (!window.Telegram?.WebApp?.initData) return;
    setLoading(true);
    try { const [data, health] = await Promise.all([api('GET'), fetch('/api/health', { signal: AbortSignal.timeout(15_000) }).then(r => { if (!r.ok) throw new Error('Сервис временно недоступен.'); return r.json(); })]); setRecords(data.reminders); setAvailable(health.reminders === true); setError(''); }
    catch (e) { setAvailable(false); setError((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    if (!inside) return;
    void refresh();
    const update = () => { if (document.visibilityState === 'visible') void refresh(); };
    window.addEventListener('telegram-ready', update); window.addEventListener('online', update);
    document.addEventListener('visibilitychange', update);
    return () => { window.removeEventListener('telegram-ready', update); window.removeEventListener('online', update); document.removeEventListener('visibilitychange', update); };
  }, [inside]);
  async function save(plan: SavedPlan) {
    const item = await api('POST', { eventId: plan.event.id, place: plan.place, leadMinutes: plan.leadMinutes });
    setRecords(current => [item, ...current.filter(r => r.id !== item.id)]); setError(''); return item;
  }
  async function cancel(id: string) {
    await api('POST', { action: 'cancel', id });
    setRecords(current => current.map(r => r.id === id ? { ...r, status: 'cancelled' } : r));
  }
  return <Context.Provider value={{ inside, available, records, error, loading, refresh, save, cancel }}>{children}</Context.Provider>;
}

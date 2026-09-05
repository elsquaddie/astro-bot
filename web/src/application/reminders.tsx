import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react';
import { dateLabel, timeLabel } from '../domain/format';
import type { SavedPlan } from '../domain/types';

export interface RemoteReminder { id: string; plan: SavedPlan; status: string; dueAt: number }
export function reminderWhen(record: Pick<RemoteReminder, 'dueAt' | 'plan'>) {
  const at = new Date(record.dueAt).toISOString();
  return `${dateLabel(at, record.plan.place)} в ${timeLabel(at, record.plan.place)}`;
}
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
interface DeliveryTest { id: string; status: string; dueAt: number }
interface Service {
  deliveryTest: DeliveryTest | null; testDelivery(): Promise<void>;
  inside: boolean; available: boolean; records: RemoteReminder[]; error: string; loading: boolean;
  refresh(): Promise<void>; save(plan: SavedPlan): Promise<RemoteReminder>; cancel(id: string): Promise<void>;
}
export const RemindersContext = createContext<Service | null>(null);
export const useReminders = () => useContext(RemindersContext);
export function RemindersProvider({ inside, children }: { inside: boolean; children: ReactNode }) {
  const revision = useRef(0);
  const testRevision = useRef(0);
  const [deliveryTest, setDeliveryTest] = useState<DeliveryTest | null>(null);
  const [records, setRecords] = useState<RemoteReminder[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [available, setAvailable] = useState(false);
  async function refresh() {
    if (!window.Telegram?.WebApp?.initData) return;
    const current = ++revision.current, testVersion = testRevision.current; setLoading(true);
    try { const [data, health] = await Promise.all([api('GET'), fetch('/api/health', { signal: AbortSignal.timeout(15_000) }).then(r => { if (!r.ok) throw new Error('Сервис временно недоступен.'); return r.json(); })]); if (current !== revision.current) return; setRecords(data.reminders); if (testVersion === testRevision.current) setDeliveryTest(data.deliveryTest ?? null); setAvailable(health.reminders === true); setError(''); }
    catch (e) { if (current !== revision.current) return; setAvailable(false); setError((e as Error).message); }
    finally { if (current === revision.current) setLoading(false); }
  }
  useEffect(() => {
    if (!inside) return;
    void refresh();
    const update = () => { if (document.visibilityState === 'visible') void refresh(); };
    window.addEventListener('telegram-ready', update); window.addEventListener('online', update);
    document.addEventListener('visibilitychange', update);
    return () => { window.removeEventListener('telegram-ready', update); window.removeEventListener('online', update); document.removeEventListener('visibilitychange', update); };
  }, [inside]);
  async function testDelivery() { const test = await api('POST', { action: 'test' }); testRevision.current++; setDeliveryTest(test); if (test.status !== 'sent') throw new Error(test.status === 'pending' ? 'Telegram пока не принял сообщение. Попробуйте позже.' : reminderStatus[test.status] ?? 'Не удалось подтвердить отправку.'); }
  async function save(plan: SavedPlan) {
    const item = await api('POST', { eventId: plan.event.id, place: plan.place, leadMinutes: plan.leadMinutes });
    revision.current++; setLoading(false);
    setRecords(current => [item, ...current.filter(r => r.id !== item.id)]); setError(''); return item;
  }
  async function cancel(id: string) {
    await api('POST', { action: 'cancel', id });
    revision.current++; setLoading(false);
    setRecords(current => current.map(r => r.id === id ? { ...r, status: 'cancelled' } : r));
  }
  return <RemindersContext.Provider value={{ inside, available, deliveryTest, testDelivery, records, error, loading, refresh, save, cancel }}>{children}</RemindersContext.Provider>;
}

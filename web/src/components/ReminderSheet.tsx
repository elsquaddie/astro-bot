import { useState } from 'react';
import { Bell, BookmarkSimple, Check } from '@phosphor-icons/react';
import { BottomSheet } from '../platform';
import { dateLabel, timeLabel } from '../domain/format';
import { planKey } from '../domain/storage';
import type { SavedPlan } from '../domain/types';
import { allowMessages, reminderStatus, useReminders } from '../application/reminders';
import { Button } from './Button';

export function ReminderSheet({ plan, saved, onClose, onSave }: {
  plan: SavedPlan | null; saved: boolean; onClose: () => void; onSave: (plan: SavedPlan) => boolean;
}) {
  const service = useReminders();
  return <BottomSheet open={!!plan} onOpenChange={v => { if (!v) onClose(); }} title={service?.inside ? 'Напомнить мне' : 'Сохранить событие'}
    description={plan?.event.title} snap={0.84}>
    {plan && <ReminderContent key={planKey(plan)} plan={plan} saved={saved} onSave={onSave} onClose={onClose} />}
  </BottomSheet>;
}
function ReminderContent({ plan, saved, onSave, onClose }: {
  plan: SavedPlan; saved: boolean; onSave: (p: SavedPlan) => boolean; onClose: () => void;
}) {
  const service = useReminders();
  const record = service?.records.find(r => planKey(r.plan) === planKey(plan));
  const [lead, setLead] = useState(record?.plan.leadMinutes ?? plan.leadMinutes);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const expired = Date.parse(plan.event.end) <= Date.now();
  const locked = record && ['sending', 'sent', 'uncertain', 'expired'].includes(record.status);
  const due = Date.parse(plan.event.best) - lead*60_000;
  async function save() {
    setStatus('');
    if (service?.inside) {
      setBusy(true);
      try {
        await allowMessages();
        const result = await service.save({ ...plan, leadMinutes: lead });
        onSave(result.plan);
        setStatus('Готово. Бот напишет вам в личку. Приложение можно закрыть.');
      } catch (e) { setStatus((e as Error).message); }
      finally { setBusy(false); }
    } else {
      if (Date.parse(plan.event.end) <= Date.now()) { setStatus('Событие уже прошло.'); return; }
      setStatus(onSave(plan) ? 'Сохранено на этом устройстве.' : 'Не удалось сохранить. Проверьте настройки браузера.');
    }
  }
  async function cancel() {
    if (!service || !record) return;
    setBusy(true);
    try { await service.cancel(record.id); setStatus('Напоминание отменено.'); }
    catch (e) { setStatus((e as Error).message); }
    finally { setBusy(false); }
  }
  return <div className="sky-sheet">
    <div className="reminder-date"><span>{dateLabel(plan.event.best, plan.place, true)}</span>
      <strong>{timeLabel(plan.event.best, plan.place)}</strong><small>{plan.place.name}</small></div>
    {service?.inside ? <>
      {!service.available && <p className="sky-note" role="status">{service.loading ? 'Проверяем доставку…' : 'Подключение напоминаний сейчас недоступно. Обновите список в «Сохранено» и попробуйте ещё раз.'}</p>}
      {record && <p className="sky-note" role="status">{reminderStatus[record.status] ?? record.status}</p>}
      {!locked && service.available && <><fieldset className="reminder-lead" disabled={busy}><legend>Когда написать?</legend>
        {([[1440,'За день'],[60,'За час'],[15,'За 15 минут'],[0,'К началу']] as const).map(([value,label]) =>
          <label key={value}><input type="radio" name="lead" value={value} checked={lead === value} onChange={() => setLead(value)}
            disabled={Date.parse(plan.event.best)-value*60_000 < Date.now()} /><span>{label}</span></label>)}
      </fieldset><p className="sky-note">Бот напишет в личку. Сообщение может прийти с задержкой в несколько минут.</p>
      <p className="sky-note">Для напоминания сохраним на сервере выбранное место и событие.</p>
      <Button onClick={save} disabled={busy || expired || due < Date.now()}><Bell size={20} />{busy ? 'Подключаем…' : record?.status === 'pending' ? 'Сохранить время' : 'Напомнить в Telegram'}</Button></>}
      {record?.status === 'pending' && <Button variant="ghost" onClick={cancel} disabled={busy}>Отменить напоминание</Button>}
    </> : <>
      <p className="sky-note">Чтобы бот напомнил в личку, откройте приложение в Telegram.</p>
      <a className="telegram-open" href="https://t.me/astro_timing_bot" target="_blank" rel="noreferrer">Открыть бота</a>
      <Button onClick={save} disabled={expired || saved}>{saved ? <Check size={20} /> : <BookmarkSimple size={20} />}{saved ? 'Сохранено на устройстве' : 'Сохранить на устройстве'}</Button>
    </>}
    {expired && <p className="sky-error">Событие уже прошло.</p>}
    {status && <p className="sky-note" role="status">{status}</p>}
    <Button variant="ghost" onClick={onClose}>Закрыть</Button>
  </div>;
}

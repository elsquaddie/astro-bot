import { useEffect, useState } from 'react';
import { Bell, BookmarkSimple, Check } from '@phosphor-icons/react';
import { BottomSheet } from '../platform';
import { dateLabel, timeLabel } from '../domain/format';
import { planKey } from '../domain/storage';
import type { SavedPlan } from '../domain/types';
import { allowMessages, reminderStatus, reminderWhen, useReminders } from '../application/reminders';
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
export function ReminderContent({ plan, saved, onSave, onClose }: {
  plan: SavedPlan; saved: boolean; onSave: (p: SavedPlan) => boolean; onClose: () => void;
}) {
  const service = useReminders();
  const record = service?.records.find(r => planKey(r.plan) === planKey(plan));
  const [lead, setLead] = useState(record?.plan.leadMinutes ?? plan.leadMinutes);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [busy, setBusy] = useState<'save' | 'test' | 'cancel' | null>(null);
  useEffect(() => { if (!editing && record) setLead(record.plan.leadMinutes); }, [record?.plan.leadMinutes, editing]);
  const expired = Date.parse(plan.event.end) <= Date.now();
  const pending = record?.status === 'pending';
  const locked = !!record && ['sending', 'sent', 'uncertain', 'expired'].includes(record.status);
  const due = Date.parse(plan.event.best) - lead*60_000;
  const unchanged = pending && lead === record.plan.leadMinutes;
  async function save() {
    if (!service?.inside || busy || unchanged) return;
    setBusy('save'); setMessage('');
    try {
      await allowMessages();
      const result = await service.save({ ...plan, leadMinutes: lead });
      onSave(result.plan); setEditing(false);
    } catch (e) { setMessage((e as Error).message); }
    finally { setBusy(null); }
  }
  async function testDelivery() {
    if (!service || busy) return;
    setBusy('test'); setTestMessage('');
    try { await allowMessages(); await service.testDelivery(); setTestMessage('Тестовое сообщение отправлено. Посмотрите личку с ботом.'); }
    catch (e) { setTestMessage((e as Error).message); }
    finally { setBusy(null); }
  }
  async function cancel() {
    if (!service || !record || busy) return;
    setBusy('cancel'); setMessage('');
    try { await service.cancel(record.id); setEditing(false); setMessage('Напоминание отменено. Событие осталось в «Сохранено».'); }
    catch (e) { setMessage((e as Error).message); }
    finally { setBusy(null); }
  }
  return <div className="sky-sheet">
    <div className="reminder-date"><span>{dateLabel(plan.event.best, plan.place, true)}</span>
      <strong>{timeLabel(plan.event.best, plan.place)}</strong><small>{plan.place.name}</small></div>
    {service?.inside ? <>
      {pending && <div className="reminder-confirmation" role="status"><Check size={28} />
        <strong>Напоминание сохранено</strong>
        <p>{service.available ? `Бот напомнит ${reminderWhen(record)}.` : `Выбрано: ${reminderWhen(record)}. Автоматическая доставка сейчас приостановлена.`}</p>
        <p className="sky-note">Событие в разделе «Сохранено». Повторно нажимать не нужно.</p>
      </div>}
      {!pending && record && <p className="sky-note" role="status">{reminderStatus[record.status]}</p>}
      {service.loading && <p className="sky-note" role="status">Обновляем напоминания…</p>}
      {!service.loading && !service.available && <p className="sky-error" role="status">Автоматическая доставка пока недоступна. Событие можно сохранить без напоминания.</p>}
      {!locked && service.available && (!pending || editing) && <>
        <fieldset className="reminder-lead" disabled={!!busy || service.loading}><legend>Когда написать?</legend>
          {([[1440,'За день'],[60,'За час'],[15,'За 15 минут'],[0,'К началу']] as const).map(([value,label]) =>
            <label key={value}><input type="radio" name="lead" value={value} checked={lead === value} onChange={() => { setEditing(true); setLead(value); }}
              disabled={Date.parse(plan.event.best)-value*60_000 < Date.now()} /><span>{label}</span></label>)}
        </fieldset>
        <p className="sky-note">Напишем в личку. Для этого сохраним на сервере выбранное место и событие.</p>
        <Button onClick={save} disabled={!!busy || service.loading || expired || due < Date.now() || unchanged}><Bell size={20} />{busy === 'save' ? 'Сохраняем…' : pending ? 'Изменить напоминание' : 'Напомнить в Telegram'}</Button>
        {pending && <Button variant="ghost" onClick={() => setEditing(false)} disabled={!!busy}>Оставить прежнее время</Button>}
      </>}
      {pending && !editing && service.available && <Button variant="secondary" onClick={() => setEditing(true)} disabled={!!busy}>Изменить время</Button>}
      {message && <p className="sky-note" role="status">{message}</p>}
      {pending && <Button variant="ghost" onClick={cancel} disabled={!!busy}>{busy === 'cancel' ? 'Отменяем…' : 'Отменить напоминание'}</Button>}
      {!saved && !pending && <Button variant="secondary" onClick={() => setMessage(onSave(plan) ? 'Событие в разделе «Сохранено». Без напоминания.' : 'Не удалось сохранить событие.')}><BookmarkSimple size={20} />Сохранить без напоминания</Button>}
      {saved && !pending && <p className="sky-note">Событие сохранено на устройстве.</p>}
      <div className="delivery-test">
        <p className="sky-note">Отправить тестовое сообщение в личку прямо сейчас?</p>
        <Button variant="secondary" onClick={testDelivery} disabled={!!busy}>{busy === 'test' ? 'Отправляем…' : 'Отправить тестовое сообщение'}</Button>
        {testMessage && <p className="sky-note" role="status">{testMessage}</p>}
      </div>
    </> : <>
      <p className="sky-note">Чтобы бот напомнил в личку, откройте приложение в Telegram.</p>
      <a className="telegram-open" href="https://t.me/astro_timing_bot" target="_blank" rel="noreferrer">Открыть бота</a>
      <Button onClick={() => setMessage(onSave(plan) ? 'Событие в разделе «Сохранено».' : 'Не удалось сохранить событие.')} disabled={expired || saved}>{saved ? <Check size={20} /> : <BookmarkSimple size={20} />}{saved ? 'Событие сохранено' : 'Сохранить событие'}</Button>
      {message && <p className="sky-note" role="status">{message}</p>}
    </>}
    {expired && <p className="sky-error">Событие уже прошло.</p>}
    <Button variant="ghost" onClick={onClose}>Готово</Button>
  </div>;
}

import { useState } from 'react';
import { BookmarkSimple, CalendarPlus, Check } from '@phosphor-icons/react';
import { BottomSheet } from '../mobile';
import { dateLabel, timeLabel } from '../domain/format';
import { downloadCalendar } from '../domain/calendar';
import type { SavedPlan } from '../domain/types';
import { Button } from './Button';

export function ReminderSheet({ plan, saved, onClose, onSave }: {
  plan: SavedPlan | null; saved: boolean; onClose: () => void; onSave: (plan: SavedPlan) => boolean;
}) {
  return <BottomSheet open={!!plan} onOpenChange={v => { if (!v) onClose(); }} title="Напомнить о событии"
    description={plan ? plan.event.title : ''} snap={0.8}>
    {plan && <ReminderContent key={`${plan.event.id}:${plan.place.latitude}:${plan.place.longitude}`}
      plan={plan} saved={saved} onSave={onSave} onClose={onClose} />}
  </BottomSheet>;
}
function ReminderContent({ plan, saved, onSave, onClose }: {
  plan: SavedPlan; saved: boolean; onSave: (p: SavedPlan) => boolean; onClose: () => void;
}) {
  const available = (lead: number) => Date.parse(plan.event.best) - lead * 60_000 > Date.now();
  const [lead, setLead] = useState(available(plan.leadMinutes) ? plan.leadMinutes : 0);
  const [status, setStatus] = useState('');
  const expired = !available(0);
  const current = { ...plan, leadMinutes: lead };
  function save() {
    setStatus(onSave(current) ? 'План сохранён на этом устройстве.' : 'Не удалось сохранить в браузере. Можно скачать файл календаря.');
  }
  function download() {
    if (!available(lead)) { setStatus('Это время уже прошло. Выберите другое событие.'); return; }
    downloadCalendar(current);
    setStatus('После скачивания откройте файл в календаре и проверьте напоминание. Если загрузка не началась, откройте приложение в обычном браузере.');
  }
  return <div className="sky-sheet">
    <div className="reminder-date"><span>{dateLabel(plan.event.best, plan.place, true)}</span>
      <strong>{timeLabel(plan.event.best, plan.place)}</strong><small>{plan.place.name} · {plan.place.timezone}</small></div>
    <fieldset className="lead-time"><legend>Когда напомнить</legend>
      {[[1440, 'За сутки'], [60, 'За час'], [15, 'За 15 минут'], [0, 'В это время']].map(([value, label]) =>
        <button type="button" key={value} role="radio" aria-checked={lead === value} disabled={!available(Number(value))}
          onClick={() => setLead(Number(value))}>{label}</button>)}
    </fieldset>
    <p className="sky-note">Сохранение здесь не отправляет уведомления. Добавьте событие в свой календарь — в файл включено напоминание. Telegram пока не подключён.</p>
    {expired && <p className="sky-error">Время наблюдения уже прошло.</p>}
    <Button onClick={download} disabled={expired}><CalendarPlus size={22} weight="light" />Скачать для календаря</Button>
    <Button variant="secondary" onClick={save} disabled={expired}>
      {saved ? <Check size={20} /> : <BookmarkSimple size={20} weight="light" />}{saved ? 'Обновить сохранённое' : 'Сохранить событие'}
    </Button>
    <p className="sky-note" role="status">{status}</p>
    <Button variant="ghost" onClick={onClose}>Закрыть</Button>
  </div>;
}

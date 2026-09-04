import { useState } from 'react';
import { BookmarkSimple, Check } from '@phosphor-icons/react';
import { BottomSheet } from '../platform';
import { dateLabel, timeLabel } from '../domain/format';
import type { SavedPlan } from '../domain/types';
import { Button } from './Button';

export function ReminderSheet({ plan, saved, onClose, onSave }: {
  plan: SavedPlan | null; saved: boolean; onClose: () => void; onSave: (plan: SavedPlan) => boolean;
}) {
  return <BottomSheet open={!!plan} onOpenChange={v => { if (!v) onClose(); }} title="Сохранить событие"
    description={plan?.event.title} snap={0.64}>
    {plan && <ReminderContent key={`${plan.event.id}:${plan.place.latitude}:${plan.place.longitude}`}
      plan={plan} saved={saved} onSave={onSave} onClose={onClose} />}
  </BottomSheet>;
}
function ReminderContent({ plan, saved, onSave, onClose }: {
  plan: SavedPlan; saved: boolean; onSave: (p: SavedPlan) => boolean; onClose: () => void;
}) {
  const [status, setStatus] = useState('');
  const expired = Date.parse(plan.event.end) <= Date.now();
  function save() {
    if (Date.parse(plan.event.end) <= Date.now()) { setStatus('Событие уже прошло.'); return; }
    setStatus(onSave(plan) ? 'Сохранено на этом устройстве.' : 'Не удалось сохранить. Проверьте настройки браузера.');
  }
  return <div className="sky-sheet">
    <div className="reminder-date"><span>{dateLabel(plan.event.best, plan.place, true)}</span>
      <strong>{timeLabel(plan.event.best, plan.place)}</strong><small>{plan.place.name}</small></div>
    <p className="sky-note">Уведомления пока не подключены. Событие останется в «Сохранено».</p>
    {expired && <p className="sky-error">Событие уже прошло.</p>}
    <Button onClick={save} disabled={expired || saved}>
      {saved ? <Check size={20} /> : <BookmarkSimple size={20} weight="light" />}{saved ? 'Сохранено' : 'Сохранить событие'}
    </Button>
    {status && <p className="sky-note" role="status">{status}</p>}
    <Button variant="ghost" onClick={onClose}>Закрыть</Button>
  </div>;
}

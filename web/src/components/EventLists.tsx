import type { ReactNode } from 'react';
import { BookmarkSimple, CaretRight } from '@phosphor-icons/react';
import { MobileScroll } from '../platform';
import { dateLabel, timeLabel } from '../domain/format';
import { planKey } from '../domain/storage';
import type { Place, SavedPlan, SkyEvent } from '../domain/types';
import { useReminders, reminderStatus } from '../application/reminders';
import { Button } from './Button';

export function EventList({ events, place, loading, error, onRetry, onSelect, onLocate }: {
  events: SkyEvent[]; place: Place | null; loading: boolean; error: string; onRetry: () => void;
  onSelect: (event: SkyEvent) => void; onLocate: () => void;
}) {
  return <MobileScroll className="list-scroll"><section className="event-list">
    <h1>События</h1><p className="list-intro">{place ? `${place.name}, на год вперёд` : 'Выберите город.'}</p>
    {!place && <Button onClick={onLocate}>Выбрать город</Button>}
    {loading && <p role="status">Рассчитываем события…</p>}
    {error && <div role="alert"><p className="sky-error">{error}</p><Button variant="secondary" onClick={onRetry}>Повторить расчёт</Button></div>}
    {place && !loading && !error && events.length === 0 && <p className="sky-note">Для этого места нет видимых событий в каталоге.</p>}
    {place && events.map((event, i) => {
      const month = new Intl.DateTimeFormat('ru', { month: 'long', year: 'numeric', timeZone: place.timezone }).format(new Date(event.start));
      const previous = i ? new Intl.DateTimeFormat('ru', { month: 'long', year: 'numeric', timeZone: place.timezone }).format(new Date(events[i - 1].start)) : '';
      return <div key={event.id}>{month !== previous && <h2 className="month-label">{month}</h2>}
        <button className="event-row" onClick={() => onSelect(event)}><span>
          <small>{dateLabel(event.start, place)}, с {timeLabel(event.start, place)}</small>
          <strong>{event.title}</strong><em>{event.equipment}</em>
        </span><CaretRight size={20} weight="light" /></button></div>;
    })}
    {place && <p className="sky-note coverage-note">Погода и засветка не учтены.</p>}
  </section></MobileScroll>;
}
export function SavedList({ plans, onSelect, onBrowse, tools }: {
  plans: SavedPlan[]; onSelect: (plan: SavedPlan) => void; onBrowse: () => void; tools?: ReactNode;
}) {
  const service = useReminders();
  const remote = service?.inside ? service.records : [];
  const combined = [...remote.map(r => r.plan), ...plans.filter(p => !remote.some(r => planKey(r.plan) === planKey(p)))];
  return <MobileScroll className="list-scroll"><section className="event-list">
    <h1>Сохранено</h1>
    {service?.inside && <><Button variant="ghost" onClick={() => void service.refresh()} disabled={service.loading}>{service.loading ? 'Загружаем…' : 'Обновить напоминания'}</Button>
      {service.error && <p className="sky-error" role="alert">{service.error}</p>}</>}
    {combined.length === 0 ? <div className="empty-saved"><BookmarkSimple size={42} weight="thin" />
      <h2>Пока пусто</h2><p>Здесь появятся выбранные события.</p><Button variant="secondary" onClick={onBrowse}>Посмотреть события</Button>
    </div> : [...combined].sort((a, b) => a.event.best.localeCompare(b.event.best)).map(plan =>
      <button className="event-row" key={planKey(plan)} onClick={() => onSelect(plan)}><span>
        <small>{dateLabel(plan.event.best, plan.place, true)}, {timeLabel(plan.event.best, plan.place)}</small>
        <strong>{plan.event.title}</strong><em>{plan.place.name}{Date.parse(plan.event.end) < Date.now() ? ', прошло' : ''}</em><em>{reminderStatus[remote.find(r => planKey(r.plan) === planKey(plan))?.status ?? ''] ?? 'На этом устройстве, без напоминания'}</em>
      </span><CaretRight size={20} weight="light" /></button>)}
    {tools}
  </section></MobileScroll>;
}

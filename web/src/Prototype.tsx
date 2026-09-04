import { useState } from 'react';
import { Bell, BookmarkSimple, CalendarStar, CaretRight, MapPin, Planet } from '@phosphor-icons/react';
import '@fontsource/manrope/latin-300.css';
import '@fontsource/manrope/cyrillic-300.css';
import '@fontsource/manrope/latin-400.css';
import '@fontsource/manrope/cyrillic-400.css';
import '@fontsource/manrope/latin-500.css';
import '@fontsource/manrope/cyrillic-500.css';
import { useEvents } from './useEvents';
import { dateLabel, timeLabel } from './domain/format';
import { loadPlans, PLACE_KEY, planKey, PLANS_KEY, readPlace, saveLocal } from './domain/storage';
import type { Place, SavedPlan, SkyEvent } from './domain/types';
import { Button } from './components/Button';
import { LocationSheet } from './components/LocationSheet';
import { ReminderSheet } from './components/ReminderSheet';
import { EventDetails } from './components/EventDetails';
import { EventList, SavedList } from './components/EventLists';

type Tab = 'today' | 'events' | 'saved';
export default function Prototype() {
  const [place, setPlace] = useState<Place | null>(readPlace);
  const [tab, setTab] = useState<Tab>('today');
  const [locationOpen, setLocationOpen] = useState(false);
  const [detail, setDetail] = useState<SkyEvent | null>(null);
  const [reminder, setReminder] = useState<SavedPlan | null>(null);
  const [plans, setPlans] = useState<SavedPlan[]>(loadPlans);
  const [storageError, setStorageError] = useState('');
  const { events, loading, error, retry } = useEvents(place);
  const event = events[0];
  function selectPlace(next: Place) {
    setPlace(next); setLocationOpen(false); setDetail(null);
    setStorageError(saveLocal(PLACE_KEY, next) ? '' : 'Город выбран, но браузер не сохранил его.');
  }
  function remind(selected: SkyEvent) {
    if (!place) return;
    const existing = plans.find(p => planKey(p) === planKey({ event: selected, place }));
    setDetail(null); setReminder({ event: selected, place, leadMinutes: existing?.leadMinutes ?? 60 });
  }
  function save(plan: SavedPlan) {
    const next = [...plans.filter(p => planKey(p) !== planKey(plan)), plan];
    if (!saveLocal(PLANS_KEY, next)) return false;
    setPlans(next); return true;
  }
  return <main className={`sky-app sky-app-${tab}`} aria-label="Смотри на небо.">
    <header className="sky-header">
      <button className="brand" aria-label="Смотри на небо. Главная" onClick={() => setTab('today')}>
        <img src="/assets/brand-mark.png" alt="" /><span>Смотри<br />на небо<span className="brand-period">.</span></span>
      </button>
      <button className="location-button" onClick={() => setLocationOpen(true)} aria-label={`Выбрать место: ${place?.name ?? 'не выбрано'}`}>
        <span>{place?.name ?? 'Выбрать город'}</span><MapPin weight="light" size={23} />
      </button>
    </header>

    {tab === 'today' && <>
      <section className={`hero ${!event ? 'hero-status' : ''}`} aria-live="polite">
        {!place ? <><p className="eyebrow">Место наблюдения</p><h1>Где смотрим?</h1><p className="hero-subtitle">Выберите город, чтобы узнать,<br />что и когда будет видно.</p><Button variant="secondary" onClick={() => setLocationOpen(true)}>Выбрать город<CaretRight size={19} /></Button></>
          : loading ? <><p className="eyebrow">{place.name}</p><h1>Считаем<br />события<span className="loading-dot">.</span></h1><p className="hero-subtitle">С учётом вашего горизонта.</p></>
          : error ? <><h1>Не получилось</h1><p className="hero-subtitle">{error}</p><Button variant="secondary" onClick={retry}>Повторить</Button></>
          : event ? <><p className="eyebrow">Ближайшее событие</p><button className="hero-event" onClick={() => setDetail(event)} aria-label={`Подробнее: ${event.title}`}><h1>{event.title}</h1></button><p className="hero-subtitle">{event.subtitle}</p><button className="detail-link" onClick={() => setDetail(event)}>Где и как смотреть<CaretRight size={15} /></button></>
          : <><p className="eyebrow">{place.name}</p><h1>Нет событий<br />в каталоге</h1><p className="hero-subtitle">В ближайший год нет подходящего окна наблюдения для этих типов событий.</p><Button variant="secondary" onClick={() => setLocationOpen(true)}>Выбрать другое место</Button></>}
      </section>
      {event && place && !loading && <section className="observation-actions">
        <div className="observation-meta"><div><span>Когда</span><strong>{dateLabel(event.best, place)}</strong><small>{timeLabel(event.best, place)} · местное время</small></div>
          <button onClick={() => setDetail(event)}><span>Как смотреть</span><strong>{event.equipment}</strong><small>Подробнее об оптике</small></button></div>
        <Button className="remind-primary" onClick={() => remind(event)}><Bell size={25} weight="light" />Напомнить мне</Button>
      </section>}
    </>}
    {tab === 'events' && <EventList events={events} place={place} loading={loading} error={error} onRetry={retry} onSelect={setDetail} onLocate={() => setLocationOpen(true)} />}
    {tab === 'saved' && <SavedList plans={plans} onSelect={setReminder} onBrowse={() => setTab('events')} />}
    {storageError && <p className="storage-message" role="status">{storageError}</p>}
    <nav className="sky-nav" aria-label="Главная навигация">
      {([{ id: 'today', label: 'Сегодня', Icon: CalendarStar }, { id: 'events', label: 'События', Icon: Planet }, { id: 'saved', label: 'Сохранено', Icon: BookmarkSimple }] as const).map(({ id, label, Icon }) =>
        <button key={id} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}><Icon size={29} weight="light" /><span>{label}</span></button>)}
    </nav>
    <LocationSheet open={locationOpen} onClose={() => setLocationOpen(false)} onSelect={selectPlace} />
    <EventDetails event={detail} place={place} onClose={() => setDetail(null)} onRemind={() => { if (detail) remind(detail); }} />
    <ReminderSheet plan={reminder} saved={!!reminder && plans.some(p => planKey(p) === planKey(reminder))} onClose={() => setReminder(null)} onSave={save} />
  </main>;
}

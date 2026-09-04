import { useEffect, useRef, useState } from 'react';
import { NavigationArrow, MagnifyingGlass, CaretRight } from '@phosphor-icons/react';
import { BottomSheet, KeyboardInput, useKeyboard } from '../mobile';
import { cities, locate, searchCities } from '../domain/locations';
import type { Place } from '../domain/types';
import { Button } from './Button';

export function LocationSheet({ open, onClose, onSelect }: { open: boolean; onClose: () => void; onSelect: (p: Place) => void }) {
  const keyboard = useKeyboard();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [error, setError] = useState('');
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const request = useRef(0);
  useEffect(() => {
    request.current++;
    setLocating(false); setError('');
    if (!open) setQuery('');
  }, [open]);
  useEffect(() => {
    setResults([]); setError('');
    if (!open || query.trim().length < 2) { setSearching(false); return; }
    const abort = new AbortController();
    setSearching(true);
    const timer = setTimeout(() => {
      searchCities(query.trim(), abort.signal).then(list => {
        if (!abort.signal.aborted) setResults(list);
      }).catch(() => { if (!abort.signal.aborted) setError('Поиск городов недоступен. Попробуйте позже.'); })
        .finally(() => { if (!abort.signal.aborted) setSearching(false); });
    }, 350);
    return () => { clearTimeout(timer); abort.abort(); };
  }, [query, open]);
  function close() { request.current++; keyboard.hide(); onClose(); }
  function select(place: Place) { request.current++; keyboard.hide(); onSelect(place); }
  async function detect() {
    keyboard.hide(); const id = ++request.current; setLocating(true); setError('');
    try { const place = await locate(); if (id === request.current) select(place); }
    catch (e) { if (id === request.current) setError(e instanceof Error ? e.message : 'Не удалось определить место.'); }
    finally { if (id === request.current) setLocating(false); }
  }
  const list = query.trim().length >= 2 ? results : cities;
  return <BottomSheet open={open} onOpenChange={v => { if (!v) close(); }} title="Где будете смотреть?"
    description="От места зависят время и видимость событий." snap={0.79}>
    <div className="sky-sheet" onMouseDown={e => {
      // Keep the input focused until a button click completes. Otherwise blur
      // moves the keyboard-linked sheet between mouse-down and mouse-up.
      if (e.target instanceof Element && e.target.closest('button')) e.preventDefault();
    }}>
      <Button variant="secondary" onClick={detect} disabled={locating}>
        <NavigationArrow size={20} weight="light" />{locating ? 'Определяем…' : 'Моё местоположение'}
      </Button>
      <label className="city-search"><MagnifyingGlass size={20} weight="light" />
        <KeyboardInput aria-label="Название города" placeholder="Найти город" value={query}
          onChange={e => setQuery(e.target.value)} onBlur={() => keyboard.hide()}
          onKeyDown={e => { if (e.key === 'Enter') keyboard.hide(); }} autoComplete="off" />
      </label>
      <div aria-live="polite">
        {error && <p className="sky-error">{error}</p>}
        {searching && <p className="sky-note">Ищем город…</p>}
        {!searching && !error && query.trim().length >= 2 && list.length === 0 && <p className="sky-note">Город не найден. Проверьте название.</p>}
      </div>
      <div className="city-list">{list.map(place => <button key={`${place.latitude}:${place.longitude}`} onClick={() => select(place)}>
        <span>{place.name}<small>{place.region}</small></span><CaretRight size={18} weight="light" />
      </button>)}</div>
      <p className="sky-note">Координаты для расчёта остаются в браузере. Название города при поиске отправляется в Open-Meteo.</p>
      <Button variant="ghost" onClick={close}>Закрыть</Button>
    </div>
  </BottomSheet>;
}

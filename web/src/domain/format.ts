import type { Place } from './types';
export function dateLabel(instant: string, place: Place, year = false) {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: place.timezone, day: 'numeric', month: 'long', ...(year ? { year: 'numeric' } as const : {}),
  }).format(new Date(instant));
}
export function timeLabel(instant: string, place: Place) {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: place.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date(instant));
}
export function windowLabel(start: string, end: string, place: Place) {
  if (dateLabel(start, place, true) === dateLabel(end, place, true))
    return `${dateLabel(start, place)}, ${timeLabel(start, place)}–${timeLabel(end, place)}`;
  return `${dateLabel(start, place)}, ${timeLabel(start, place)} — ${dateLabel(end, place)}, ${timeLabel(end, place)}`;
}
export function direction(azimuth: number) {
  return ['Север', 'Северо-восток', 'Восток', 'Юго-восток', 'Юг', 'Юго-запад', 'Запад', 'Северо-запад'][Math.round(azimuth / 45) % 8];
}

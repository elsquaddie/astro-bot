import type { SavedPlan } from './types';
const escape = (value: string) => value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
const stamp = (value: string | Date) => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
function fold(line: string): string {
  const encoder = new TextEncoder();
  let result = '', width = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    if (width + bytes > 75) { result += '\r\n '; width = 1; }
    result += char; width += bytes;
  }
  return result;
}
export function calendarFile(plan: SavedPlan, now = new Date()) {
  const { event, place, leadMinutes } = plan;
  // The selected observing instant, not a global astronomical peak.
  const end = Math.max(new Date(event.best).getTime() + 60_000,
    Math.min(new Date(event.end).getTime(), new Date(event.best).getTime() + 30 * 60_000));
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Smotri na nebo//Observer//RU', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT', `UID:${event.id}-${place.latitude}-${place.longitude}@smotri-na-nebo.local`,
    `DTSTAMP:${stamp(now)}`, `DTSTART:${stamp(event.best)}`, `DTEND:${stamp(new Date(end))}`,
    `SUMMARY:${escape(event.title)}`, `LOCATION:${escape(place.name)}`,
    `DESCRIPTION:${escape(`${event.description}\n${event.equipmentDetail}\nПогода и препятствия на горизонте не учтены.\n${event.source}`)}`,
    'BEGIN:VALARM', `TRIGGER:-PT${Math.max(0, Math.round(leadMinutes))}M`, 'ACTION:DISPLAY',
    `DESCRIPTION:${escape(event.title)}`, 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR', '',
  ].map(fold).join('\r\n');
}
export function downloadCalendar(plan: SavedPlan) {
  const url = URL.createObjectURL(new Blob([calendarFile(plan)], { type: 'text/calendar;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = 'smotri-na-nebo.ics'; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

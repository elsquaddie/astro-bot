import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarFile } from '../src/domain/calendar';
import { dateLabel, timeLabel } from '../src/domain/format';
import { validPlace, readPlans } from '../src/domain/storage';
import type { SavedPlan } from '../src/domain/types';

const plan: SavedPlan = {
  place: { name: 'Самара', latitude: 53.19, longitude: 50.1, timezone: 'Europe/Samara' },
  leadMinutes: 60,
  event: { id: 'moon:2026-09-26', kind: 'moon-phase', title: 'Полнолуние', subtitle: 'Фаза Луны',
    description: 'Строка, с запятой; и переносом\nЕщё строка', equipment: 'Без телескопа',
    equipmentDetail: 'Бинокль — для деталей.', peak: '2026-09-26T16:49:00Z',
    start: '2026-09-26T20:00:00Z', end: '2026-09-27T02:00:00Z', best: '2026-09-26T22:00:00Z',
    altitude: 30, azimuth: 180, source: 'https://github.com/cosinekitty/astronomy' },
};
test('local labels respect selected timezone across midnight', () => {
  assert.match(dateLabel(plan.event.best, plan.place), /27 сентября/);
  assert.equal(timeLabel(plan.event.best, plan.place), '02:00');
});
test('calendar preserves UTC instant, alarm, escaping and RFC line folding', () => {
  const text = calendarFile(plan, new Date('2026-09-01T00:00:00Z'));
  const unfolded = text.replace(/\r\n /g, '');
  assert.match(unfolded, /DTSTART:20260926T220000Z/);
  assert.match(unfolded, /TRIGGER:-PT60M/);
  assert.match(unfolded, /BEGIN:VALARM/);
  assert.match(unfolded, /LOCATION:Самара/);
  assert.match(unfolded, /Строка\\, с запятой\\; и переносом\\nЕщё строка/);
  assert.ok(text.endsWith('\r\n'));
  assert.ok(text.split('\r\n').every(line => Buffer.byteLength(line) <= 75));
});
test('persisted data is treated as untrusted and invalid data cannot crash UI', () => {
  assert.equal(validPlace({ ...plan.place, timezone: 'Wrong/Zone' }), false);
  assert.equal(validPlace({ ...plan.place, latitude: 120 }), false);
  assert.deepEqual(readPlans('not json'), []);
  assert.deepEqual(readPlans('[{"event":{"title":"broken"}}]'), []);
  assert.equal(readPlans(JSON.stringify([plan])).length, 1);
});

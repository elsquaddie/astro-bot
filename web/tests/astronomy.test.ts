import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Body, Observer, Equator, Horizon } from 'astronomy-engine';
import { calculateEvents } from '../src/domain/astronomy.ts';

const samara = { name: 'Самара', latitude: 53.1959, longitude: 50.1002, timezone: 'Europe/Samara' };
const date = new Date('2026-09-04T12:00:00Z');
test('rolling catalog calculates the September 2026 full moon and Russian event names', () => {
  const events = calculateEvents(samara, date, 30);
  const full = events.find(e => e.title === 'Полнолуние');
  assert.ok(full, 'Full moon must be calculated, not loaded from the old seed');
  assert.match(full.peak, /^2026-09-26/);
  assert.ok(events.every(e => !e.title.includes('_')));
});
test('local observations are future, ordered and include altitude and darkness checks', () => {
  const events = calculateEvents(samara, date, 60);
  assert.ok(events.length > 4);
  const observer = new Observer(samara.latitude, samara.longitude, 0);
  for (const [index, event] of events.entries()) {
    assert.ok(Date.parse(event.start) >= date.getTime());
    assert.ok(Date.parse(event.end) > Date.parse(event.start));
    assert.ok(event.altitude >= 8);
    const eq = Equator(Body.Sun, new Date(event.best), observer, true, true);
    assert.ok(Horizon(new Date(event.best), observer, eq.ra, eq.dec, 'normal').altitude < -6);
    if (index) assert.ok(event.start >= events[index - 1].start);
  }
});
test('September opposition of Saturn is not assumed; October 2026 is calculated', () => {
  const opposition = calculateEvents(samara, date, 60).find(e => e.title === 'Сатурн в противостоянии');
  assert.ok(opposition);
  assert.match(opposition.peak, /^2026-10-04/);
});
test('catalog works beyond the manually seeded year and excludes polar daylight', () => {
  assert.ok(calculateEvents(samara, new Date('2031-09-04T12:00:00Z'), 30).length > 0);
  const polar = calculateEvents({ ...samara, latitude: 89, longitude: 0, timezone: 'UTC' }, new Date('2027-06-01T00:00:00Z'), 14);
  assert.equal(polar.length, 0);
});
test('recommended time does not drift with the minute the page was opened', () => {
  const a = calculateEvents(samara, new Date('2026-09-04T20:01:17Z'), 2)[0];
  const b = calculateEvents(samara, new Date('2026-09-04T20:03:49Z'), 2)[0];
  assert.equal(a.id, b.id);
  assert.equal(a.best, b.best);
});
test('eclipse recommendation targets the visible eclipse maximum, not lunar culmination', () => {
  const moscow = { name: 'Москва', latitude: 55.7522, longitude: 37.6156, timezone: 'Europe/Moscow' };
  const eclipse = calculateEvents(moscow, new Date('2028-12-01T00:00:00Z'), 40).find(e => e.kind === 'lunar-eclipse');
  assert.ok(eclipse);
  assert.ok(Math.abs(Date.parse(eclipse.best) - Date.parse(eclipse.peak)) < 10 * 60_000,
    'When the peak is locally visible, remind during the main phase rather than after totality');
});

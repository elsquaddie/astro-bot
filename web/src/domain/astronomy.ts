import {
  AngleBetween, Body, GeoVector, NextLunarEclipse, NextMoonQuarter,
  SearchLunarEclipse, SearchMoonQuarter, SearchRelativeLongitude, EclipseKind,
} from 'astronomy-engine';
import type { EventKind, Place, SkyEvent } from './types';
import { DAY, HOUR, observingWindow } from './observation';

const SOURCE = 'https://github.com/cosinekitty/astronomy';
const planets = [
  { body: Body.Venus, name: 'Венера', withName: 'Венерой' },
  { body: Body.Mars, name: 'Марс', withName: 'Марсом' },
  { body: Body.Jupiter, name: 'Юпитер', withName: 'Юпитером' },
  { body: Body.Saturn, name: 'Сатурн', withName: 'Сатурном' },
];
interface Candidate {
  kind: EventKind; key: string; title: string; subtitle: string; description: string;
  peak: number; from: number; to: number; body: Body; companion?: Body;
  equipmentDetail: string;
}

function lunarPhases(start: number, end: number): Candidate[] {
  const events: Candidate[] = [];
  let quarter = SearchMoonQuarter(new Date(start - DAY));
  while (quarter.time.date.getTime() <= end) {
    const peak = quarter.time.date.getTime();
    // New Moon isn't a visible object; do not recommend looking for it.
    if (quarter.quarter !== 0) events.push({
      kind: 'moon-phase', key: `moon-${quarter.quarter}`, body: Body.Moon, peak,
      from: peak - 18 * HOUR, to: peak + 18 * HOUR,
      title: ['Новолуние', 'Первая четверть Луны', 'Полнолуние', 'Последняя четверть Луны'][quarter.quarter],
      subtitle: 'Фаза Луны',
      description: quarter.quarter === 2
        ? 'Освещённый диск Луны виден целиком. Выберите место с открытым горизонтом.'
        : 'Граница света и тени хорошо подчёркивает рельеф Луны. Фазу видно без оптики, кратеры — в бинокль или телескоп.',
      equipmentDetail: 'Луну и её фазу видно невооружённым глазом. Для кратеров пригодится бинокль или телескоп.',
    });
    quarter = NextMoonQuarter(quarter);
  }
  return events;
}

function oppositions(start: number, end: number): Candidate[] {
  const result: Candidate[] = [];
  for (const planet of planets.filter(p => p.body !== Body.Venus)) {
    let peak = SearchRelativeLongitude(planet.body, 0, new Date(start - DAY)).date.getTime();
    while (peak <= end) {
      result.push({
        kind: 'opposition', key: `opposition-${planet.body}`, body: planet.body,
        peak, from: peak - DAY, to: peak + DAY,
        title: `${planet.name} в противостоянии`, subtitle: 'Планетное событие',
        description: 'Планета находится на противоположной от Солнца стороне неба. Её удобно наблюдать ночью.',
        equipmentDetail: planet.body === Body.Saturn
          ? 'Сам Сатурн виден без оптики как яркая точка. Чтобы различить кольца, нужен телескоп.'
          : 'Планета видна невооружённым глазом как яркая точка. Детали диска различимы в телескоп.',
      });
      peak = SearchRelativeLongitude(planet.body, 0, new Date(peak + DAY)).date.getTime();
    }
  }
  return result;
}

function lunarEclipses(start: number, end: number): Candidate[] {
  const result: Candidate[] = [];
  let eclipse = SearchLunarEclipse(new Date(start - DAY));
  while (eclipse.peak.date.getTime() <= end) {
    const peak = eclipse.peak.date.getTime();
    if (eclipse.kind !== EclipseKind.Penumbral) result.push({
      kind: 'lunar-eclipse', key: 'lunar-eclipse', body: Body.Moon,
      peak, from: peak - eclipse.sd_partial * 60_000, to: peak + eclipse.sd_partial * 60_000,
      title: 'Лунное затмение', subtitle: 'Затмение Луны',
      description: 'Луна проходит через тень Земли. Здесь указано время, когда затмение видно над вашим горизонтом в тёмном небе. Полная фаза может быть видна не целиком.',
      equipmentDetail: 'Затмение Луны можно наблюдать невооружённым глазом. Бинокль позволит рассмотреть подробности.',
    });
    eclipse = NextLunarEclipse(eclipse.peak);
  }
  return result;
}

function approaches(start: number, end: number): Candidate[] {
  const result: Candidate[] = [];
  for (const planet of planets) {
    const angle = (stamp: number) => AngleBetween(GeoVector(Body.Moon, new Date(stamp), true), GeoVector(planet.body, new Date(stamp), true));
    const step = 12 * HOUR;
    let previous = angle(start - 2 * step), current = angle(start - step);
    for (let t = start; t <= end + step; t += step) {
      const next = angle(t);
      if (current < previous && current <= next && current < 10) {
        let left = t - 2 * step, right = t;
        for (let i = 0; i < 18; i++) {
          const a = left + (right - left) / 3, b = right - (right - left) / 3;
          if (angle(a) < angle(b)) right = b; else left = a;
        }
        const peak = (left + right) / 2;
        if (angle(peak) <= 6) result.push({
          kind: 'conjunction', key: `moon-${planet.body}`, body: Body.Moon, companion: planet.body,
          peak, from: peak - 18 * HOUR, to: peak + 18 * HOUR,
          title: `Луна рядом с ${planet.withName}`, subtitle: 'Сближение на небе',
          description: `Луна и ${planet.name} окажутся рядом на небе. Найдите Луну: планета будет яркой точкой неподалёку. В указанное время оба объекта над горизонтом, а небо уже достаточно тёмное.`,
          equipmentDetail: 'Оба объекта видны невооружённым глазом. Телескоп понадобится только для деталей планеты.',
        });
      }
      previous = current; current = next;
    }
  }
  return result;
}

export function calculateEvents(place: Place, start: Date, days = 365): SkyEvent[] {
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(place.latitude) ||
      !Number.isFinite(place.longitude) || Math.abs(place.latitude) > 90 || Math.abs(place.longitude) > 180 ||
      !Number.isFinite(days) || days < 1 || days > 366) throw new Error('Некорректное место или период расчёта');
  const from = start.getTime(), end = from + days * DAY;
  const candidates = [...lunarPhases(from, end), ...oppositions(from, end), ...lunarEclipses(from, end), ...approaches(from, end)];
  const events: SkyEvent[] = [];
  for (const candidate of candidates) {
    const window = observingWindow(place, candidate.body, Math.max(from, candidate.from), Math.min(end, candidate.to),
      candidate.companion, candidate.kind === 'lunar-eclipse' ? candidate.peak : undefined);
    if (!window) continue;
    events.push({
      ...window, id: `${candidate.key}:${new Date(candidate.peak).toISOString().slice(0, 10)}`,
      kind: candidate.kind, title: candidate.title, subtitle: candidate.subtitle,
      description: candidate.description, equipment: 'Без телескопа',
      equipmentDetail: candidate.equipmentDetail,
      peak: new Date(candidate.peak).toISOString(), source: SOURCE,
    });
  }
  return events.sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
}

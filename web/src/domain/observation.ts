import { Body, Equator, Horizon, Observer, AngleBetween, Vector } from 'astronomy-engine';
import type { Place } from './types';

export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;
export function horizontal(body: Body, time: Date, observer: Observer) {
  const equator = Equator(body, time, observer, true, true);
  return Horizon(time, observer, equator.ra, equator.dec, 'normal');
}
export function separation(a: Body, b: Body, time: Date, observer: Observer): number {
  const first = Equator(a, time, observer, true, true).vec;
  const second = Equator(b, time, observer, true, true).vec;
  return AngleBetween(first as Vector, second as Vector);
}

// Conservative ten-minute samples: endpoints are both known to pass visibility
// checks. This is an observing suggestion, not eclipse contact-time prediction.
export function observingWindow(
  place: Place, body: Body, from: number, to: number, companion?: Body, preferred?: number,
) {
  const observer = new Observer(place.latitude, place.longitude, 0);
  const step = 10 * 60_000;
  let run: { time: number; altitude: number; azimuth: number }[] = [];
  function finish() {
    if (run.length < 3) return null;
    const best = run.reduce((a, b) => preferred === undefined
      ? (a.altitude > b.altitude ? a : b)
      : (Math.abs(a.time - preferred) < Math.abs(b.time - preferred) ? a : b));
    return {
      start: new Date(run[0].time).toISOString(),
      end: new Date(run[run.length - 1].time).toISOString(),
      best: new Date(best.time).toISOString(),
      altitude: best.altitude, azimuth: best.azimuth,
    };
  }
  for (let stamp = Math.ceil(from / step) * step; stamp <= to; stamp += step) {
    const time = new Date(stamp);
    const sun = horizontal(Body.Sun, time, observer);
    const target = horizontal(body, time, observer);
    const visible = sun.altitude < -6 && target.altitude >= 8 && (!companion ||
      (horizontal(companion, time, observer).altitude >= 8 && separation(body, companion, time, observer) <= 6));
    if (visible) run.push({ time: stamp, altitude: target.altitude, azimuth: target.azimuth });
    else if (run.length) {
      const window = finish();
      if (window) return window;
      run = [];
    }
  }
  return finish();
}

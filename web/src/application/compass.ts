import { compassHeading } from '../domain/compass';
export interface CompassReading { heading: number | null; state: 'starting' | 'active' | 'tilted' | 'unavailable' }
export function trackCompass(update: (reading: CompassReading) => void): () => void {
  const app = window.Telegram?.WebApp;
  const sensor = app?.initData && app.isVersionAtLeast('8.0') ? app.DeviceOrientation : undefined;
  if (!app || !sensor) { update({ heading: null, state: 'unavailable' }); return () => {}; }
  let stopped = false;
  let timer: ReturnType<typeof setTimeout>;
  const stop = () => {
    if (stopped) return; stopped = true; clearTimeout(timer);
    app.offEvent('deviceOrientationChanged', changed); app.offEvent('deviceOrientationFailed', failed);
    document.removeEventListener('visibilitychange', visibility);
    try { sensor.stop(); } catch { /* Unavailable sensors may reject stop. */ }
  };
  const failed = () => { if (!stopped) { stop(); update({ heading: null, state: 'unavailable' }); } };
  const changed = () => {
    if (stopped) return;
    clearTimeout(timer); timer = setTimeout(failed, 5000);
    if (!sensor.absolute) { failed(); return; }
    const heading = compassHeading(sensor.absolute, sensor.alpha, sensor.beta, sensor.gamma, window.screen?.orientation?.angle ?? 0);
    update({ heading, state: heading === null ? 'tilted' : 'active' });
  };
  const visibility = () => { if (document.visibilityState === 'hidden') failed(); };
  update({ heading: null, state: 'starting' });
  app.onEvent('deviceOrientationChanged', changed); app.onEvent('deviceOrientationFailed', failed);
  document.addEventListener('visibilitychange', visibility);
  timer = setTimeout(failed, 8000);
  try { sensor.start({ refresh_rate: 100, need_absolute: true }, started => { if (!started) failed(); }); }
  catch { failed(); }
  return stop;
}

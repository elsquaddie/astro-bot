import tzlookup from 'tz-lookup';
import type { Place } from './types';
import { validPlace } from './storage';

export const cities: Place[] = [
  { name: 'Самара', latitude: 53.1959, longitude: 50.1002, timezone: 'Europe/Samara', region: 'Россия' },
  { name: 'Москва', latitude: 55.7522, longitude: 37.6156, timezone: 'Europe/Moscow', region: 'Россия' },
  { name: 'Санкт-Петербург', latitude: 59.9386, longitude: 30.3141, timezone: 'Europe/Moscow', region: 'Россия' },
];
export function coordinatesToPlace(latitude: number, longitude: number): Place {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180)
    throw new Error('Не удалось определить место. Выберите город.');
  return { name: 'Рядом со мной', latitude, longitude, timezone: tzlookup(latitude, longitude) };
}
export class LocationError extends Error {
  constructor(message: string, public settings = false) { super(message); }
}
export function openLocationSettings() {
  const manager = window.Telegram?.WebApp?.LocationManager;
  if (manager?.isInited && manager.isLocationAvailable && manager.isAccessRequested && !manager.isAccessGranted)
    manager.openSettings();
}
export function locate(signal?: AbortSignal): Promise<Place> {
  const app = window.Telegram?.WebApp;
  const manager = app?.initData && app.isVersionAtLeast('8.0') ? app.LocationManager : undefined;
  if (signal?.aborted) return Promise.reject(new LocationError('Определение места отменено.'));
  if (!manager) return locateWithBrowser();
  return new Promise((resolve, reject) => {
    let finished = false;
    const finish = (location: { latitude: number; longitude: number } | null, error?: LocationError) => {
      if (finished) return; finished = true; clearTimeout(timer); signal?.removeEventListener('abort', abort);
      if (error) { reject(error); return; }
      if (location) {
        try { resolve(coordinatesToPlace(location.latitude, location.longitude)); } catch (error) { reject(error); }
      } else if (manager.isAccessGranted) {
        // Android can grant permission but return no GPS fix. Try the WebView's
        // location provider only after access was granted, never after refusal.
        locateWithBrowser().then(resolve, reject);
      } else if (manager.isAccessRequested) {
        reject(new LocationError('Telegram не дал доступ к геолокации. Проверьте разрешение для бота и для самого Telegram.', true));
      } else reject(new LocationError('Telegram не передал местоположение. Попробуйте ещё раз или выберите город.'));
    };
    // Leave time for both the permission dialog and a first GPS fix.
    const abort = () => finish(null, new LocationError('Определение места отменено.'));
    const timer = setTimeout(() => {
      if (manager.isAccessGranted) finish(null);
      else finish(null, new LocationError('Не дождались местоположения. Попробуйте ещё раз или выберите город.'));
    }, 60_000);
    signal?.addEventListener('abort', abort, { once: true });
    const request = () => {
      if (finished) return;
      if (!manager.isLocationAvailable) finish(null, new LocationError('На устройстве недоступна геолокация. Выберите город.'));
      else { try { manager.getLocation(location => finish(location)); } catch { finish(null, new LocationError('Не удалось запросить местоположение. Попробуйте ещё раз.')); } }
    };
    try { if (manager.isInited) request(); else manager.init(request); }
    catch { finish(null, new LocationError('Не удалось запросить местоположение. Попробуйте ещё раз или выберите город.')); }
  });
}
export function locateWithBrowser(): Promise<Place> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new LocationError('Не удалось получить координаты. Выберите город.')); return; }
    navigator.geolocation.getCurrentPosition(position => {
      const { latitude, longitude } = position.coords;
      try { resolve(coordinatesToPlace(latitude, longitude)); }
      catch { reject(new LocationError('Не удалось определить часовой пояс. Выберите город.')); }
    }, error => reject(new LocationError(error.code === 1
      ? 'Доступ к геолокации закрыт в настройках устройства. Можно выбрать город вручную.'
      : 'Координаты пока не получены. Проверьте, включена ли геолокация на телефоне, или выберите город.')),
    { timeout: 20_000, maximumAge: 300_000, enableHighAccuracy: false });
  });
}
export async function searchCities(query: string, signal: AbortSignal): Promise<Place[]> {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.search = new URLSearchParams({ name: query, count: '8', language: 'ru', format: 'json' }).toString();
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error('Поиск городов недоступен. Попробуйте позже.');
  const data = await response.json();
  if (data.error) throw new Error('Поиск городов недоступен. Попробуйте позже.');
  return (data.results ?? []).map((r: Record<string, unknown>) => ({
    name: r.name, latitude: r.latitude, longitude: r.longitude, timezone: r.timezone,
    region: [r.admin1, r.country].filter(Boolean).join(', '),
  })).filter(validPlace);
}

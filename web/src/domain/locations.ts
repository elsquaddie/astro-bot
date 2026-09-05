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
export function locate(): Promise<Place> {
  const app = window.Telegram?.WebApp;
  const manager = app?.initData && app.isVersionAtLeast('8.0') ? app.LocationManager : undefined;
  if (manager) return new Promise((resolve, reject) => {
    let finished = false;
    const finish = (location: { latitude: number; longitude: number } | null, unavailable = false) => {
      if (finished) return; finished = true; clearTimeout(timer);
      if (!location) { reject(new Error(unavailable ? 'На устройстве недоступна геолокация. Выберите город.' : 'Доступ к месту не получен. Разрешите геолокацию в настройках Telegram или выберите город.')); return; }
      try { resolve(coordinatesToPlace(location.latitude, location.longitude)); } catch (error) { reject(error); }
    };
    const timer = setTimeout(() => finish(null), 20_000);
    const request = () => { if (!finished) { if (!manager.isLocationAvailable) finish(null, true); else manager.getLocation(location => finish(location)); } };
    try { if (manager.isInited) request(); else manager.init(request); } catch { finish(null); }
  });
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('Браузер не поддерживает геолокацию. Выберите город.')); return; }
    navigator.geolocation.getCurrentPosition(position => {
      const { latitude, longitude } = position.coords;
      try { resolve(coordinatesToPlace(latitude, longitude)); }
      catch { reject(new Error('Не удалось определить часовой пояс. Выберите город.')); }
    }, error => reject(new Error(error.code === 1
      ? 'Доступ к геолокации закрыт. Можно выбрать город вручную.'
      : 'Не удалось определить местоположение. Попробуйте ещё раз или выберите город.')),
    { timeout: 12_000, maximumAge: 300_000, enableHighAccuracy: false });
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

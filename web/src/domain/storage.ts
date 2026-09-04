import type { Place, SavedPlan, SkyEvent } from './types';
export const PLACE_KEY = 'sky.place.v1';
export const PLANS_KEY = 'sky.plans.v1';
export function validPlace(value: unknown): value is Place {
  if (!value || typeof value !== 'object') return false;
  const p = value as Place;
  if (typeof p.name !== 'string' || !p.name.trim() || p.name.length > 160 ||
      !Number.isFinite(p.latitude) || Math.abs(p.latitude) > 90 ||
      !Number.isFinite(p.longitude) || Math.abs(p.longitude) > 180 || typeof p.timezone !== 'string') return false;
  try { new Intl.DateTimeFormat('ru', { timeZone: p.timezone }); return true; } catch { return false; }
}
function validEvent(value: unknown): value is SkyEvent {
  if (!value || typeof value !== 'object') return false;
  const e = value as SkyEvent;
  return ['id', 'title', 'subtitle', 'description', 'equipment', 'equipmentDetail', 'source'].every(key =>
    typeof e[key as keyof SkyEvent] === 'string') &&
    ['moon-phase', 'conjunction', 'opposition', 'lunar-eclipse'].includes(e.kind) &&
    [e.peak, e.start, e.end, e.best].every(d => typeof d === 'string' && Number.isFinite(Date.parse(d))) &&
    e.start <= e.best && e.best <= e.end && Number.isFinite(e.altitude) && Number.isFinite(e.azimuth);
}
export function readPlans(raw: string | null): SavedPlan[] {
  try {
    const value: unknown = JSON.parse(raw ?? '[]');
    return Array.isArray(value) ? value.filter((p): p is SavedPlan => p && validPlace(p.place) &&
      validEvent(p.event) && [0, 15, 60, 1440].includes(p.leadMinutes)).slice(0, 200) : [];
  } catch { return []; }
}
export function readPlace(): Place | null {
  try { const value = JSON.parse(localStorage.getItem(PLACE_KEY) ?? 'null'); return validPlace(value) ? value : null; }
  catch { return null; }
}
export function loadPlans(): SavedPlan[] {
  try { return readPlans(localStorage.getItem(PLANS_KEY)); } catch { return []; }
}
export function saveLocal(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}
export const planKey = (p: Pick<SavedPlan, 'event' | 'place'>) => `${p.event.id}:${p.place.latitude}:${p.place.longitude}`;

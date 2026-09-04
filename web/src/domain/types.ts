export interface Place {
  name: string;
  latitude: number;
  longitude: number;
  timezone: string;
  region?: string;
}

export type EventKind = 'moon-phase' | 'conjunction' | 'opposition' | 'lunar-eclipse';
export interface SkyEvent {
  id: string;
  kind: EventKind;
  title: string;
  subtitle: string;
  description: string;
  equipment: string;
  equipmentDetail: string;
  peak: string;
  start: string;
  end: string;
  best: string;
  altitude: number;
  azimuth: number;
  source: string;
}
export interface SavedPlan { event: SkyEvent; place: Place; leadMinutes: number }

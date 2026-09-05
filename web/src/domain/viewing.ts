import { direction } from './format';
import type { SkyEvent } from './types';

export function viewingGuide(event: Pick<SkyEvent, 'altitude' | 'azimuth' | 'kind' | 'id'>) {
  const bearing = Math.round(((event.azimuth % 360) + 360) % 360) % 360;
  const fists = Math.max(1, Math.round(event.altitude / 10));
  const count = fists === 1 ? 'один кулак' : fists < 5 ? `${fists} кулака` : `${fists} кулаков`;
  const elevation = event.altitude >= 75
    ? 'Поднимите взгляд почти прямо над головой.'
    : `Поднимите взгляд примерно на ${count} от горизонта. Считайте кулаки один над другим на вытянутой руке: один кулак — около 10°.`;
  const planet = event.kind === 'conjunction' ? Object.entries({ Venus: 'Венера', Mars: 'Марс', Jupiter: 'Юпитер', Saturn: 'Сатурн' })
    .find(([key]) => event.id.startsWith(`moon-${key}:`))?.[1] : undefined;
  return {
    bearing, direction: direction(bearing), elevation,
    compass: `Откройте компас на телефоне и повернитесь к отметке ${bearing}° (${direction(bearing).toLowerCase()}).`,
    target: planet ? `Сначала найдите Луну. ${planet} будет рядом с ней — яркой точкой.` : '',
  };
}

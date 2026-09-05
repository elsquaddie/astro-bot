import { SkyCompass } from './SkyCompass';
import { viewingGuide } from '../domain/viewing';
import type { SkyEvent } from '../domain/types';
export function ViewingGuide({ event }: { event: SkyEvent }) {
  const guide = viewingGuide(event);
  const angle = Math.max(0, Math.min(90, event.altitude));
  const x = 24 + 144 * Math.cos(angle * Math.PI / 180);
  const y = 165 - 144 * Math.sin(angle * Math.PI / 180);
  return <section className="viewing-guide" aria-label="Куда смотреть">
    <h2>Куда смотреть</h2><p className="sky-note">В указанное время наблюдения</p>
    <SkyCompass bearing={guide.bearing} />
    <svg viewBox="0 0 300 200" role="img" aria-label={`Объект на высоте ${Math.round(angle)} градусов. Горизонт внизу, над головой — 90 градусов.`}>
      <path d="M24 21V165H278" fill="none" stroke="#596078" strokeDasharray="4 5" />
      <path d={`M24 165L${x} ${y}`} stroke="#969bff" strokeWidth="2" />
      <circle cx={x} cy={y} r="6" fill="#f3eee6" />
      <text x="37" y="25">Над головой</text><text x="183" y="186">Горизонт</text>
      <text x={Math.min(245, x+12)} y={Math.max(45,y+4)}>{Math.round(angle)}°</text>
    </svg>
    <p>{guide.elevation}</p>
    {guide.target && <p>{guide.target}</p>}
    <p className="sky-note">Горизонт — линия, где земля сходится с небом. Верхушки домов и деревьев не подходят как точка отсчёта.</p>
  </section>;
}

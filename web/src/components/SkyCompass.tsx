import { useEffect, useRef, useState } from 'react';
import { trackCompass, type CompassReading } from '../application/compass';
import { turnTo } from '../domain/compass';
import { direction } from '../domain/format';
import { Button } from './Button';

export function SkyCompass({ bearing }: { bearing: number }) {
  const [reading, setReading] = useState<CompassReading | null>(null);
  const stop = useRef<(() => void) | null>(null);
  useEffect(() => () => { stop.current?.(); }, []);
  const heading = reading?.heading ?? null;
  const delta = heading === null ? null : turnTo(bearing, heading);
  const aligned = delta !== null && Math.abs(delta) <= 12;
  const status = reading?.state === 'starting' ? 'Подключаем компас…'
    : reading?.state === 'tilted' ? 'Положите телефон горизонтально, экраном вверх.'
    : reading?.state === 'unavailable' ? 'Компас недоступен. Найдите это направление в компасе телефона.'
    : delta === null ? 'Включите компас, чтобы увидеть, куда повернуться.'
    : aligned ? 'Направление перед вами.'
    : `Повернитесь ${delta > 0 ? 'вправо' : 'влево'} примерно на ${Math.round(Math.abs(delta))}°.`;
  function toggle() {
    stop.current?.();
    if (reading && reading.state !== 'unavailable') { setReading(null); stop.current = null; }
    else stop.current = trackCompass(setReading);
  }
  return <div className="sky-compass">
    <svg viewBox="0 0 220 220" role="img" aria-label={`Направление наблюдения: ${direction(bearing)}, ${bearing} градусов${heading === null ? '. Схема, север сверху' : '. Стрелка относительно телефона'}`}>
      <circle cx="110" cy="110" r="87" fill="#0c1528" stroke="#37425e" />
      {['С', 'В', 'Ю', 'З'].map((label, i) => {
        const angle = (i * 90 - (heading ?? 0) - 90) * Math.PI / 180;
        return <text key={label} x={110 + 73*Math.cos(angle)} y={115 + 73*Math.sin(angle)} textAnchor="middle">{label}</text>;
      })}
      <g transform={`rotate(${delta ?? bearing} 110 110)`}>
        <path d="M110 57L99 82L110 76L121 82Z" fill={aligned ? '#bce5ca' : '#b3b6ff'} />
        <path d="M110 78V143" stroke={aligned ? '#bce5ca' : '#b3b6ff'} strokeWidth="3" strokeLinecap="round" />
      </g>
      <circle cx="110" cy="110" r="5" fill="#f3eee6" />
      {heading !== null && <path d="M105 9L110 17L115 9" fill="none" stroke="#f3eee6" strokeWidth="2" />}
    </svg>
    <strong>{direction(bearing)} · {bearing}°</strong>
    <p className="sky-note">{heading === null ? 'Схема: север сверху' : 'Приблизительное направление'}</p>
    <p role="status">{status}</p>
    <Button variant="secondary" onClick={toggle}>{reading && reading.state !== 'unavailable' ? 'Выключить компас' : 'Включить компас'}</Button>
    {heading !== null && <p className="sky-note">Держите телефон плашмя. Магниты и металл рядом мешают компасу.</p>}
  </div>;
}

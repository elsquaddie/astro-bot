import { Bell } from '@phosphor-icons/react';
import { BottomSheet } from '../platform';
import { dateLabel, direction, timeLabel, windowLabel } from '../domain/format';
import type { Place, SkyEvent } from '../domain/types';
import { Button } from './Button';

export function EventDetails({ event, place, onClose, onRemind }: {
  event: SkyEvent | null; place: Place | null; onClose: () => void; onRemind: () => void;
}) {
  return <BottomSheet open={!!event && !!place} onOpenChange={v => { if (!v) onClose(); }}
    title={event?.title ?? 'Событие'}  snap={0.86}>
    {event && place && <div className="sky-sheet event-detail">
      <p>{event.description}</p>
      <dl>
        <div><dt>Можно наблюдать</dt><dd>{windowLabel(event.start, event.end, place)}</dd></div>
        <div><dt>Когда лучше смотреть</dt><dd>{dateLabel(event.best, place)}, {timeLabel(event.best, place)}<small>
          {direction(event.azimuth)}, {Math.round(event.altitude)}° над горизонтом</small></dd></div>
        <div><dt>Как смотреть</dt><dd>{event.equipmentDetail}</dd></div>
        <div><dt>Место</dt><dd>{place.name}<small>{place.latitude.toFixed(2)}°, {place.longitude.toFixed(2)}° · {place.timezone}</small></dd></div>
      </dl>
      <Button onClick={onRemind}><Bell size={21} weight="light" />Напомнить мне</Button>
      <details className="calculation-details"><summary>Как рассчитано</summary>
        <p>Глобальный момент события: {dateLabel(event.peak, place, true)}, {timeLabel(event.peak, place)}. Время наблюдения может отличаться.</p>
        <p>Окно проверяется с шагом 10 минут: Солнце ниже −6°, объект выше 8°. Для сближений оба объекта должны быть над горизонтом. Погода, засветка и здания не учтены.</p>
        <p>Каталог на следующие 365 дней: четверти и полнолуния, сближения Луны с четырьмя яркими планетами, противостояния Марса, Юпитера и Сатурна, теневые лунные затмения. Метеорные потоки и пролёты спутников пока не включены.</p>
        <a href="https://github.com/cosinekitty/astronomy" target="_blank" rel="noreferrer">Источник расчётов — Astronomy Engine ↗</a>
      </details>
      <Button variant="ghost" onClick={onClose}>Закрыть</Button>
    </div>}
  </BottomSheet>;
}

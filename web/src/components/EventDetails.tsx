import { useState } from 'react';
import { Bell, BookmarkSimple, Check } from '@phosphor-icons/react';
import { BottomSheet } from '../platform';
import { dateLabel, direction, timeLabel, windowLabel } from '../domain/format';
import type { Place, SkyEvent } from '../domain/types';
import { ViewingGuide } from './ViewingGuide';
import { Button } from './Button';

export function EventDetails({ event, place, onClose, onRemind, saved, onSave }: {
  event: SkyEvent | null; place: Place | null; onClose: () => void; onRemind: () => void; saved: boolean; onSave: () => boolean;
}) {
  const [saveError, setSaveError] = useState('');
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
      <ViewingGuide event={event} />
      <Button onClick={onRemind}><Bell size={21} weight="light" />Напомнить мне</Button>
      <Button variant="secondary" disabled={saved} onClick={() => setSaveError(onSave() ? '' : 'Не удалось сохранить событие на устройстве.')}>
        {saved ? <Check size={21} /> : <BookmarkSimple size={21} />}{saved ? 'Событие сохранено' : 'Сохранить событие'}
      </Button>
      <p className="sky-note" role="status">{saveError || (saved ? 'Событие в разделе «Сохранено».' : 'Закладка на этом устройстве. Без сообщения от бота.')}</p>
      <details className="calculation-details"><summary>Как рассчитано</summary>
        <p>События Луны и планет на год вперёд рассчитаны с помощью Astronomy Engine — движка, который определяет положение Солнца, Луны и планет по дате, времени и координатам.</p>
        <p>По этим данным выбираем время, когда у вас достаточно темно, а событие видно над горизонтом. Облака, свет фонарей и здания не учитываем.</p>
        <a href="https://github.com/cosinekitty/astronomy" target="_blank" rel="noreferrer">Источник расчётов — Astronomy Engine ↗</a>
      </details>
      <Button variant="ghost" onClick={onClose}>Закрыть</Button>
    </div>}
  </BottomSheet>;
}

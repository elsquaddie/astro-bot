import { calculateEvents } from './domain/astronomy';
import type { Place } from './domain/types';
self.onmessage = (message: MessageEvent<{ place: Place; now: string }>) => {
  try { self.postMessage({ events: calculateEvents(message.data.place, new Date(message.data.now)) }); }
  catch { self.postMessage({ error: 'Не удалось рассчитать события. Попробуйте ещё раз.' }); }
};

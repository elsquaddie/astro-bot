import { useEffect, useState } from 'react';
import type { Place, SkyEvent } from './domain/types';

export function useEvents(place: Place | null) {
  const [state, setState] = useState<{ events: SkyEvent[]; loading: boolean; error: string }>({ events: [], loading: false, error: '' });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!place) { setState({ events: [], loading: false, error: '' }); return; }
    const worker = new Worker(new URL('./events.worker.ts', import.meta.url), { type: 'module' });
    let active = true;
    setState({ events: [], loading: true, error: '' });
    worker.onmessage = e => {
      if (active) setState({ events: e.data.events ?? [], loading: false, error: e.data.error ?? '' });
      worker.terminate();
    };
    worker.onerror = () => {
      if (active) setState({ events: [], loading: false, error: 'Расчёт прервался. Попробуйте ещё раз.' });
      worker.terminate();
    };
    worker.postMessage({ place, now: new Date().toISOString() });
    // Keep a long-lived tab current; no stale results from a previous city.
    const timer = setInterval(() => setRevision(r => r + 1), 10 * 60_000);
    return () => { active = false; clearInterval(timer); worker.terminate(); };
  }, [place, revision]);
  return { ...state, retry: () => setRevision(r => r + 1) };
}

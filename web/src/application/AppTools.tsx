import { useEffect, useState } from 'react';
import { DownloadSimple } from '@phosphor-icons/react';
import { RemindersProvider } from './reminders';
import { useTelegram } from './telegram';
import Prototype from '../Prototype';
import { Button } from '../components/Button';

type InstallPrompt = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> };
export function Application() {
  const insideTelegram = useTelegram();
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(matchMedia('(display-mode: standalone)').matches);
  const [help, setHelp] = useState('');
  const [offline, setOffline] = useState(!navigator.onLine);
  const [ready, setReady] = useState(false);
  const [update, setUpdate] = useState<ServiceWorker | null>(null);
  useEffect(() => {
    const capture = (e: Event) => { e.preventDefault(); setPrompt(e as InstallPrompt); };
    const done = () => { setInstalled(true); setPrompt(null); setHelp(''); };
    const connection = () => setOffline(!navigator.onLine);
    window.addEventListener('beforeinstallprompt', capture); window.addEventListener('appinstalled', done);
    window.addEventListener('online', connection); window.addEventListener('offline', connection);
    let active = true;
    let controlled = !!navigator.serviceWorker?.controller;
    const controllerChanged = () => {
      if (controlled) location.reload();
      controlled = true;
    };
    navigator.serviceWorker?.addEventListener('controllerchange', controllerChanged);
    if (import.meta.env.PROD && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(registration => {
        const check = () => { if (active) setUpdate(registration.waiting); };
        check();
        registration.addEventListener('updatefound', () => registration.installing?.addEventListener('statechange', check));
        navigator.serviceWorker.ready.then(() => { if (active) setReady(true); });
      }).catch(() => { if (active) setHelp('Не удалось подготовить приложение для работы без сети.'); });
    }
    return () => { active = false;
      navigator.serviceWorker?.removeEventListener('controllerchange', controllerChanged);
      window.removeEventListener('beforeinstallprompt', capture); window.removeEventListener('appinstalled', done);
      window.removeEventListener('online', connection); window.removeEventListener('offline', connection);
    };
  }, []);
  async function install() {
    if (!prompt) { setHelp('В меню браузера выберите «Установить приложение» или «На экран Домой». На iPhone откройте меню «Поделиться» в Safari.'); return; }
    try { await prompt.prompt(); await prompt.userChoice; setPrompt(null); }
    catch { setHelp('Откройте меню браузера и выберите установку приложения.'); }
  }
  function refresh() {
    update?.postMessage({ type: 'ACTIVATE_UPDATE' });
  }
  return <RemindersProvider inside={insideTelegram}><Prototype tools={<aside className="app-tools" aria-label="Приложение">
    {!installed && !insideTelegram && <Button variant="secondary" onClick={install}><DownloadSimple size={20} />Установить приложение</Button>}
    {update && <Button variant="secondary" onClick={refresh}>Обновить приложение</Button>}
    <p className="sky-note" role="status">{offline ? 'Без сети. Поиск новых городов недоступен.' : ready ? 'События и сохранённое доступны без сети.' : ''}</p>
    {help && <p className="sky-note" role="status">{help}</p>}
  </aside>} /></RemindersProvider>;
}

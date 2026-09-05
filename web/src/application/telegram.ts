import { useEffect, useState } from 'react';

interface TelegramApp {
  initData: string;
  ready(): void;
  expand(): void;
  setHeaderColor(color: string): void;
  setBackgroundColor(color: string): void;
  safeAreaInset?: { top: number; bottom: number };
  contentSafeAreaInset?: { top: number; bottom: number };
  onEvent(name: string, callback: () => void): void;
  offEvent(name: string, callback: () => void): void;
}
declare global { interface Window { Telegram?: { WebApp?: TelegramApp } } }

export function useTelegram() {
  const [inside, setInside] = useState(() => !!window.Telegram?.WebApp?.initData ||
    new URLSearchParams(location.hash.slice(1)).has('tgWebAppData'));
  useEffect(() => {
    if (!inside) return;
    let app: TelegramApp | undefined;
    let active = true;
    const insets = () => {
      const top = (app?.safeAreaInset?.top ?? 0) + (app?.contentSafeAreaInset?.top ?? 0);
      const bottom = (app?.safeAreaInset?.bottom ?? 0) + (app?.contentSafeAreaInset?.bottom ?? 0);
      document.documentElement.style.setProperty('--telegram-safe-top', `${top}px`);
      document.documentElement.style.setProperty('--telegram-safe-bottom', `${bottom}px`);
    };
    const initialize = () => {
      if (!active) return;
      app = window.Telegram?.WebApp;
      if (!app?.initData) return;
      setInside(true); app.ready(); app.expand();
      app.setHeaderColor('#020611'); app.setBackgroundColor('#020611');
      insets(); app.onEvent('safeAreaChanged', insets); app.onEvent('contentSafeAreaChanged', insets);
    };
    let script = document.querySelector<HTMLScriptElement>('script[data-telegram-sdk]');
    if (window.Telegram?.WebApp) initialize();
    else {
      if (!script) {
        script = document.createElement('script'); script.dataset.telegramSdk = 'true';
        script.src = 'https://telegram.org/js/telegram-web-app.js?63'; script.async = true;
        document.head.append(script);
      }
      script.addEventListener('load', initialize);
    }
    return () => { active = false; script?.removeEventListener('load', initialize);
      app?.offEvent('safeAreaChanged', insets); app?.offEvent('contentSafeAreaChanged', insets); };
  }, [inside]);
  return inside;
}

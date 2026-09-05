import '../vendor/telegram-web-app.js';
import { useEffect, useState } from 'react';

interface TelegramApp {
  isVersionAtLeast(version: string): boolean;
  requestWriteAccess(callback: (granted: boolean) => void): void;
  LocationManager?: {
    isInited: boolean; isLocationAvailable: boolean; isAccessRequested: boolean; isAccessGranted: boolean;
    init(callback: () => void): void;
    getLocation(callback: (location: { latitude: number; longitude: number } | null) => void): void;
    openSettings(): void;
  };
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
      if (!app) return;
      app.ready();
      if (!app.initData) return;
      setInside(true); window.dispatchEvent(new Event('telegram-ready')); app.expand();
      app.setHeaderColor('#020611'); app.setBackgroundColor('#020611');
      insets(); app.onEvent('safeAreaChanged', insets); app.onEvent('contentSafeAreaChanged', insets);
    };
    initialize();
    return () => { active = false;
      app?.offEvent('safeAreaChanged', insets); app?.offEvent('contentSafeAreaChanged', insets); };
  }, [inside]);
  return inside;
}

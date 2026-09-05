import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const sdk = readFileSync(new URL('../src/vendor/telegram-web-app.js', import.meta.url), 'utf8');
function boot(hash: string) {
  const events: string[] = [];
  const storage = new Map<string,string>();
  const bridge = { postEvent(type: string) { events.push(type); } };
  const window: any = { innerHeight: 800, addEventListener() {}, removeEventListener() {}, TelegramWebviewProxy: bridge,
    sessionStorage: { getItem: (key:string) => storage.get(key) ?? null, setItem: (key:string,value:string) => storage.set(key,value) } };
  window.parent=window; window.top=window;
  const document = { documentElement: { style: { setProperty() {} } }, addEventListener() {}, removeEventListener() {} };
  const context=vm.createContext({window,document,location:{hash},TelegramWebviewProxy:bridge,console:{log(){},warn(){},error(){}},setTimeout,clearTimeout});
  vm.runInContext(sdk,context);
  return { app: window.Telegram.WebApp, events };
}
test('bundled SDK sends ready with no external network and retains signed launch data', () => {
  const data='auth_date=123&user=%7B%22id%22%3A42%7D&hash=signature';
  const {app,events}=boot('#tgWebAppVersion=8.0&tgWebAppPlatform=android&tgWebAppData='+encodeURIComponent(data));
  assert.equal(app.initData,data); app.ready(); assert.ok(events.includes('web_app_ready'));
  assert.ok(app.LocationManager); assert.equal(typeof app.requestWriteAccess,'function');
});
test('ready can dismiss Telegram placeholder even when authentication is absent', () => {
  const {app,events}=boot('#tgWebAppVersion=8.0&tgWebAppPlatform=android');
  assert.equal(app.initData,''); app.ready(); assert.ok(events.includes('web_app_ready'));
});

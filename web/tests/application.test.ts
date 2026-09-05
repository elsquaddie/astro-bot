import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../application/sw.js', import.meta.url), 'utf8')
  .replace('__CACHE_VERSION__', 'test').replace('__PRECACHE__', JSON.stringify(['/index.html', '/assets/app.js', '/assets/events.worker.js']));
function worker(clientUrls: string[] = []) {
  const listeners: Record<string, (event: any) => void> = {};
  const cached = new Map<string, Response>([['/index.html', new Response('offline shell', { headers: { 'Content-Type': 'text/html' } })], ['/assets/events.worker.js', new Response('astronomy worker')]]);
  const calls: string[] = [];
  const context = { URL, Response, self: { location: { origin: 'https://sky.test' }, clients: { claim: async () => {}, matchAll: async () => clientUrls.map(url => ({ url })) },
    skipWaiting: () => calls.push('activate'), addEventListener: (name: string, handler: any) => { listeners[name] = handler; } },
    caches: { open: async (name: string) => { calls.push(name); return { addAll: async (paths: string[]) => { calls.push(...paths); }, match: async (key: string) => {
      const response = cached.get(key)?.clone();
      // Hosting redirects /index.html to /; Cache.addAll retains the followed response.
      if (response && key === '/index.html') Object.defineProperty(response, 'redirected', { value: true });
      return response;
    } }; } },
    fetch: async () => { throw new Error('offline'); } };
  vm.runInNewContext(source, context);
  const request = async (url: string, mode = 'cors', method = 'GET') => {
    let response: Promise<Response> | undefined;
    listeners.fetch({ request: { url, mode, method }, respondWith: (value: Promise<Response>) => { response = value; } });
    return response;
  };
  return { listeners, calls, request };
}
test('offline navigation serves the app shell; astronomy worker stays available', async () => {
  const app = worker();
  const navigation = await app.request('https://sky.test/', 'navigate');
  assert.equal(navigation?.redirected, false, 'navigation must not receive a followed redirect');
  assert.equal(navigation?.headers.get('Content-Type'), 'text/html');
  assert.equal(await navigation?.text(), 'offline shell');
  assert.equal(await (await app.request('https://sky.test/?source=homescreen', 'navigate'))?.text(), 'offline shell');
  assert.equal(await (await app.request('https://sky.test/assets/events.worker.js'))?.text(), 'astronomy worker');
  assert.ok(app.calls.every(value => value === 'smotri-app-test'));
});
test('service worker does not intercept external geocoding, writes or unknown files', async () => {
  const app = worker();
  assert.equal(await app.request('https://geocoding-api.open-meteo.com/v1/search?name=Samara'), undefined);
  assert.equal(await app.request('https://sky.test/api/reminders', 'cors', 'POST'), undefined);
  assert.equal(await app.request('https://sky.test/unrelated.json'), undefined);
  assert.equal(await app.request('https://sky.test/api/health', 'navigate'), undefined);
  assert.equal(app.calls.length, 0);
});
test('repair activates only after all assets are cached, even without Telegram parameters', async () => {
  const app = worker();
  let completion: Promise<void> | undefined;
  app.listeners.install({ waitUntil: (value: Promise<void>) => { completion = value; } });
  assert.ok(completion); await completion;
  assert.ok(app.calls.includes('/assets/events.worker.js'));
  assert.ok(app.calls.indexOf('/assets/events.worker.js') < app.calls.indexOf('activate'));
  app.calls.length = 0;
  app.listeners.message({ data: { type: 'something-else' } });
  assert.ok(!app.calls.includes('activate'));
  app.listeners.message({ data: { type: 'ACTIVATE_UPDATE' } });
  assert.ok(app.calls.includes('activate'));
});

test('cached Telegram boot receives a complete update without needing the hidden update button', async () => {
  const app=worker(['https://sky.test/#tgWebAppPlatform=ios&tgWebAppData=launch']);
  let completion: Promise<void> | undefined;
  app.listeners.install({waitUntil: (value: Promise<void>) => { completion=value; }});
  assert.ok(completion); await completion;
  assert.ok(app.calls.includes('activate'));
  assert.ok(app.calls.indexOf('/assets/events.worker.js') < app.calls.indexOf('activate'));
});

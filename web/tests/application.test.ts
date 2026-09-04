import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../application/sw.js', import.meta.url), 'utf8')
  .replace('__CACHE_VERSION__', 'test').replace('__PRECACHE__', JSON.stringify(['/index.html', '/assets/app.js', '/assets/events.worker.js']));
function worker() {
  const listeners: Record<string, (event: any) => void> = {};
  const cached = new Map<string, string>([['/index.html', 'offline shell'], ['/assets/events.worker.js', 'astronomy worker']]);
  const calls: string[] = [];
  const context = { URL, self: { location: { origin: 'https://sky.test' }, clients: { claim: async () => {} },
    skipWaiting: () => calls.push('activate'), addEventListener: (name: string, handler: any) => { listeners[name] = handler; } },
    caches: { open: async (name: string) => { calls.push(name); return { addAll: async (paths: string[]) => { calls.push(...paths); }, match: async (key: string) => cached.get(key) }; } },
    fetch: async () => { throw new Error('offline'); } };
  vm.runInNewContext(source, context);
  const request = async (url: string, mode = 'cors', method = 'GET') => {
    let response: Promise<string> | undefined;
    listeners.fetch({ request: { url, mode, method }, respondWith: (value: Promise<string>) => { response = value; } });
    return response;
  };
  return { listeners, calls, request };
}
test('offline navigation serves the app shell; astronomy worker stays available', async () => {
  const app = worker();
  assert.equal(await app.request('https://sky.test/', 'navigate'), 'offline shell');
  assert.equal(await app.request('https://sky.test/?source=homescreen', 'navigate'), 'offline shell');
  assert.equal(await app.request('https://sky.test/assets/events.worker.js'), 'astronomy worker');
  assert.ok(app.calls.every(value => value === 'smotri-app-test'));
});
test('service worker does not intercept external geocoding, writes or unknown files', async () => {
  const app = worker();
  assert.equal(await app.request('https://geocoding-api.open-meteo.com/v1/search?name=Samara'), undefined);
  assert.equal(await app.request('https://sky.test/api/reminders', 'cors', 'POST'), undefined);
  assert.equal(await app.request('https://sky.test/unrelated.json'), undefined);
  assert.equal(app.calls.length, 0);
});
test('installation waits for all assets and only explicit update activates waiting worker', async () => {
  const app = worker();
  let completion: Promise<void> | undefined;
  app.listeners.install({ waitUntil: (value: Promise<void>) => { completion = value; } });
  assert.ok(completion); await completion;
  assert.ok(app.calls.includes('/assets/events.worker.js'));
  assert.ok(!app.calls.includes('activate'));
  app.listeners.message({ data: { type: 'something-else' } });
  assert.ok(!app.calls.includes('activate'));
  app.listeners.message({ data: { type: 'ACTIVATE_UPDATE' } });
  assert.ok(app.calls.includes('activate'));
});

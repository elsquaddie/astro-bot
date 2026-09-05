import { build } from 'vite';
import { mkdirSync, copyFileSync, readFileSync, writeFileSync, cpSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const dest = resolve(root, 'dist-telegram');
mkdirSync(dest + '/client', { recursive: true });
mkdirSync(dest + '/server', { recursive: true });
mkdirSync(dest + '/.openai', { recursive: true });
const sw = readFileSync(root + '/dist-app/sw.js', 'utf8');
const paths = JSON.parse(sw.match(/const PRECACHE = (.*);/)[1]);
for (const file of [...paths, '/sw.js']) {
  const target = dest + '/client' + file;
  mkdirSync(resolve(target, '..'), { recursive: true });
  copyFileSync(root + '/dist-app' + file, target);
}
await build({ configFile: false, publicDir: false, build: { ssr: root + '/telegram-server/index.mjs', outDir: dest + '/server', emptyOutDir: false,
  rolldownOptions: { output: { entryFileNames: 'index.js' } } }, ssr: { noExternal: true } });
cpSync(root + '/drizzle', dest + '/.openai/drizzle', { recursive: true });
writeFileSync(dest + '/.openai/hosting.json', readFileSync(root + '/.openai/hosting.json'));
console.log('Telegram build prepared');

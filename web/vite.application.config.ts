import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const root = import.meta.dirname;
export default defineConfig({
  root, publicDir: false,
  resolve: { alias: { '../platform': resolve(root, 'src/application/platform.tsx') } },
  plugins: [react(), {
    name: 'standalone-application',
    generateBundle() {
      for (const file of ['sky-night-moon.png', 'brand-mark.png', 'app-icon-192.png', 'app-icon-512.png']) {
        this.emitFile({ type: 'asset', fileName: `assets/${file}`, source: readFileSync(resolve(root, 'public/assets', file)) });
      }
      this.emitFile({ type: 'asset', fileName: 'app-icon.svg', source: readFileSync(resolve(root, 'public/assets/app-mark.svg')) });
      this.emitFile({ type: 'asset', fileName: 'manifest.webmanifest', source: JSON.stringify({
        id: '/', name: 'Смотри на небо.', short_name: 'Смотри на небо.', lang: 'ru', start_url: '/', scope: '/',
        display: 'standalone', background_color: '#020611', theme_color: '#020611',
        icons: [{ src: '/app-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/assets/app-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/assets/app-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }],
      }, null, 2) });
    },
    writeBundle(options, bundle) {
      const out = resolve(root, options.dir!);
      // The separate HTML input emits here; publish it as the standalone root.
      writeFileSync(resolve(out, 'index.html'), readFileSync(resolve(out, 'application/index.html')));
      const paths = ['/index.html', ...Object.keys(bundle).filter(path => !path.startsWith('application/')).map(path => '/' + path)];
      const hash = createHash('sha256');
      for (const path of paths.sort()) hash.update(path).update(readFileSync(out + path));
      const source = readFileSync(resolve(root, 'application/sw.js'), 'utf8')
        .replace('__CACHE_VERSION__', hash.digest('hex').slice(0, 16)).replace('__PRECACHE__', JSON.stringify(paths));
      writeFileSync(resolve(out, 'sw.js'), source);
    },
  }],
  build: { outDir: 'dist-app', emptyOutDir: false, rolldownOptions: { input: resolve(root, 'application/index.html') } },
});

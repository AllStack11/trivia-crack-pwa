import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare(), {
    name: 'version-service-worker',
    apply: 'build',
    async writeBundle(options) {
      if (!options.dir) throw new Error('Service worker versioning requires an output directory');
      const workerPath = path.resolve(options.dir, 'sw.js');
      const source = await readFile(workerPath, 'utf8');
      const marker = "const CACHE_NAME = 'trivia-clash-dev';";
      if (!source.includes(marker)) throw new Error('Service worker cache version marker is missing');
      await writeFile(workerPath, source.replace(marker, `const CACHE_NAME = 'trivia-clash-${randomUUID()}';`));
    }
  }],
  resolve: {
    alias: {
      '@trivia-clash/shared': path.resolve(import.meta.dirname, '../shared/src/index.ts')
    }
  },
  server: {
    port: 5173,
    fs: {
      allow: ['..']
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
});

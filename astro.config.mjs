// @ts-check
import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import sitemap from '@astrojs/sitemap'
import tailwindcss from '@tailwindcss/vite'

// Several dev servers may run side by side (one per port); give each its own
// Vite dependency cache so they never invalidate each other's optimised deps.
const portFlag = process.argv.indexOf('--port')
const devPort = portFlag > -1 ? process.argv[portFlag + 1] : null

// https://astro.build/config
export default defineConfig({
  site: 'https://onthisdevice.com',
  output: 'static',
  // URLs have no trailing slash (/merge-pdf); the host redirects /merge-pdf/.
  trailingSlash: 'never',
  // Astro 7's default ('jsx') drops the space between a word and an inline
  // link that starts on the next source line; keep whitespace-safe compression.
  compressHTML: true,
  integrations: [
    react(),
    sitemap({
      filter: (page) => !/\/(404|lab)(\/|$)/.test(new URL(page).pathname),
    }),
  ],
  devToolbar: { enabled: false },
  vite: {
    plugins: [tailwindcss()],
    cacheDir: devPort ? `node_modules/.vite/dev-${devPort}` : undefined,
    // ffmpeg.wasm + wasm codecs need these for SharedArrayBuffer / worker loading
    worker: { format: 'es' },
    optimizeDeps: {
      exclude: [
        '@ffmpeg/ffmpeg',
        '@ffmpeg/util',
        '@jsquash/jpeg',
        '@jsquash/png',
        '@jsquash/webp',
        '@jsquash/avif',
        '@jsquash/resize',
      ],
    },
    server: {
      // Scratch files, Python caches and vendored models are not site sources.
      watch: { ignored: ['**/scripts/.tmp/**', '**/public/models/**', '**/rust/target/**'] },
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      },
    },
  },
})

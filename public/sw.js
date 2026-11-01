/*
 * onthisdevice.com service worker: keeps the pages and code you have used
 * available offline. It caches only this site's own files, never anything
 * you open in a tool (those never reach the network at all).
 *
 *  - pages: network first, the cached copy when offline;
 *  - /_astro/ and /fonts/: cache first (file names change when contents do);
 *  - everything else from this site: cached copy now, refreshed in the
 *    background.
 * The FFmpeg core and the detection models keep their own caches (see
 * src/lib/ffmpeg-core.ts and src/lib/ml/assets.ts), so /ffmpeg/, /models/,
 * /ort/ and /ocr/ are left alone here.
 */
const VERSION = 'v2'
const PAGES = `otd-pages-${VERSION}`
const ASSETS = `otd-assets-${VERSION}`
const KEEP = new Set([PAGES, ASSETS])

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(PAGES)
      .then((c) => c.addAll(['/', '/all-tools', '/404']))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => /^otd-(pages|assets)-/.test(k) && !KEEP.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

const sameOrigin = (url) => url.origin === self.location.origin
const SELF_CACHED = /^\/(ffmpeg|models|ort|ocr)\//

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (!sameOrigin(url) || SELF_CACHED.test(url.pathname) || url.pathname === '/sw.js') return
  if (req.headers.has('range')) return

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(PAGES).then((c) => c.put(url.pathname, copy))
          }
          return res
        })
        .catch(async () => (await caches.match(url.pathname)) || (await caches.match('/404')) || Response.error()),
    )
    return
  }

  if (url.pathname.startsWith('/_astro/') || url.pathname.startsWith('/fonts/')) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone()
              caches.open(ASSETS).then((c) => c.put(req, copy))
            }
            return res
          }),
      ),
    )
    return
  }

  event.respondWith(
    caches.open(ASSETS).then(async (cache) => {
      const hit = await cache.match(req)
      const refresh = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(req, res.clone())
          return res
        })
        .catch(() => hit || Response.error())
      return hit || refresh
    }),
  )
})

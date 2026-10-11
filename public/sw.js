// VJNOTES service worker: makes the site installable and keeps it usable with a bad connection.
//   - Pages: network first, falling back to the last copy seen, then to /offline.
//   - Static build files and images: cache first (they never change for a given URL).
//   - Everything from other origins (Supabase data, uploaded PDFs, Google Drive) goes straight to the
//     network. Notes are never stored by the worker, so deleted or hidden notes can never linger.
const VERSION = 'vj-v1'
const PAGES = `${VERSION}-pages`
const STATIC = `${VERSION}-static`

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(PAGES).then((c) => c.add('/offline')).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  // Signed-in and API-ish routes must always be fresh.
  if (url.pathname.startsWith('/auth') || url.pathname.startsWith('/api') || url.pathname.startsWith('/admin')) return

  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/pdfjs/') || url.pathname.startsWith('/pwa/')) {
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const hit = await cache.match(req)
        if (hit) return hit
        const res = await fetch(req)
        if (res.ok) cache.put(req, res.clone())
        return res
      }),
    )
    return
  }

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(PAGES).then((c) => c.put(req, copy))
          }
          return res
        })
        .catch(async () => (await caches.match(req)) ?? (await caches.match('/offline')) ?? Response.error()),
    )
  }
})

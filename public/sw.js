// Service worker de la Agenda Territorial: guarda la app para abrirla sin conexión.
// Los datos (acciones) los guarda la propia app en el dispositivo; acá sólo se cachean páginas y archivos estáticos.
const VERSION = 'agenda-v2'
const PRECACHE = ['/', '/icons/icon-192.png', '/icons/icon-512.png', '/manifest.webmanifest']

self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()))
})

self.addEventListener('fetch', event => {
  const req = event.request
  if (req.method !== 'GET') return // las acciones del servidor (POST) van siempre a la red
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  // Archivos estáticos con hash: primero caché.
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/') || /\.(png|svg|jpg|webp|woff2?)$/.test(url.pathname)) {
    event.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); return res })))
    return
  }
  // Páginas: primero la red; sin conexión, la última copia guardada.
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put('/', copy)); return res }).catch(() => caches.match('/').then(hit => hit || Response.error())))
  }
})

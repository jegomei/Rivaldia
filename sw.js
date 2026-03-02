// ═══════════════════════════════════════════════════════════
//  sw.js — Service Worker de Rivaldia
//
//  ▶ Para publicar una actualización: cambia CACHE_VERSION
//    (p.ej. 'rivaldia-v2' → 'rivaldia-v3') y haz push.
//    La PWA se actualizará sola la próxima vez que se abra.
// ═══════════════════════════════════════════════════════════

const CACHE_VERSION = 'rivaldia-v3';

// Archivos que se pre-cachean al instalar el SW
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './style.css',
  './manifest.json',
  './icon.svg',
  './icon-32.png',
  './icon-192.png',
  './icon-512.png',
  './icon-180.png',
  './icon-maskable-192.png',
  './icon-maskable-512.png',
  './icons/sumplete.png',
  './icons/shikaku_easy.png',
  './icons/shikaku_medium.png',
  './icons/cinco.png',
  './icons/cuordle.png',
];

// ── Instalación: pre-cachear todos los assets estáticos ────
// Usamos cache:'reload' para saltarnos el HTTP cache del navegador
// y garantizar que siempre se cachea la versión más reciente del servidor.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache =>
      Promise.all(
        ASSETS.map(url =>
          fetch(new Request(url, { cache: 'reload' })).then(res => cache.put(url, res))
        )
      )
    )
  );
  // Activar de inmediato, sin esperar a que cierren otras pestañas
  self.skipWaiting();
});

// ── Activación: borrar cachés de versiones anteriores ──────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
      )
    )
  );
  // Tomar control de todos los clientes abiertos ya
  self.clients.claim();
});

// ── Fetch: caché primero para assets propios, red para APIs ─
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Firebase, Google APIs y juegos externos → siempre red
  if (
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('gstatic') ||
    url.hostname.includes('firebaseio') ||
    url.hostname.includes('puzzlepass') ||
    url.hostname.includes('sumplete') ||
    url.hostname.includes('shikaku') ||
    url.hostname.includes('jegomei.github.io')
  ) return;

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.status === 200 && response.type !== 'opaque') {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});

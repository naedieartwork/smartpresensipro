const CACHE_NAME = 'smart-presensi-shell-v6';

const STATIC_SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192x192.png',
  './icon-512x512.png',
];

// Daftar domain API / data real-time yang TIDAK BOLEH di-cache sama sekali (100% Network-Only)
const BYPASS_DOMAINS = [
  'supabase.co',
  'supabase.in',
  'script.google.com',
  'script.googleusercontent.com',
  'googleusercontent.com',
  'sidobe.com',
  'api.qrserver.com',
];

function shouldBypassCache(urlString) {
  try {
    const url = new URL(urlString);
    // Hanya tangani protokol http/https
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return true;
    }
    // Jangan pernah cache request ke Supabase, Google Apps Script, atau gateway WA
    if (BYPASS_DOMAINS.some((domain) => url.hostname.includes(domain))) {
      return true;
    }
    // Jangan cache endpoint API internal atau modul Vite Dev Server (.vite/deps, /src/, HMR)
    if (
      url.pathname.startsWith('/api/') ||
      url.pathname.startsWith('/rest/v1/') ||
      url.pathname.startsWith('/auth/v1/') ||
      url.pathname.startsWith('/realtime/') ||
      url.pathname.startsWith('/node_modules/') ||
      url.pathname.startsWith('/src/') ||
      url.pathname.startsWith('/@') ||
      url.searchParams.has('t') ||
      url.searchParams.has('v')
    ) {
      return true;
    }
    return false;
  } catch {
    return true;
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_SHELL_ASSETS))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
          return Promise.resolve();
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // 1. Jangan pernah cache method selain GET (POST/PUT/PATCH/DELETE ke Supabase/WA selalu langsung ke jaringan)
  if (request.method !== 'GET') {
    return;
  }

  // 2. Jangan pernah cache request API ke Supabase (supabase.co) maupun Google Apps Script (script.google.com)
  if (shouldBypassCache(request.url)) {
    return;
  }

  const url = new URL(request.url);

  // 3. Navigasi halaman HTML: Gunakan Network-First dengan fallback ke index.html di cache saat offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', copy));
          }
          return response;
        })
        .catch(() =>
          caches.match('./index.html').then((cached) => cached || caches.match('./'))
        )
    );
    return;
  }

  // 4. Aset Statis (UI Shell, CSS, JS, Font Google, Ikon):
  const isStaticAsset =
    url.origin === self.location.origin ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com');

  if (isStaticAsset) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            (networkResponse.type === 'basic' || networkResponse.type === 'cors')
          ) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => caches.match(request))
    );
  }
});

// 5. Pemicu Notifikasi Lokal (Local Notifications API) via Service Worker saat Scan Presensi berhasil
self.addEventListener('message', (event) => {
  const data = event.data;
  if (data && data.type === 'SHOW_SCAN_NOTIFICATION' && data.title) {
    event.waitUntil(
      self.registration.showNotification(data.title, data.options || {})
    );
  }
});

// 6. Fokuskan / Buka jendela aplikasi saat notifikasi presensi diklik oleh staf
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || './';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
        return undefined;
      })
  );
});


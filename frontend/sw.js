// frontend/sw.js
// Service Worker for ChatFlow PWA offline caching and installation support
const CACHE_NAME = 'chatflow-pwa-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/login.html',
  '/chat.html',
  '/css/main.css',
  '/css/chat.css',
  '/css/sidebar.css',
  '/css/auth.css',
  '/js/ui.js',
  '/js/api.js',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Network first fallback to cache
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
    return;
  }
  event.respondWith(
    fetch(event.request)
      .catch(() => caches.match(event.request))
  );
});

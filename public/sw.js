// Network-only worker, matching Caelum. Account pages and images are never cached.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;

  event.respondWith(fetch(event.request).catch(() => new Response(
    '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pixelar | Offline</title><body style="background:#080d17;color:#f3f7fd;font-family:sans-serif;padding:2rem"><h1>You are offline.</h1><p>Pixelar needs a connection to load and update your collection.</p><p>Reconnect, then reload this page.</p></body></html>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } },
  )));
});

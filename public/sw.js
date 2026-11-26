/*
 * Service worker do FOMO (PWA).
 * - Arquivos com hash (/_expo/static/*, /assets/*): cache-first — nunca mudam.
 * - Navegação (HTML): network-first com fallback ao último index.html salvo → abre offline.
 * - Supabase e tiles do mapa: NÃO passam por aqui (dados sempre frescos, sem cache de dados pessoais).
 */
const VERSION = 'fomo-v3';
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase, mapa etc.: direto na rede

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put('/', copy));
          return res;
        })
        .catch(() => caches.match('/')),
    );
    return;
  }

  if (url.pathname.startsWith('/_expo/static/') || url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(VERSION).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
  }
});

/* ---- Notificações push ---- */
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data && e.data.text() }; }
  const title = d.title || 'FOMO';
  const nudge = d.tag === 'nudge';
  const opts = {
    body: d.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-96.png',
    tag: d.tag || undefined,
    renotify: !!d.tag,
    vibrate: nudge ? [60, 40, 60, 40, 180] : [80],
    timestamp: Date.now(),
    data: { url: d.url || '/' },
    actions: nudge
      ? [{ action: 'open', title: 'Bora ver' }, { action: 'dismiss', title: 'Hoje não' }]
      : d.tag === 'group_invite'
        ? [{ action: 'open', title: 'Ver convite' }]
        : [],
  };
  // banner da marca (Android/desktop mostram; iPhone ignora e fica só o texto)
  if (d.image && /^\/push\/[a-z0-9-]+\.png$/.test(d.image)) opts.image = d.image;
  e.waitUntil(self.registration.showNotification(title, opts));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  if (e.action === 'dismiss') return;
  const url = new URL((e.notification.data && e.notification.data.url) || '/', self.location.origin).href;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.startsWith(self.location.origin) && 'focus' in c) { c.navigate(url).catch(() => {}); return c.focus(); }
      }
      return self.clients.openWindow(url);
    }),
  );
});

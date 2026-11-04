// Dossier TP – fonctionnement hors connexion
const CACHE = 'dossier-tp-v6';
const FICHIERS = ['./', 'index.html', 'config.js', 'data.js?v=6', 'editors.js?v=6', 'correction.js?v=6', 'app.js?v=6', 'aide.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FICHIERS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  const local = url.origin === location.origin;
  const polices = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!local && !polices) return; // le script Google : toujours par le réseau
  e.respondWith(caches.open(CACHE).then(async c => {
    const enCache = await c.match(req, { ignoreSearch: local && url.pathname.endsWith('config.js') });
    const reseau = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()); return r; }).catch(() => enCache);
    if (local && (url.pathname.endsWith('/') || url.pathname.endsWith('.html') || url.pathname.endsWith('/aide.html') || url.pathname.endsWith('config.js'))) return reseau.then(r => r || enCache);
    return enCache || reseau;
  }));
});

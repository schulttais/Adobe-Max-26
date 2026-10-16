// build 4.0b911aa
const C = 'mo-max-v3';
const IMG = 'mo-max-img-v1';
const ASSETS = ['./', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'];
const HOME = new URL('./', self.registration.scope).href;
self.addEventListener('install', e => { e.waitUntil(caches.open(C).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' }))))); self.skipWaiting() });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C && k !== IMG).map(k => caches.delete(k)))).then(() => self.clients.claim())) });
const sig = r => r && (r.headers.get('etag') || r.headers.get('last-modified') || '');
async function refresh(key, req) {
  const cache = await caches.open(C);
  const old = await cache.match(key);
  const res = await fetch(req, { cache: 'no-cache' });
  if (!res.ok) return res;
  let changed = !old;
  if (old) {
    const a = sig(old), b = sig(res);
    changed = a && b && a === b ? false : (await old.clone().text()) !== (await res.clone().text());
  }
  if (changed) {
    await cache.put(key, res.clone());
    if (old) (await self.clients.matchAll({ type: 'window' })).forEach(c => c.postMessage({ type: 'updated' }));
  }
  return res;
}
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.hostname === 'static.rainfocus.com') {
    e.respondWith(caches.open(IMG).then(c => c.match(req.url).then(hit => hit || fetch(req.url, { mode: 'cors', credentials: 'omit' })
      .then(r => { if (r.ok) c.put(req.url, r.clone()).catch(() => {}); return r })
      .catch(() => fetch(req)))));
    return;
  }
  if (u.origin !== location.origin) return;
  const isPage = req.mode === 'navigate' || u.href === HOME || u.pathname.endsWith('/index.html');
  const key = isPage ? HOME : req.url;
  e.respondWith(caches.match(key, { ignoreSearch: isPage }).then(hit => {
    const net = refresh(key, isPage ? HOME : req);
    if (hit) { e.waitUntil(net.catch(() => {})); return hit }
    return net.catch(() => caches.match(HOME));
  }));
});

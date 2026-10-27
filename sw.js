/* ROBIN Arcade service worker: makes the site installable and fast on repeat visits.
   Pages: network first (always fresh), falling back to cache when offline.
   Images, clips, scripts: cache first. Other sites (DEX Screener, fonts) are not touched. */
var CACHE = 'robin-arcade-v6';
var CORE = ['./', 'index.html', 'game.html', 'profile.html', 'kit.html', 'faq.html', 'leaderboard.html', 'styles.css', 'site.js', 'data.js', 'assets/robin.jpg', 'assets/icon-192.png'];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(CORE); }).then(function () { return self.skipWaiting(); })); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.indexOf('/api/') === 0 || url.pathname.indexOf('/admin') === 0) return;
  var isPage = req.mode === 'navigate' || /\.(html|js|css|webmanifest)$/.test(url.pathname) || url.pathname.endsWith('/');
  if (isPage) {
    e.respondWith(fetch(req).then(function (r) { var c = r.clone(); caches.open(CACHE).then(function (k) { k.put(req, c); }); return r; })
      .catch(function () { return caches.match(req).then(function (m) { return m || caches.match('index.html'); }); }));
  } else {
    e.respondWith(caches.match(req).then(function (m) {
      return m || fetch(req).then(function (r) { if (r.ok && !req.headers.get('range')) { var c = r.clone(); caches.open(CACHE).then(function (k) { k.put(req, c); }); } return r; });
    }));
  }
});

/* Offline cache for QuranFlow. The version changes whenever any file changes. */
const CACHE = "quranflow-2073bf0e4d35";
const ASSETS = ["./", "index.html", "install.html", "app.js", "manifest.webmanifest", "data/index.js", "data/search.js", "fonts/Alegreya-normal-700-latin-ext.woff2", "fonts/Alegreya-normal-700-latin.woff2", "fonts/AlegreyaSans-italic-400-latin-ext.woff2", "fonts/AlegreyaSans-italic-400-latin.woff2", "fonts/AlegreyaSans-normal-400-latin-ext.woff2", "fonts/AlegreyaSans-normal-400-latin.woff2", "fonts/AlegreyaSans-normal-500-latin-ext.woff2", "fonts/AlegreyaSans-normal-500-latin.woff2", "fonts/AlegreyaSans-normal-700-latin-ext.woff2", "fonts/AlegreyaSans-normal-700-latin.woff2", "fonts/AmiriQuran-normal-400-arabic.woff2", "fonts/AmiriQuran-normal-400-latin.woff2", "fonts/fonts.css", "icons/apple-touch-icon.png", "icons/favicon-32.png", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    // "juzmap-" caches are the old juz-memory-map site's, on the same origin
    .then(keys => Promise.all(keys.filter(k => k.startsWith("juzmap-") || (k.startsWith("quranflow-") && k !== CACHE)).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
const store = (req, res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; };
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin || url.pathname.includes("/admin/")) return;   // the analytics page is always live
  // The page, the app code and the surah list: answer from the cache at once, then ask the server in the
  // background and keep the answer for next time (stale-while-revalidate). These three used to be fetched with
  // cache:"no-cache" and awaited before the app could draw, so every single launch paid a network round trip
  // before the first pixel — on a phone that is what "slow to open" and "glitchy" actually were, and a stalled
  // connection hung the launch outright because only an out-and-out failure fell back to the cache.
  // A new build still arrives promptly: it is fetched here in the background and, because a deploy changes
  // CACHE, the next service worker precaches the new shell and drops the old one wholesale.
  const shell = req.mode === "navigate" || url.pathname.endsWith("/") || /(index\.html|app\.js|data\/index\.js)$/.test(url.pathname);
  if (shell) {
    e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => {
      const net = fetch(req.url, { cache: "no-cache", credentials: "same-origin" })
        .then(res => store(req, res))
        .catch(() => hit || caches.match("index.html"));
      e.waitUntil(net.catch(() => {}));   // the worker stays alive for the background copy even after we answer
      return hit || net;
    }));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => store(req, res))));
});

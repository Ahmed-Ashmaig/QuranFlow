/* Offline cache for QuranFlow. The version changes whenever any file changes. */
const CACHE = "quranflow-bde19c2c1830";
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
  // Anything this handler throws must end up as "not handled", never as a failed response. respondWith on a
  // rejected promise is a network error, and for a navigation a network error is a blank white page.
  try { handle(e); } catch (err) { /* fall through to the network */ }
});
function handle(e) {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin || url.pathname.includes("/admin/")) return;   // the analytics page is always live
  // The page, the app code and the surah list: answer from the cache at once, then ask the server in the
  // background and keep the answer for next time (stale-while-revalidate). Awaiting a conditional request before
  // the app could draw cost a network round trip on every launch, and a stalled connection hung the launch,
  // because only an out-and-out failure fell back to the cache.
  //
  // The fetch is started and waitUntil is called HERE, synchronously, while the event is still active. Calling
  // waitUntil later — inside the .then() of a caches.match — throws InvalidStateError, which rejects
  // respondWith and hands the browser a failed navigation: a blank white page, on this load and every one after
  // it. That shipped on 2026-09-27 and is what a "blank screen on opening the app" was.
  const shell = req.mode === "navigate" || url.pathname.endsWith("/") || /(index\.html|app\.js|data\/index\.js)$/.test(url.pathname);
  if (shell) {
    const net = fetch(req.url, { cache: "no-cache", credentials: "same-origin" }).then(res => store(req, res));
    e.waitUntil(net.catch(() => {}));
    e.respondWith(caches.match(req, { ignoreSearch: true })
      .then(hit => hit || net)
      .catch(() => net.catch(() => caches.match("index.html"))));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true })
    .then(hit => hit || fetch(req).then(res => store(req, res)))
    .catch(() => fetch(req)));
}

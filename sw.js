// Offline support: everything the app needs is cached on install.
// Bump VERSION whenever any file changes so phones pick up the update.
const VERSION = "pap-v1.6.0";
const FILES = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/app.css",
  "js/app.js",
  "js/ai.js",
  "js/auth.js",
  "js/config.js",
  "js/content.js",
  "js/fsrs.js",
  "js/install.js",
  "js/nav.js",
  "js/speech.js",
  "js/store.js",
  "js/sync.js",
  "js/text.js",
  "js/theme.js",
  "js/time.js",
  "js/tour.js",
  "js/ui.js",
  "js/views/home.js",
  "js/views/notebook.js",
  "js/views/onboarding.js",
  "js/views/path.js",
  "js/views/practice.js",
  "js/views/profile.js",
  "js/views/session.js",
  "content/a1.json",
  "content/a2.json",
  "content/b1.json",
  "content/b2.json",
  "content/c1.json",
  "content/mamie.json",
  "icons/icon.svg",
  "icons/apple-touch-icon.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(VERSION).then((c) => Promise.all(FILES.map((f) => c.add(new Request(f, { cache: "reload" })).catch(() => {}))))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;

  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match("index.html")));
    return;
  }
  // Stale-while-revalidate: instant from cache, refreshed in the background.
  e.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: true });
      const fresh = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || fresh;
    })
  );
});

const SHELL = "th-shell-v1";
const DATA = "th-data-v1";
const LIBS = "th-libs-v1";
const TILES = "th-tiles-v1";
const DOCS = "th-docs-v1";
const KEEP = [SHELL, DATA, LIBS, TILES, DOCS];

const SHELL_FILES = [
  "./", "index.html", "styles.css", "config.js", "app.js",
  "offline-auth.js", "theme.js", "autocomplete.js", "documents.js", "photos.js",
  "members.js", "budget.js", "overview.js", "weather.js", "packing.js",
  "tripedit.js", "tripdelete.js", "offline.js", "idle.js", "resume.js",
  "manifest.webmanifest", "apple-touch-icon-v2.png", "icon-192-v2.png", "icon-512-v2.png"
];

const LIB_FILES = [
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
  "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png"
];

const LIB_HOSTS = ["cdn.jsdelivr.net", "unpkg.com", "fonts.googleapis.com", "fonts.gstatic.com"];

const wait = (ms, value) => new Promise((resolve) => setTimeout(() => resolve(value), ms));

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const shell = await caches.open(SHELL);
      await Promise.all(
        SHELL_FILES.map((f) => shell.add(new Request(f, { cache: "reload" })).catch(() => {}))
      );
      const libs = await caches.open(LIBS);
      await Promise.all(LIB_FILES.map((f) => libs.add(f).catch(() => {})));
      self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => !KEEP.includes(n)).map((n) => caches.delete(n)));
      await self.clients.claim();
    })()
  );
});

async function clean(resp) {
  if (!resp.redirected) return resp;
  return new Response(await resp.blob(), {
    status: resp.status,
    statusText: resp.statusText,
    headers: resp.headers
  });
}

async function handleNavigation(req) {
  const cache = await caches.open(SHELL);
  const fresh = new Request(req.url, { cache: "no-cache", credentials: "same-origin" });

  const network = fetch(fresh).then(async (resp) => {
    if (!resp.ok) throw new Error("bad response");
    cache.put("index.html", resp.clone());
    return clean(resp);
  });

  const cached = await cache.match("index.html");
  if (!cached) return network.catch(() => Response.error());
  return Promise.race([network.catch(() => cached), wait(6000, cached)]);
}

async function networkFirst(req, cacheName, ms) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req, { ignoreSearch: true });

  const network = fetch(req, { cache: "no-cache" }).then((resp) => {
    if (resp.ok) {
      cache.put(req, resp.clone());
      return resp;
    }
    return cached || resp;
  });

  if (!cached) return network;
  return Promise.race([network.catch(() => cached), wait(ms, cached)]);
}

async function dataFirst(req) {
  const cache = await caches.open(DATA);
  const key = req.url;
  const cached = await cache.match(key, { ignoreVary: true });

  const network = fetch(req).then((resp) => {
    if (resp.ok) {
      cache.put(key, resp.clone());
      return resp;
    }
    if (cached && resp.status >= 500) return cached;
    return resp;
  });

  if (!cached) return network;
  return Promise.race([network.catch(() => cached), wait(8000, cached)]);
}

async function trim(cache, max) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

async function cacheFirst(req, cacheName, max) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;

  const resp = await fetch(req);
  if (resp.ok || resp.type === "opaque") {
    cache.put(req, resp.clone());
    trim(cache, max);
  }
  return resp;
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);

  const update = fetch(req)
    .then((resp) => {
      if (resp.ok || resp.type === "opaque") cache.put(req, resp.clone());
      return resp;
    })
    .catch(() => null);

  if (hit) return hit;
  return (await update) || Response.error();
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  if (req.mode === "navigate" && url.origin === self.location.origin) {
    event.respondWith(handleNavigation(req));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(req, SHELL, 6000));
    return;
  }

  if (url.hostname.endsWith(".supabase.co") && url.pathname.indexOf("/rest/v1/") === 0) {
    event.respondWith(dataFirst(req));
    return;
  }

  if (url.hostname.endsWith("tile.openstreetmap.org")) {
    event.respondWith(cacheFirst(req, TILES, 150));
    return;
  }

  if (LIB_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(req, LIBS));
  }
});

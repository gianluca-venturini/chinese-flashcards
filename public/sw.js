const CACHE_VERSION = 1;
const SHELL_CACHE = `app-shell-v${CACHE_VERSION}`;
const STATIC_CACHE = `static-v${CACHE_VERSION}`;

// Required assets — install fails if any of these can't be fetched.
const PRECACHE_REQUIRED = ['/offline.html', '/manifest.webmanifest'];

// Navigation pages — precached best-effort so they are available offline
// immediately after the first install, without waiting for the user to visit
// each page individually. Promise.allSettled means a single failure (e.g.
// server error on one route) doesn't abort the whole install.
const PRECACHE_PAGES = ['/', '/words', '/admin'];

// Bundled data files — precached best-effort so they are available offline
// from the first install. The pinyin table is large-ish (~157 KB) but is
// immutable for a given app version (cache busts via CACHE_VERSION).
const PRECACHE_DATA = ['/data/hanzi-pinyin-table.json'];

const NETWORK_TIMEOUT_MS = 5000;

// ─── Install ──────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await cache.addAll(PRECACHE_REQUIRED);
      await Promise.allSettled(PRECACHE_PAGES.map((url) => cache.add(url)));
      const staticCache = await caches.open(STATIC_CACHE);
      await Promise.allSettled(PRECACHE_DATA.map((url) => staticCache.add(url)));
      await self.skipWaiting();
    })(),
  );
});

// ─── Activate ─────────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  const current = new Set([SHELL_CACHE, STATIC_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !current.has(k)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Race a fetch against a wall-clock timeout.
// IMPORTANT: we do NOT wrap `request` in `new Request(request, { signal })`
// because browser navigate-mode requests cannot be safely reconstructed —
// doing so strips `Sec-Fetch-Mode: navigate`, causing Next.js to return an
// RSC payload instead of full HTML. Using fetch(request) directly preserves
// the original request object and all its headers.
function withTimeout(fetchPromise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('sw-timeout')), ms);
    fetchPromise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests.
  if (url.origin !== self.location.origin) return;

  const { pathname } = url;

  // NetworkOnly: API endpoints, auth flows, all mutations.
  // IDB is the source of truth; API failures are already handled gracefully.
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/handler/') ||
    pathname.startsWith('/auth/') ||
    request.method !== 'GET'
  ) {
    return;
  }

  // CacheFirst: bundled data files under /data/ (e.g. the pinyin table).
  // They are versioned in lockstep with the app via CACHE_VERSION, so once
  // cached they can be served without ever touching the network again.
  if (pathname.startsWith('/data/')) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request, { ignoreVary: true });
        if (cached) return cached;
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      }),
    );
    return;
  }

  // CacheFirst: Next.js static chunks (immutable hashed URLs).
  if (pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request, { ignoreVary: true });
        if (cached) return cached;
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      }),
    );
    return;
  }

  // StaleWhileRevalidate: Next.js image optimisation (no images yet, future-proof).
  if (pathname.startsWith('/_next/image')) {
    event.respondWith(
      caches.open(SHELL_CACHE).then(async (cache) => {
        const cached = await cache.match(request, { ignoreVary: true });
        const revalidate = fetch(request).then((res) => {
          if (res.ok) cache.put(request, res.clone());
          return res;
        });
        return cached ?? revalidate;
      }),
    );
    return;
  }

  // NetworkFirst: HTML page navigations.
  // On success the fresh response is written back into SHELL_CACHE, keeping
  // the precached copy up to date for the next offline visit.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(SHELL_CACHE);
        try {
          const res = await withTimeout(fetch(request), NETWORK_TIMEOUT_MS);
          if (res.ok) cache.put(request, res.clone());
          return res;
        } catch {
          // Network failed or timed out — serve from cache.
          const cached = await cache.match(request, { ignoreVary: true });
          if (cached) return cached;
          // Last resort: offline fallback page.
          return (
            (await cache.match('/offline.html', { ignoreVary: true })) ??
            new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } })
          );
        }
      })(),
    );
    return;
  }

  // Everything else: NetworkOnly (fall through to browser default).
});

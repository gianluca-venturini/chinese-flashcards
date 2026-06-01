# Offline Service Worker — Implementation Plan

## Goal

Make the flashcard app usable offline. After the first online visit, a user can
open the app with no network and:

1. Load the app shell (`/`, `/words`, `/admin`) from cache.
2. Review flashcards (read words from IndexedDB, swipe, update SR-state locally).
3. Edit translations / add new words (purely local writes).

Sync (`POST/PUT /api/words`, AI helpers) stays best-effort, exactly as today.
This plan does **not** rebuild sync — it adds the service worker plumbing that
makes the rest of the app work without network, and notes what would have to
change in `lib/sync.ts` later for a true offline-first sync layer.

## Non-goals (for this plan)

- Background sync of mutations (queued PUTs while offline). Listed as TODO.
- Offline AI features (classify / translate / examplify / pinyin). These are
  inherently online; we degrade gracefully.
- Offline sign-in/sign-out (Stack Auth requires network).

## Current state — what already works offline

Local-first storage was completed in PR #2 / #3. The relevant invariants:

- `src/lib/storage.ts` — every read/write goes through IndexedDB
  (`chinese-flashcards`, store `words`, keyed by `chinese`). No network.
- `src/lib/review.ts:submitReview` — applies SM-2 locally, persists to IDB,
  then calls `ensureWords([persisted])` (best-effort PUT). The local write is
  committed before the network call, so a failure does not lose state.
- `src/app/page.tsx`, `src/app/words/page.tsx` — on mount they `try { await
  syncFromServer() } catch { console.warn }` and then read from IDB. Network
  failure is non-fatal.
- All mutating call sites in `UploadButton`, `ClassifyButton`,
  `ResetStatsButton`, `WordsPage` follow the same pattern: write to IDB →
  best-effort `ensureWords` → continue.

What **does not** work offline today:

1. **Initial HTML / JS / CSS load** — Next.js needs to serve them. Without a
   service worker, an offline navigation simply fails.
2. **Root layout SSR** — `src/app/layout.tsx:24` (`UserInfoBar`) is an `async`
   server component calling `stackServerApp.getUser()`. Even a cached HTML
   page must be servable without re-running this on the server.
3. **Network failures are noisy** — `syncFromServer` throws and gets logged.
   No UI cue that the user is offline.

## Architecture

### Approach

A hand-written `public/sw.js` plus a web app manifest. No third-party PWA
plugin. The app is small (3 pages, ~5 public asset routes, a handful of API
routes) and the caching rules fit in ~150 lines, so the dependency overhead
and Next 16 compatibility risk of `@serwist/next` / `next-pwa` are not worth
paying. The service worker handles offline behavior; the manifest is what
makes the app installable to the home screen and launchable in
standalone display mode (no browser chrome) — the realistic use case for
"open the flashcards on the subway."

### File layout

```
public/
  sw.js                # service worker — checked in, served at /sw.js
  manifest.webmanifest # PWA manifest
  icons/
    icon-192.png
    icon-512.png
    icon-maskable-512.png
src/app/
  layout.tsx           # add <link rel="manifest"> + theme-color meta
  components/
    ServiceWorkerRegistrar.tsx  # client component, registers /sw.js on mount
    OfflineBadge.tsx            # client component, shows "Offline" pill
```

`public/sw.js` is shipped as-is (not bundled). It is small and has no imports;
keeping it out of the Next build avoids hashing issues and means the URL is
stable, which matters because the browser keys SWs by URL.

### Service worker — caching strategies

The SW maintains two named caches. Versioning is via a `CACHE_VERSION`
constant; bumping it on deploy purges the old caches in `activate`.

| Cache | Strategy | What goes in |
|---|---|---|
| `app-shell-v{N}` | Precache on `install` + updated on each successful navigation | `/`, `/words`, `/admin`, `/manifest.webmanifest`, `/offline.html` fallback |
| `static-v{N}` | CacheFirst, no expiry | `/_next/static/*` (immutable, hashed) |

Per-route rules in the `fetch` listener:

- **Navigation requests** (`request.mode === 'navigate'`): NetworkFirst (5s
  timeout) → write fresh response into `app-shell-v{N}` → serve; on failure
  serve from `app-shell-v{N}` (stale but works) or `/offline.html`.
  **Important**: use `fetch(request)` directly, never `new Request(request, {signal})`.
  Browser navigate-mode requests cannot be reconstructed — recreating them strips
  `Sec-Fetch-Mode: navigate`, causing Next.js to return an RSC payload instead
  of full HTML.
- **`/_next/static/*`**: CacheFirst into `static-v{N}`. These URLs are hashed,
  so they are safe to cache forever.
- **`/_next/image*`**: StaleWhileRevalidate (currently no images, future-proof).
- **`/api/*`**: NetworkOnly. IDB is the source of truth; all API failures are
  already handled gracefully by the app.
- **`/handler/*`** (Stack Auth): NetworkOnly. Never cache auth.
- **`/auth/*`**: NetworkOnly.
- **Anything else under same origin not matching the above**: NetworkOnly.
- **Cross-origin** (e.g. Google Fonts via `next/font`): the Geist fonts are
  self-hosted by `next/font/google` and end up under `/_next/static`, so they
  fall under the static rule.

Navigation pages (`/`, `/words`, `/admin`) are precached at install via
`Promise.allSettled` (best-effort — a single failure doesn't abort the install).
`cache.match` always uses `{ ignoreVary: true }` to avoid mismatches from
Next.js `Vary: RSC, Next-Router-State-Tree, ...` response headers.

### Handling the SSR layout

`UserInfoBar` is an async server component. When the SW serves a cached HTML
page offline, the HTML still contains whatever username was rendered at cache
time. That is acceptable — the user is signed in, the bar shows their last
known display name, and the next online navigation refreshes it.

We do **not** need to convert the layout to client rendering. We do need to
make sure the cached HTML is not user-specific in a way that leaks across
accounts on a shared device. Since sign-out runs `signOutAndWipe` →
`clearAll()` then redirects to `/handler/sign-out`, we should also unregister
the SW and purge caches during sign-out. Add to `lib/signOut.ts`:

```ts
// pseudo
await caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))));
const reg = await navigator.serviceWorker.getRegistration();
await reg?.unregister();
```

### Registration

`ServiceWorkerRegistrar.tsx` is a `"use client"` component rendered once from
`layout.tsx` (next to `UserInfoBar`). It registers `/sw.js` after `load`, in
production only (`process.env.NODE_ENV === 'production'`), to avoid stale-SW
pain during `next dev`. It also wires a one-time `controllerchange` reload so
new SW versions take effect immediately after activation.

### PWA manifest

`public/manifest.webmanifest`:

```json
{
  "name": "Chinese Flashcards",
  "short_name": "Flashcards",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0a0a0a",
  "theme_color": "#0a0a0a",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

Add to `layout.tsx` metadata:
- `<link rel="manifest" href="/manifest.webmanifest" />`
- `<meta name="theme-color" content="#0a0a0a" />`
- `<link rel="apple-touch-icon" href="/icons/icon-192.png" />`

Icons need to be created (any size, transparent or solid). Placeholder: render
a 中 glyph on the theme background.

### Offline UI affordances

Two small client components:

1. **`OfflineBadge.tsx`** — listens to `window.online/offline` and shows a
   small pill in the `UserInfoBar` when offline. Mounts cheaply, no other
   side effects.
2. The existing `syncError` toast in `src/app/page.tsx:177` already covers
   review failures. When offline we should suppress it for "expected" network
   errors and show a quieter offline indicator instead — gate the toast on
   `navigator.onLine`.

## Implementation steps

Each step is a single commit. Order matters: SW + manifest first, then UX.

1. **Add manifest + icons.** `public/manifest.webmanifest`, `public/icons/*`,
   update `layout.tsx` metadata. Verify Lighthouse PWA section picks it up.

2. **Add `public/sw.js`.** Implement install/activate/fetch with the strategy
   table above. `CACHE_VERSION` lives at the top.

3. **Add `ServiceWorkerRegistrar`.** Render from `layout.tsx`. Guard on
   `'serviceWorker' in navigator` and `NODE_ENV === 'production'`.

4. **Build a `/offline.html` fallback route.** Could be a static file in
   `public/`, or a `src/app/offline/page.tsx` that we precache. Static file is
   simpler — keep it as `public/offline.html`.

5. **Wire sign-out cleanup.** Extend `lib/signOut.ts` to unregister SW and
   purge caches before redirect.

6. **Add `OfflineBadge`.** Mount in `UserInfoBar` (next to user name) and gate
   the sync-error toast in `page.tsx` on `navigator.onLine`.

7. **Manual verification.** See "Testing" below.

## Testing

Service workers are stateful and easy to break invisibly. Verify each:

- **First visit online** → SW installs, app shell precaches, normal flow works.
- **Reload offline** → all three pages render from cache, flashcard review
  works (swipe, reveal, next), edits persist to IDB.
- **Cold install offline** (clear IDB, then go offline, then reload) → app
  shell loads, flashcard page shows "All finished" because IDB is empty. Not
  great UX but expected; do not try to "fix" this without a real sync queue.
- **Mutations while offline** → write to IDB succeeds, PUT fails silently,
  offline badge visible, no scary toast.
- **Coming back online** → existing `syncFromServer` runs on next navigation;
  changes flow up via the existing best-effort `ensureWords` on subsequent
  edits. (Full reconciliation of offline mutations is TODO §1.)
- **Cache busting on deploy** → bump `CACHE_VERSION`, deploy, reload twice
  (first reload activates the new SW, the controllerchange handler reloads
  once more).
- **Sign out** → SW unregistered, caches purged, next login starts clean.

## TODOs to fully support offline mode

These are deliberately out of scope for the SW work. They live in
`lib/sync.ts` and the call sites, not in the service worker.

### 1. Outbox / background sync of mutations

Today, when `submitReview` → `ensureWords` fails while offline, the local
write is preserved but the server is never told about it until the next time
the user happens to call `ensureWords` on the *same* row (which usually
happens on the next review of that word). For words that get edited offline
once and never touched again, the change can sit unsynced until a full
`syncBidirectional` runs from the admin panel.

To fix:

- Add an `outbox` IDB object store keyed by `chinese`, value = `{ updated_at }`
  marking "this row has a pending push".
- `putWord` writes to both `words` and `outbox` in the same transaction.
- A flusher (`flushOutbox`) reads the outbox, fetches matching rows from
  `words`, calls `putWords`, and deletes rows from the outbox on success.
- Trigger `flushOutbox` from: `window.addEventListener('online', ...)`, on
  app mount after `syncFromServer`, and optionally from the SW via the
  [Background Sync API](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API)
  (`registration.sync.register('flush-outbox')` + an SW `sync` event that
  posts a message back to the page to run `flushOutbox`, since the SW itself
  can't easily access the page's IDB connection cache).
- Background Sync is Chromium-only — Safari/Firefox need the `online`
  listener as the fallback path, which is fine.

### 2. Conflict resolution under concurrent offline edits

`reconcile` in `lib/sync.ts:11` is last-write-wins by `updated_at`. If two
devices edit the same word offline and both come online, the later
`updated_at` wins and the earlier edit is silently dropped. For a
single-user app that is acceptable; document it. If we want better:

- Per-field merge (e.g. SR-state always takes the higher `n`, translations
  take the most-recently-edited string).
- Or a vector clock / per-device sequence number.

### 3. Online/offline detection in shared state

Replace ad-hoc `navigator.onLine` reads with a small hook
(`useOnlineStatus`) so all components show consistent state. Currently the
only consumer is the offline badge, but the words page and admin sync
buttons should also disable themselves cleanly.

### 4. AI features under offline

`UploadButton` parses XML client-side and writes to IDB — already works
offline. The other AI buttons (`ClassifyButton`, translate/examplify in
`words/page.tsx`) need the network. Disable them while offline and surface
a tooltip ("requires connection"). They already handle failure, but the UX
is "click → wait → error", which is worse than "button is greyed out".

### 5. Sign-in/out under offline

- Sign-in requires network (Stack Auth). The `/auth/signin` page should
  detect offline and show a friendly message instead of a broken Stack widget.
- Sign-out currently calls `/handler/sign-out` which requires network. The
  local data wipe (`clearAll`) can still happen offline; we'd just leave the
  Stack session valid server-side until the user reconnects. Decide: wipe
  locally + queue the server signout, or refuse to sign out offline.

### 6. First-load offline

Today, if a user installs the PWA but their first launch is offline, IDB is
empty and they see "All finished". Could ship a tiny seed dataset or simply
require one online launch before offline works — the latter matches
expectations for PWAs and is what this plan assumes.

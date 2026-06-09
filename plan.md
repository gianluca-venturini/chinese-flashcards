# Bulk-add Chinese words from CSV

## Goal
On the words list table view, add an "Add multiple" button. It opens a modal
where the user pastes a CSV of hanzi (one word per cell, separated by commas
and/or newlines). After clicking **Continue**, a scrollable preview popover
shows each parsed word with its pinyin; rows that duplicate an existing word
are highlighted in red and labeled `DUP!`. Clicking **Confirm** persists only
the non-duplicate words, then auto-selects the newly created words so the
user can immediately use existing batch actions ("Improve translation",
"Add examples", etc.).

## Pinyin source
We do not want to spend an LLM call for every imported hanzi. We will vendor
[`hanzi-pinyin-table.json`](https://github.com/guoyunhe/pinyin-json/blob/master/hanzi-pinyin-table.json)
into the repo and cache it **in the service worker** (not in the Next.js
server process). The lookup runs entirely on the client.

- Format: `{ "的":["de","dī","dí","dì", ...], ... }` — first entry is the most
  common reading and is what we will use.
- File size: ~157 KB.
- The browser fetches `/data/hanzi-pinyin-table.json` via the client module;
  the service worker intercepts that request and serves it from the
  versioned `STATIC_CACHE`. This means:
  - Zero server round-trips for pinyin after the first install.
  - Works fully offline (matches the rest of the PWA's behavior).
  - The Next.js server process never touches the file — only the SW caches
    it, only the client uses it.
- The client module does **not** hold a parsed copy in memory; each lookup
  batch re-fetches from the SW cache (free, on-device) and re-parses. The
  SW is the single source of truth so we don't duplicate the cache.
  JSON-parsing 157 KB is ~5–10 ms, and lookup batches happen at most a few
  times per session (when the user opens the bulk-add modal or clicks
  "Add Word").

## File / module layout

### New files
- `public/data/hanzi-pinyin-table.json` — vendored data file, served as a
  static asset by Next.js.
- `src/lib/pinyinTable.ts` — **client** module. Lazy-fetches the JSON from
  `/data/hanzi-pinyin-table.json`, memoises the table in module scope, and
  exposes `lookupPinyinForWord(word) => Promise<{ pinyin, complete }>` and
  `lookupPinyinForWords(words[])`. `complete` is false when at least one
  character in the input has no entry in the table (callers can choose to
  fall back to the LLM in that case).

### Modified files
- `public/sw.js` — precache `/data/hanzi-pinyin-table.json` into
  `STATIC_CACHE` on install (best-effort, alongside the pages); add a
  CacheFirst handler for `/data/*` requests so fresh fetches are cached for
  later offline use even if the precache fails. The change is purely
  additive (new route handler, new precache entry), so we do **not** bump
  `CACHE_VERSION` — existing `static-v1` / `app-shell-v1` caches remain
  valid under the new SW and don't need to be discarded.
- `src/app/words/page.tsx` — UI work + use the client pinyin lookup in both
  the new bulk-add flow and the existing single-word `handleAddWord`.
- `src/app/api/words/pinyin/route.ts` — unchanged from main: the server
  route stays as an LLM-only fallback for rare characters not in the table.
  Single-word add uses it as a fallback when the client lookup returns
  `complete: false`. The bulk-add flow does not call it (any missing char
  is shown with the raw hanzi in its place; the user can later use the
  existing batch tools to refine).

### Vendoring approach
We download the JSON via a one-off `curl` and check it into the repo. The
license of `pinyin-json` is MIT.

## Pinyin lookup behavior
- Strip whitespace from each entry in the CSV before lookup.
- For each character in the hanzi entry, look up its first pinyin and
  concatenate with spaces (e.g. `你好` → `nǐ hǎo`).
- If a character has no entry, keep the raw character in place of pinyin
  for that slot so the user can still see and edit the row.

## UI flow

### Entry point
Add an **Add multiple** button next to the existing **Add Word** button on
the words page header.

### Step 1 — CSV input modal
- A modal with:
  - A multiline `<textarea>` that accepts comma- and/or newline-separated
    hanzi.
  - **Cancel** and **Continue** buttons.
- Continue parses the CSV (`split(/[,\n\r\t]+/).map(trim).filter(Boolean)`),
  de-dupes within the input, calls `lookupPinyinForWords` (client-side, SW
  cached), and transitions to Step 2.

### Step 2 — Preview popover
- Replaces the modal contents with a header summary
  (`N entries — K new, M duplicates`) and a scrollable table:
  | Hanzi | Pinyin |
  - Rows whose `chinese` already exists in `words` are styled with a
    light red background and show a red `DUP!` badge next to the hanzi cell.
  - All other rows are shown as new.
- **Back** returns to Step 1 with the textarea content preserved.
- **Confirm** creates only the non-duplicate rows.

### Step 3 — Create + auto-select
- For each non-duplicate parsed word, build via `newWord({...})`, persist
  with `putWord(...)`, then `ensureWords([...])` to sync.
- `deprecated` is a mandatory non-nullable field on `Word`; we rely on the
  `newWord` factory to set `deprecated: false` at creation time so the
  record validates through `WordSchema` on its way into IDB / the API.
- After creation, refresh the local words list and set `selectedWords` to
  the set of newly created hanzi (replacing the previous selection), then
  switch `viewMode` to `'table'` so the user sees them selected.
- Close the modal.

## Edge cases
- Empty input or whitespace-only entries → Continue is disabled.
- All entries are duplicates → preview still shown, **Confirm** disabled
  with the label "Nothing to add".
- Pinyin lookup fails (e.g. table fetch errors and no SW cache yet) → fall
  back to the raw hanzi as pinyin so the preview still works; user can
  later use existing batch tools to fix pinyin/translation/examples.
- Network failure during create → existing `ensureWords` catch already
  preserves the local create so this matches the current `handleAddWord`
  behavior.
- Single-word add with a rare character missing from the table → falls back
  to the existing `/api/words/pinyin` LLM call so the user still gets a
  correct pinyin for that one word.

## Out of scope
- We do not auto-translate or auto-classify imported words; the user can
  select the new words and click **Improve translation** / **Add examples**
  using the existing toolbar.
- We do not change CSV-out (the existing **Copy CSV** button).

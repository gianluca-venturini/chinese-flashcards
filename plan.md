# Plan: Move entity state to IndexedDB, slim the backend to a sync target

## Goal

Stop treating the backend as the source of truth for per-user entity state. Make the browser (IndexedDB) the primary store. The backend becomes a minimal sync target that holds full Word entities and replays them back on demand, with last-write-wins semantics.

## End-state architecture

- **Client (IndexedDB)**: source of truth for `words` during a session. SR (SM-2) state is applied in place on the Word at the moment of each review, so the Word always carries the current learning state. All reads and writes go through a local storage module first.
- **Server — entity endpoints**: two only.
  - `GET /api/words` — fetch all words for the authenticated user.
  - `PUT /api/words` ("ensure word") — accepts a full Word entity; last write wins.
- **Server — LLM helper endpoints** (stateless, no DB writes): translate, examplify, pinyin generation, classify. They take input from the client, call the LLM, and return results. Any entity updates derived from these results are performed by the client through the storage module + ensure.
- **Schema layer**: a single zod-based module defines `Word`. TS types are derived from the zod schema (`z.infer`). The same schema is used by IndexedDB writes, server request validation, and server response parsing.
- **Sync**: client mutates IndexedDB, then fires-and-forgets an `ensure` call. On app boot, client fetches words and reconciles into IndexedDB.
- **Reviews are gone**: with SR applied in place on the Word, there's no need to persist individual review records. The Review entity, its IDB store, its endpoints, and its Postgres table are all removed.

## Implementation steps

Each step lists the files to create, modify, or delete, the functions exposed, and the tests that cover them. Test convention: `<module>.test.ts` lives next to `<module>.ts` and runs under `bun test`. IndexedDB-backed tests use `fake-indexeddb` (new devDep) to provide IDB under Node. LLM-calling routes are not unit-tested (matches existing convention — only `parsePlecoXML` was); the pure helpers they wrap remain in `src/lib`.

Steps are ordered so each builds on the previous: schema → pure logic → storage → sync → review flow → server → DB → UI → cleanup. Each step is independently shippable.

### Step 1 — Dependencies and canonical schema

**Modify** `package.json`:
- [x] Promote `zod` to a direct dependency (currently only transitive via `ai`/`@ai-sdk/openai`).
- [x] Add `fake-indexeddb` to `devDependencies`.

**Create** `src/lib/schema.ts`:
- [x] `WordSchema` — zod schema. Required fields: `chinese: string`, `pinyin: string`, `created_at: string` (ISO), `i: int ≥ 1`, `ef: number ≥ 1.3`, `n: int ≥ 0`. Nullable fields (LLM-filled or user-edited later): `english: string | null`, `category: CategoryId | null`, `example_chinese: string | null`, `example_pinyin: string | null`, `last_reviewed_at: string | null`, `updated_at: string | null`.
- [x] `type Word = z.infer<typeof WordSchema>`.
- [x] `SR_DEFAULTS = { n: 0, ef: 2.5, i: 1, last_reviewed_at: null }`.
- [x] `newWord(input: { chinese; pinyin; english?; category? }): Word` — convenience constructor. Only `chinese` and `pinyin` are required; `english`, `category`, `example_chinese`, `example_pinyin` default to `null`. Fills `SR_DEFAULTS`, sets `created_at` and `updated_at` to now.

**Create** `src/lib/schema.test.ts`:
- [x] A fully-populated Word parses cleanly.
- [x] A Word built from `newWord({ chinese, pinyin })` (no english, no category) parses cleanly with `english`, `category`, `example_chinese`, `example_pinyin` all `null`.
- [x] A Word built from `newWord()` with every optional supplied round-trips through `WordSchema`.
- [x] `n < 0`, `ef < 1.3`, `i < 1`, non-ISO timestamps all fail to parse.
- [x] `english`, `category`, `example_chinese`, `example_pinyin`, `updated_at`, `last_reviewed_at` each accept both `null` and a valid value.

### Step 2 — SM-2 algorithm

**Create** `src/lib/sm2.ts`:
- [x] `applySm2(sr: { n; ef; i }, q: number): { n; ef; i }` — pure function returning the updated SR triple.

**Create** `src/lib/sm2.test.ts`:
- [x] `q < 3` resets `n → 0` and `i → 1`.
- [x] `q ≥ 3` from `n=0` → `i=1, n=1`; from `n=1` → `i=6, n=2`; from `n≥2` → `i = round(prev_i * ef), n = n + 1`.
- [x] `ef` floor of 1.3 holds across repeated low-quality reviews.
- [x] `ef` delta matches the SM-2 formula for each `q ∈ {0..5}`.

(`src/lib/reviews.ts` is left in place for now and removed in Step 13 to keep this step shippable on its own.)

### Step 3 — Due-word filter

**Create** `src/lib/dueWords.ts`:
- [x] `isWordDue(word: Word, now: Date): boolean` — `last_reviewed_at == null` OR `now − last_reviewed_at ≥ i days`.
- [x] `getDueWords(words: Word[], now: Date, limit?: number): Word[]` — filters, sorts (nulls first, then ascending `last_reviewed_at`), applies `limit`.

**Create** `src/lib/dueWords.test.ts`:
- [x] Never-reviewed (`last_reviewed_at == null`) is always due.
- [x] Exactly `i` days since last review is due; less than `i` days is not.
- [x] Sort order is nulls-first, then ascending `last_reviewed_at`.
- [x] `limit` truncates correctly.

### Step 4 — IndexedDB storage

**Create** `src/lib/storage.ts`:
- [x] Internal `openDb()` — opens/upgrades a single object store `words` keyed by `chinese`.
- [x] `getAllWords(): Promise<Word[]>` — reads all rows; zod-parses each; drops + logs malformed records.
- [x] `getWord(chinese: string): Promise<Word | undefined>` — single read with zod parse.
- [x] `putWord(word: Word): Promise<Word>` — validates with zod; sets `updated_at = now`; writes; returns the persisted Word.
- [x] `resetSr(): Promise<Word[]>` — overwrites SR fields on every word with `SR_DEFAULTS`; bumps `updated_at`; returns the modified words for the caller to ensure to the server.
- [x] `clearAll(): Promise<void>` — deletes the IDB database (used by sign-out).

**Create** `src/lib/storage.test.ts` (uses `fake-indexeddb`):
- [x] `putWord` then `getWord` round-trips.
- [x] `getAllWords` returns every put.
- [x] `putWord` rejects invalid input via zod.
- [x] `putWord` always sets a fresh `updated_at`, even if the input already had one.
- [x] `resetSr` resets SR fields on every word while leaving english/category/examples untouched.
- [x] `clearAll` empties the store; a follow-up `getAllWords` returns `[]`.

### Step 5 — Typed API client

Every function operates on batches. Results are arrays of objects keyed by `word: string` (the chinese character — the Word PK), so the caller can match each result back to its local Word by `chinese`.

**Create** `src/lib/apiClient.ts`:
- [x] `fetchAllWords(): Promise<Word[]>` — GET `/api/words`, zod-parses response.
- [x] `putWords(words: Word[]): Promise<void>` — PUT `/api/words` with body `{ words: Word[] }`. Single-word callers wrap in `[word]`.
- [x] `classifyWords(chinese: string[]): Promise<{ word: string; category: CategoryId }[]>` — POST `/api/words/classify`.
- [x] `translateWords(chinese: string[]): Promise<{ word: string; english: string }[]>` — POST `/api/words/translate`.
- [x] `examplifyWords(targets: string[], knownWords: string[]): Promise<{ word: string; example_chinese: string; example_pinyin: string }[]>` — POST `/api/words/examplify`.
- [x] `generatePinyin(chinese: string[]): Promise<{ word: string; pinyin: string }[]>` — POST `/api/words/pinyin` with body `{ chinese: string[] }`.

**Create** `src/lib/apiClient.test.ts` (mocked `fetch`):
- [x] Each function constructs the right URL, method, and body — including the batch wrapping (`{ words }`, `{ chinese }`).
- [x] Each function parses its response through the matching zod schema; malformed responses throw.
- [x] Empty-batch input (e.g. `putWords([])`, `generatePinyin([])`) is a no-op that resolves without firing a request.

### Step 6 — Sync layer

**Create** `src/lib/sync.ts`:
- [x] `reconcile(local: Word | undefined, remote: Word): Word` — pure: picks the winner by `updated_at`, treating `null` as the epoch. Exported for unit tests.
- [x] `syncFromServer(): Promise<void>` — calls `apiClient.fetchAllWords`, reconciles each entity into IDB.
- [x] `ensureWords(words: Word[]): Promise<void>` — awaits `apiClient.putWords`. **Throws on network or server failure** (any non-2xx response, fetch rejection, or zod parse failure on the response). Single-word callers (review submission, edit) wrap in `[word]`. An empty array is a no-op that resolves immediately. Callers are responsible for try/catch and surfacing the failure to the user; the local IDB write has already happened by the time `ensureWords` is called, so the on-device state is preserved across a failed sync.

**Create** `src/lib/sync.test.ts` (fake-indexeddb + mocked `fetch`):
- [x] `reconcile`: remote-newer wins; local-newer wins; remote-has-ts vs local-null → remote wins; both-null → remote wins (server is the merge target).
- [x] `syncFromServer` persists fetched rows; does not clobber a local-newer entity.
- [x] `ensureWords` issues PUT with `{ words: [...] }` and resolves on a 2xx response.
- [x] `ensureWords` **throws** when the server returns 500, when `fetch` rejects (offline), and when the response body fails zod parsing.
- [x] `ensureWords([])` resolves without firing a request.

### Step 7 — Review submission flow

**Create** `src/lib/review.ts`:
- [x] `submitReview(chinese: string, q: number): Promise<Word>` — loads the Word from `storage.getWord`, runs `applySm2`, sets `last_reviewed_at = now`, persists via `storage.putWord` (which bumps `updated_at`), then awaits `sync.ensureWords([word])`. If the ensure throws, `submitReview` rethrows; the local SR state stays persisted regardless, so the next sync will retry. Returns the new Word on success.

**Create** `src/lib/review.test.ts` (fake-indexeddb + mocked `fetch`):
- [x] After `submitReview`, the persisted Word's SR + `last_reviewed_at` match what `applySm2` would produce.
- [x] `q=5` on a default Word produces `n=1, i=1`; `q=0` keeps `n=0, i=1` but still bumps `last_reviewed_at` and adjusts `ef`.
- [x] The PUT call fires with the new entity.
- [x] When the server returns 500, `submitReview` rejects, but `storage.getWord(chinese)` still returns the updated SR (the IDB write persists across a failed sync).

### Step 8 — Sign-out helper

**Create** `src/lib/signOut.ts`:
- [ ] `signOutAndWipe(): Promise<void>` — calls `storage.clearAll()`, then sets `window.location.href = "/handler/sign-out"`.

**Create** `src/lib/signOut.test.ts` (fake-indexeddb + stubbed `window.location`):
- [ ] After the call, `storage.getAllWords()` returns `[]`.
- [ ] `window.location.href` ends pointing at the Stack sign-out handler.

### Step 9 — Server entity endpoints

**Rewrite** `src/app/api/words/route.ts`:
- [ ] `GET()` — auth check; `SELECT *` for the authenticated user; zod-parses each row (logs + skips malformed); returns `{ words: Word[] }`. No more `?all`, no due filtering.
- [ ] `PUT(request)` — auth check; zod-parses body as `{ words: Word[] }`; upserts every word in a single transaction with `INSERT ... ON CONFLICT (chinese, user_id) DO UPDATE SET ...` (Word PK is `chinese` scoped to `user_id`); returns `{ success: true }`. An empty array is a no-op.
- [ ] Internal `rowToWord(row): Word` — pure mapper from a Postgres row to the zod-shaped Word (exported for tests).

**Create** `src/app/api/words/route.test.ts`:
- [ ] `rowToWord` produces a value that parses through `WordSchema`.
- [ ] `rowToWord` maps `last_review_applied_timestamp`-era rows (no `updated_at`, no `last_reviewed_at`) to `null` for the new fields.
- [ ] The PUT body schema accepts `{ words: [] }` and `{ words: [w1, w2, ...] }`, rejects a bare Word object.

SQL upserts and auth checks are exercised by manual smoke tests (matches existing convention).

### Step 10 — Stateless LLM helper endpoints

**Rewrite** `src/app/api/words/classify/route.ts`:
- [ ] `POST(request)` — auth check; zod-parses `{ chinese: string[] }`; calls `classifyChineseWords`; returns `{ classifications: { word; category }[] }`. No DB access.

**Modify** `src/app/api/words/examplify/route.ts`:
- [ ] `POST(request)` — auth check; zod-parses `{ words: string[], knownWords: string[] }` (knownWords now comes from the client, not the DB); calls `generateExampleSentences` + `generatePinyin`; returns examples.
- [ ] Delete the existing Postgres lookup for the user's vocabulary.

**Leave** `src/app/api/words/translate/route.ts`:
- [ ] No changes — already stateless and already uses zod.

**Create** `src/app/api/words/pinyin/route.ts`:
- [ ] `POST(request)` — auth check; zod-parses `{ chinese: string[] }`; calls the existing single-string `generatePinyin` helper in `src/lib/translate.ts` via `Promise.all` over the batch; returns `{ pinyins: { word: string; pinyin: string }[] }`. No DB.

Tests: none added at the route level (LLM-calling routes are not unit-tested in this codebase). Existing `src/lib/translate.ts` and `src/lib/categories.ts` are unchanged and stay covered by their current usage.

### Step 11 — Postgres schema cleanup

**Modify** `scripts/seed-db.ts`:
- [ ] Add `updated_at TIMESTAMP WITH TIME ZONE` (nullable, no default).
- [ ] Add `last_reviewed_at TIMESTAMP WITH TIME ZONE` (nullable, no default).
- [ ] Drop `last_review_applied_timestamp` from the CREATE TABLE.
- [ ] Remove the `reviews` table CREATE entirely.

Tests: none (existing convention — `seed-db.ts` is exercised by `bun run db:seed` manually).

### Step 12 — UI rewiring

**Modify** `src/app/page.tsx` (flashcard review):
- [ ] On mount: `syncFromServer()` then `storage.getAllWords()` then `dueWords.getDueWords` to populate the deck.
- [ ] On swipe: `review.submitReview(currentWord.chinese, q)`. Wrap in try/catch — on rejection (network/server error) show a non-blocking error banner and continue (the local SR update is already persisted). Delete the existing `submitReview` that posts to `/api/review`.
- [ ] Render: `english`, `example_chinese`, `example_pinyin` may now be `null`; guard the existing `getShortDefinition(currentWord.english)` and example blocks so they're hidden when the field is absent. `category` is already nullable in the current code (falls back to `UNKNOWN_CATEGORY_COLOR`).

**Modify** `src/app/words/page.tsx` (word list):
- [ ] On mount: same sync + read flow as `page.tsx`.
- [ ] All flows below that call `sync.ensureWords` use try/catch — on rejection, surface the existing `alert(...)` / banner pattern already used by the page (the local IDB state is preserved either way).
- [ ] Edit Word: replace `fetch('/api/words/update')` with `storage.putWord` + `sync.ensureWords([word])`.
- [ ] Add Word: replace `fetch('/api/words/create')` with `apiClient.generatePinyin([chinese])` (read `[0].pinyin`) → `schema.newWord` → `storage.putWord` + `sync.ensureWords([word])`. The "English" input becomes optional in the modal — if left blank, the Word is created with `english: null` and the user can fill it later via "Improve translation".
- [ ] "Improve translation": `apiClient.translateWords(selectedChinese)` → update each matching local Word via `storage.putWord`, then `sync.ensureWords(updatedWords)` once for the batch. Treat it as the canonical way to populate `english` for Words created without one.
- [ ] "Add examples": fetch `knownWords` from `storage.getAllWords` (drop any `null` english entries from the context) and pass them to `apiClient.examplifyWords` → `storage.putWord` per result, then `sync.ensureWords(updatedWords)` once for the batch.
- [ ] List/table rendering: guard `getShortDefinition(word.english)` and the example columns against `null`; show an empty cell or placeholder instead of crashing.

**Modify** `src/app/components/UploadButton.tsx` (move Pleco XML import fully client-side):
- [ ] Remove the `fetch('/api/words/upload', ...)` call and the `FormData` upload path.
- [ ] On file pick, read the file via `file.text()` in the browser.
- [ ] Call `parsePlecoXML(content)` — the parser already lives in `src/lib/parsePlecoXML.ts` and works in the browser unchanged. Pinyin comes from the XML itself, so no LLM call is needed.
- [ ] For each parsed entry, build a Word via `schema.newWord({ chinese, pinyin, english })` (english is the Pleco definition; `category`, `example_*` stay `null`).
- [ ] Write every Word to IDB via `storage.putWord`.
- [ ] `await sync.ensureWords(words)` once for the whole batch, inside try/catch. On success show the existing "imported N words" message; on rejection show the existing error message and note that the words are already saved locally and will sync on retry.

This step is what makes Step 13's deletion of `src/app/api/words/upload/route.ts` safe.

**Modify** `src/app/components/ClassifyButton.tsx`:
- [ ] Read words from `storage.getAllWords`, filter to `category == null`, call `apiClient.classifyWords(chinese[])`, write each result back via `storage.putWord`, then `await sync.ensureWords(updatedWords)` inside try/catch.

**Modify** `src/app/components/ResetStatsButton.tsx`:
- [ ] Call `storage.resetSr()`, then `await sync.ensureWords(modifiedWords)` inside try/catch — on rejection, leave the local reset in place and show the existing error UI.

**Modify** `src/app/layout.tsx`:
- [ ] Replace `<Link href="/handler/sign-out">` with a `<button>` whose `onClick` shows a `confirm("Sign out will erase all local data on this device. Continue?")` and, on confirm, calls `signOutAndWipe()`. (Requires making `UserInfoBar` a client component, or pulling the logout control into its own client component imported from the server component.)

Tests: UI components are not unit-tested in this codebase. They're exercised manually.

### Step 13 — Cleanup and deletions

Prerequisite: Step 12's `UploadButton` rewrite must be in place before deleting the upload route — that's what moves Pleco XML import to the browser. Verify the client-side import flow works end-to-end before deleting the server route.

**Delete**:
- [ ] `src/lib/reviews.ts` — replaced by `src/lib/sm2.ts`.
- [ ] `src/app/api/review/route.ts`.
- [ ] `src/app/api/reset-stats/route.ts`.
- [ ] `src/app/api/words/create/route.ts`.
- [ ] `src/app/api/words/update/route.ts`.
- [ ] `src/app/api/words/upload/route.ts` — Pleco upload now runs client-side via the rewritten `UploadButton` (Step 12). `src/lib/parsePlecoXML.ts` stays and is imported by the client.

**Relocate**:
- [ ] `src/app/api/words/upload/route.test.ts` → `src/lib/parsePlecoXML.test.ts` — it only tested the parser; with the upload route gone, the test belongs next to the parser per the new convention.

**Modify** `src/lib/db.ts`:
- [ ] Remove the `Word` and `Review` interfaces (consumers import `Word` from `src/lib/schema.ts`).
- [ ] Keep the `sql` export.

## Things being removed

- Server-side SM-2 application (`src/lib/reviews.ts`).
- Server-side "due" filtering.
- The Review entity end-to-end: the `reviews` Postgres table, `/api/review`, and any client code that references it.
- `/api/reset-stats`, `/api/words/upload`, `/api/words/update`, `/api/words/create`.
- DB reads/writes inside `/api/words/classify` and `/api/words/examplify` (the endpoints stay but become stateless).
- The `ResetStatsButton`/`UploadButton`/`ClassifyButton` server round-trips for entity work (the buttons stay, the implementations change).

## Trade-offs accepted by dropping Reviews

- No review history or per-review analytics (only the current SR state is retained).
- Concurrent offline reviews on different devices: when both sync, last-write-wins on the Word means the "lesser" device's SR update is overwritten. Acceptable for a single-user app.

## Resolved decisions

- **LLM helper endpoints stay as stateless helpers**: no entity reads or writes inside `/api/words/translate`, `/api/words/examplify`, `/api/words/classify`, or pinyin generation. They take input from the client, call the LLM, return results. The client persists any derived entity changes via the storage module + ensure.
- **Conflict resolution at the Word level**: last-write-wins applies to the entire Word entity, not per-field. A stale ensure can overwrite concurrent edits to unrelated fields on the same Word — accepted as a trade-off for a single-user app.
- **Sign-out wipes IndexedDB**: backend auth stays as-is (Stack). On sign-out the client deletes the IDB database before navigating to the Stack sign-out handler. The logout control becomes an interactive flow with a confirmation warning that local data will be cleared (the current plain `<Link href="/handler/sign-out">` in `src/app/layout.tsx` needs to become a button + confirm dialog).
- **`updated_at` is optional, no backfill**: `seed-db.ts` adds `updated_at` as a nullable column with no default. Existing rows keep `updated_at = NULL`; the client treats a missing `updated_at` as the epoch during reconciliation, so any client write wins on first sync.

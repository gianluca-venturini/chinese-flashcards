# Plan: Deprecate words

## Goal

Add a `deprecated` boolean to every word. Deprecated words:

- Are **never shown in flashcard review sessions** (the "class").
- Are **hidden by default in the Words page**, but the user can opt to show them via a per-view toggle.
- When shown, can be toggled deprecated/active via a per-row action in the table.
- Behave like any other word for every other operation (translate, examplify, classify, sync, etc.). The only special behavior is the review-session filter; everything else is gated only by the visibility toggle in the UI.

## Design decisions (locked in)

| Decision | Choice |
| --- | --- |
| IndexedDB migration for the new field | Bump `DB_VERSION` from 1 → 2 with an `onupgradeneeded` migration that adds `deprecated: false` to every existing record. Introduce a small migration framework keyed on `oldVersion` so future schema changes plug in cleanly. |
| Runtime type safety on IDB reads | Continue to validate every record coming out of IDB with `WordSchema` (Zod). The schema gains `deprecated: z.boolean()` so reads either parse cleanly or get dropped with a warning. |
| How the user deprecates a word | Per-row action button in the **table view** of `/words`. |
| Visibility in `/words` | Default: deprecated rows hidden in both tile and table views. A "Show deprecated" toggle in the table toolbar (orthogonal to "Show advanced") flips it on. |
| Effect on Classify / Examplify / Translate | None. They operate on the current visible set. If the user makes deprecated rows visible and selects them, every existing bulk action still works. |
| Reset-stats behavior | Leaves `deprecated` unchanged. |
| Sync semantics | Deprecation is just another mutable field. Flipping it goes through `putWord`, which bumps `updated_at`. The existing last-writer-wins reconcile keeps two devices consistent. |

## Touchpoints (file-by-file)

### 1. Schema — `src/lib/schema.ts`

- Add `deprecated: z.boolean()` to `WordSchema`.
- In `newWord(...)`, set `deprecated: false` in the returned literal.
  - **Why this is required even though we have an IDB migration**: `newWord()` builds a brand-new `Word` in memory (called from `src/app/words/page.tsx:186` "Add Word" and `src/app/components/UploadButton.tsx:32` Pleco import) and immediately hands it to `putWord`, which validates with `WordSchema.parse`. The IDB migration only backfills records that already live in the object store; it never sees objects that don't exist yet. Without the explicit `false`, TypeScript fails to compile (`Word`'s inferred type requires `deprecated: boolean`) and `WordSchema.parse` throws at runtime.
- `SR_DEFAULTS` is unchanged (deprecation is not an SR concept).

### 2. Postgres — `scripts/seed-db.ts`

- In the `CREATE TABLE IF NOT EXISTS words` block, add:
  ```sql
  deprecated BOOLEAN NOT NULL DEFAULT FALSE
  ```
- Add a follow-on `ALTER TABLE words ADD COLUMN IF NOT EXISTS deprecated BOOLEAN NOT NULL DEFAULT FALSE` for installs that already have the table.

### 3. API row mapper — `src/app/api/words/wordMapper.ts`

- `rowToWord` must read `row.deprecated` and pass it to `WordSchema.parse`. Postgres returns native booleans through `postgres.js`, so no coercion needed; just include the key.

### 4. API route — `src/app/api/words/route.ts`

- `GET /api/words` already does `SELECT *`, so the new column flows through `rowToWord` automatically once the mapper is updated. No filtering server-side: the client needs the full set to manage the deprecated subset in the UI.
- `PUT /api/words` upsert: add `deprecated` to the column list, the `VALUES (...)` block, and the `ON CONFLICT ... DO UPDATE SET` clause.

### 5. IndexedDB layer — `src/lib/storage.ts`

- Bump `DB_VERSION` from `1` to `2`.
- Refactor `onupgradeneeded` into a small migration framework:
  ```ts
  // Pseudocode shape — actual implementation lives in storage.ts
  function runMigrations(db: IDBDatabase, tx: IDBTransaction, oldVersion: number) {
    if (oldVersion < 1) {
      db.createObjectStore(STORE, { keyPath: 'chinese' });
    }
    if (oldVersion < 2) {
      // Add deprecated:false to every existing record via cursor.update.
      const store = tx.objectStore(STORE);
      const cursorReq = store.openCursor();
      cursorReq.onsuccess = (ev) => {
        const cursor = (ev.target as IDBRequest<IDBCursorWithValue>).result;
        if (!cursor) return;
        const v = cursor.value;
        if (v && typeof v === 'object' && !('deprecated' in v)) {
          cursor.update({ ...v, deprecated: false });
        }
        cursor.continue();
      };
    }
    // Future migrations: `if (oldVersion < 3) { ... }`
  }
  ```
  Wire `onupgradeneeded` to call `runMigrations(db, req.transaction!, e.oldVersion)`.
- Reads (`getAllWords`, `getWord`) already round-trip through `WordSchema.safeParse` — once `WordSchema` has `deprecated`, post-migration records parse cleanly; any pre-migration row that somehow slipped through is dropped with a warning.
- `putWord`, `putWordsRaw`, `resetSr`, `clearAll`: no logic change. `resetSr` already spreads `...SR_DEFAULTS`, which does not touch `deprecated`.

### 6. Due-words filter — `src/lib/dueWords.ts`

- **`isWordDue` is the chokepoint**: at the top of the function, return `false` immediately if `word.deprecated`. A deprecated word is, by definition, never due — making this a property of the predicate (rather than a separate `.filter(...)` step in `getDueWords`) means every current and future caller of `isWordDue` inherits the correct behavior automatically.
- `getDueWords` needs no extra change: it already filters via `words.filter((w) => isWordDue(w, now))`, so the new short-circuit in `isWordDue` flows through naturally and implements "classes never show deprecated words".

### 7. Review submission — `src/lib/review.ts`

- No change. Because `getDueWords` filters out deprecated, `submitReview` is never called on a deprecated word through the normal UI. We deliberately don't add a guard here — if a deprecated word is somehow reviewed (e.g., a debugging tool), recording the review is harmless.

### 8. Sync — `src/lib/sync.ts`

- No code change. The `deprecated` field rides along inside `Word`. `reconcile`/`diffWords` already key off `updated_at`, and toggling `deprecated` goes through `putWord`, which bumps `updated_at`.

### 9. API client — `src/lib/apiClient.ts`

- No code change. `FetchAllWordsResponseSchema` reuses `WordSchema`, so once the schema knows about `deprecated`, requests/responses validate end-to-end.

### 10. Home (review) page — `src/app/page.tsx`

- No change. It calls `getDueWords(allWords, new Date(), MAX_REVIEW_WORDS)`, which now excludes deprecated.

### 11. Words page — `src/app/words/page.tsx`

This is where the user-facing UX lives.

- **State**: add `const [showDeprecated, setShowDeprecated] = useState(false);`
- **Visible set**: derive `const visibleWords = useMemo(() => showDeprecated ? words : words.filter(w => !w.deprecated), [words, showDeprecated]);` and replace every read of `words` in the render path (tile grid, hover preview, table body, "All Words (N)" count, select-all checkbox) with `visibleWords`. Bulk-action handlers (`handleImproveTranslation`, `handleAddExamples`) still derive from `selectedWords ∩ visibleWords` — selections of hidden rows are not possible because they are not rendered.
- **Toolbar**: in the table-view sticky toolbar (alongside the existing "Show advanced" toggle), add a "Show deprecated" toggle bound to `showDeprecated`. The two toggles are independent; both default OFF.
- **Per-row action (table view)**: add a small right-aligned action cell on each row with a button that calls a new `handleToggleDeprecated(word)` helper:
  ```ts
  async function handleToggleDeprecated(word: Word) {
    const updated = await putWord({ ...word, deprecated: !word.deprecated });
    try { await ensureWords([updated]); } catch { /* sync later */ }
    await refreshWords();
  }
  ```
  Button label: "Deprecate" on an active row, "Restore" on a deprecated row. Stop click propagation so it doesn't toggle the row's selection checkbox.
- **Visual treatment when shown**: when `showDeprecated` is on, render deprecated rows with reduced opacity and a strikethrough on the Chinese column so they read as distinct from active words. No special treatment needed in tile view because deprecated tiles are still hidden unless the toggle is on — and even then the same opacity treatment applies.
- **`handleAddExamples` knownWords pool** (line 148): no change. Per the locked-in decision, all other functionality treats deprecated as normal; the filter is purely visual.

### 12. Admin components

- `UploadButton.tsx`: no change. New words go through `newWord(...)`, which defaults `deprecated: false`.
- `ClassifyButton.tsx`: no change. It already targets words with `category === null`, which is orthogonal to deprecation.
- `ResetStatsButton.tsx`: no change. `resetSr` does not touch `deprecated`.
- `SyncSection.tsx`: no change.

## Tests

### New / updated

- `src/lib/schema.test.ts`
  - `deprecated` accepts `true`/`false`; rejects non-boolean.
  - `newWord(...)` returns `deprecated: false`.
- `src/lib/storage.test.ts`
  - Round-trip with `deprecated: true` and `deprecated: false`.
  - `resetSr` does not change `deprecated`.
  - (Optional, harder with fake-indexeddb) verify the v1 → v2 migration backfills `deprecated: false` on records written before the bump. If the fake driver makes this awkward, add a unit test for the migration helper function in isolation instead.
- `src/lib/dueWords.test.ts`
  - **Key new test**: `isWordDue(deprecatedWord, now)` returns `false` even when `last_reviewed_at` is `null` or arbitrarily far in the past.
  - `getDueWords([...])` excludes a deprecated word that would otherwise be due (proves the predicate-level short-circuit propagates).
  - A non-deprecated due word is still returned.
- `src/lib/sync.test.ts`
  - Flipping `deprecated` and calling `putWord` makes the entry appear in `toPush` because `updated_at` is newer.
  - Pulling a remote record with `deprecated: true` overwrites a local non-deprecated record when remote is newer.
- `src/app/api/words/route.test.ts`
  - `rowToWord` includes `deprecated` (both `true` and `false`).
  - `rowToWord` for a row that's missing `deprecated` (legacy row that somehow got created before the migration) fails Zod parsing — confirms the schema is the gatekeeper.

### Unchanged but worth re-running

- `apiClient.test.ts`, `review.test.ts`, `parsePlecoXML.test.ts`, `sm2.test.ts`, `formatDefinition.test.ts`, `signOut.test.ts` — should be unaffected. Run them to confirm no regressions.

## Rollout / order of operations

1. **Schema first**: update `WordSchema` and `newWord` so the type system reflects the new field. This will surface every call site that constructs a `Word` literal in tests and helpers; fix those by adding `deprecated: false`.
2. **Storage**: bump DB version, add the migration framework, ship the v2 migration.
3. **Postgres**: update `scripts/seed-db.ts` (CREATE + ALTER … ADD COLUMN IF NOT EXISTS). Run `bun run db:seed` against the dev database.
4. **API**: update `wordMapper.ts` and the PUT upsert in `route.ts`.
5. **Review filter**: update `getDueWords`.
6. **UI**: add the `showDeprecated` state, toolbar toggle, per-row action, visual treatment.
7. **Tests**: add the new tests above; run the full suite (`bun test`).
8. **Manual verification**:
   - Existing user: open the app, observe IDB migrates without loss; `/words` looks identical to before; review session behaves identically.
   - Deprecate a word in the table; confirm it disappears from the table immediately, stays gone from review on the home page, and reappears when the "Show deprecated" toggle is on.
   - Restore the word; confirm it re-enters review.
   - Sign in on a second device; confirm the deprecate/restore syncs through `/api/words` and persists.

## Non-goals

- No "bulk deprecate" action. Per-row only, per the chosen UX.
- No archive/soft-delete distinction. `deprecated` is a single boolean; we are not introducing tombstones.
- No server-side filtering of deprecated words from `GET /api/words` — the client owns the visibility decision.
- No special treatment in classify / translate / examplify pipelines.
- No changes to SM-2, due-window math, or category logic.

import 'fake-indexeddb/auto';
import { describe, expect, test, mock, beforeEach } from 'bun:test';
import { reconcile, syncFromServer, ensureWords, diffWords, toSyncStatus, syncBidirectional } from './sync';
import { newWord } from './schema';
import { putWord, putWordsRaw, getWord, clearAll } from './storage';

const WORD_A = newWord({ chinese: '你好', pinyin: 'nǐ hǎo', english: 'hello' });
const WORD_B = newWord({ chinese: '谢谢', pinyin: 'xiè xie', english: 'thank you' });

type FetchCall = { url: string; method?: string; body?: unknown };
let fetchCalls: FetchCall[] = [];

function setupFetch(response: unknown, status = 200) {
  fetchCalls = [];
  globalThis.fetch = mock(async (url: string, init?: RequestInit) => {
    fetchCalls.push({
      url,
      method: init?.method,
      body: init?.body ? JSON.parse(init.body as string) : undefined,
    });
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => response,
    } as Response;
  });
}

beforeEach(async () => {
  await clearAll();
  fetchCalls = [];
});

describe('reconcile', () => {
  test('remote-newer wins', () => {
    const local = { ...WORD_A, updated_at: '2024-01-01T00:00:00.000Z', english: 'old' };
    const remote = { ...WORD_A, updated_at: '2024-01-02T00:00:00.000Z', english: 'new' };
    expect(reconcile(local, remote)).toBe(remote);
  });

  test('local-newer wins', () => {
    const local = { ...WORD_A, updated_at: '2024-01-10T00:00:00.000Z', english: 'local' };
    const remote = { ...WORD_A, updated_at: '2024-01-01T00:00:00.000Z', english: 'remote' };
    expect(reconcile(local, remote)).toBe(local);
  });

  test('remote has timestamp, local has null → remote wins', () => {
    const local = { ...WORD_A, updated_at: null };
    const remote = { ...WORD_A, updated_at: '2024-01-01T00:00:00.000Z', english: 'remote' };
    expect(reconcile(local, remote)).toBe(remote);
  });

  test('both null → remote wins (server is the merge target)', () => {
    const local = { ...WORD_A, updated_at: null, english: 'local' };
    const remote = { ...WORD_A, updated_at: null, english: 'remote' };
    expect(reconcile(local, remote)).toBe(remote);
  });

  test('local undefined → remote wins', () => {
    expect(reconcile(undefined, WORD_A)).toBe(WORD_A);
  });
});

describe('syncFromServer', () => {
  test('persists fetched rows into IDB', async () => {
    setupFetch({ words: [WORD_A, WORD_B] });
    await syncFromServer();
    const a = await getWord(WORD_A.chinese);
    const b = await getWord(WORD_B.chinese);
    expect(a).toBeDefined();
    expect(a!.english).toBe(WORD_A.english);
    expect(b).toBeDefined();
    expect(b!.english).toBe(WORD_B.english);
  });

  test('does not clobber a local-newer entity', async () => {
    // Store a local word; putWord bumps updated_at to "now"
    const localWord = { ...WORD_A, english: 'local version' };
    await putWord(localWord); // stored with updated_at = now (current time)

    // Remote has a clearly older timestamp
    const remoteWord = { ...WORD_A, english: 'remote version', updated_at: '2020-01-01T00:00:00.000Z' };
    setupFetch({ words: [remoteWord] });
    await syncFromServer();

    const stored = await getWord(WORD_A.chinese);
    expect(stored!.english).toBe('local version');
  });

  test('new remote word (not in IDB) is persisted', async () => {
    setupFetch({ words: [WORD_A] });
    await syncFromServer();
    expect(await getWord(WORD_A.chinese)).toBeDefined();
  });
});

describe('diffWords', () => {
  test('remote-only → toPull', () => {
    const { toPull, toPush } = diffWords([], [WORD_A]);
    expect(toPull).toHaveLength(1);
    expect(toPull[0].chinese).toBe(WORD_A.chinese);
    expect(toPush).toHaveLength(0);
  });

  test('local-only → toPush', () => {
    const { toPull, toPush } = diffWords([WORD_A], []);
    expect(toPush).toHaveLength(1);
    expect(toPush[0].chinese).toBe(WORD_A.chinese);
    expect(toPull).toHaveLength(0);
  });

  test('remote newer → toPull', () => {
    const local = { ...WORD_A, updated_at: '2024-01-01T00:00:00.000Z' };
    const remote = { ...WORD_A, updated_at: '2024-06-01T00:00:00.000Z' };
    const { toPull, toPush } = diffWords([local], [remote]);
    expect(toPull).toHaveLength(1);
    expect(toPush).toHaveLength(0);
  });

  test('local newer → toPush', () => {
    const local = { ...WORD_A, updated_at: '2024-06-01T00:00:00.000Z' };
    const remote = { ...WORD_A, updated_at: '2024-01-01T00:00:00.000Z' };
    const { toPull, toPush } = diffWords([local], [remote]);
    expect(toPush).toHaveLength(1);
    expect(toPull).toHaveLength(0);
  });

  test('same updated_at → neither', () => {
    const ts = '2024-01-01T00:00:00.000Z';
    const local = { ...WORD_A, updated_at: ts };
    const remote = { ...WORD_A, updated_at: ts };
    const { toPull, toPush } = diffWords([local], [remote]);
    expect(toPull).toHaveLength(0);
    expect(toPush).toHaveLength(0);
  });

  test('empty/empty → empty diff', () => {
    const { toPull, toPush } = diffWords([], []);
    expect(toPull).toHaveLength(0);
    expect(toPush).toHaveLength(0);
  });
});

describe('toSyncStatus', () => {
  test('maps toPull.length to staleLocal and toPush.length to staleRemote', () => {
    const diff = { toPull: [WORD_A, WORD_B], toPush: [WORD_B] };
    const status = toSyncStatus(diff);
    expect(status.staleLocal).toBe(2);
    expect(status.staleRemote).toBe(1);
  });

  test('in-sync diff → zeros', () => {
    const status = toSyncStatus({ toPull: [], toPush: [] });
    expect(status.staleLocal).toBe(0);
    expect(status.staleRemote).toBe(0);
  });
});

describe('syncBidirectional', () => {
  test('pulls remote-newer into IDB and pushes local-newer to server', async () => {
    const localWord = { ...WORD_A, english: 'local', updated_at: '2024-06-01T00:00:00.000Z' };
    const remoteNewerWord = { ...WORD_B, english: 'remote-new', updated_at: '2024-06-01T00:00:00.000Z' };
    await putWord(localWord);

    setupFetch({
      words: [
        { ...WORD_A, english: 'remote-old', updated_at: '2024-01-01T00:00:00.000Z' },
        remoteNewerWord,
      ],
    });
    // second fetch (PUT) needs its own mock — chain two responses
    let callCount = 0;
    globalThis.fetch = mock(async (url: string, init?: RequestInit) => {
      callCount++;
      fetchCalls.push({ url, method: init?.method, body: init?.body ? JSON.parse(init.body as string) : undefined });
      if (callCount === 1) {
        return { ok: true, status: 200, json: async () => ({ words: [
          { ...WORD_A, english: 'remote-old', updated_at: '2024-01-01T00:00:00.000Z' },
          remoteNewerWord,
        ]}) } as Response;
      }
      return { ok: true, status: 200, json: async () => ({ success: true }) } as Response;
    });

    const { pulled, pushed } = await syncBidirectional();

    expect(pulled).toBe(1); // WORD_B pulled in
    expect(pushed).toBe(1); // WORD_A (local newer) pushed out

    const storedB = await getWord(WORD_B.chinese);
    expect(storedB!.english).toBe('remote-new');
    expect(storedB!.updated_at).toBe('2024-06-01T00:00:00.000Z');

    const storedA = await getWord(WORD_A.chinese);
    expect(storedA!.english).toBe('local'); // not overwritten
  });

  test('flipping deprecated via putWord causes the entry to appear in toPush', async () => {
    const remote = { ...WORD_A, updated_at: '2020-01-01T00:00:00.000Z', deprecated: false };
    await putWordsRaw([remote]); // seed IDB matching remote
    // flip deprecated through putWord — bumps updated_at to now
    const local = await getWord(WORD_A.chinese);
    expect(local).toBeDefined();
    await putWord({ ...local!, deprecated: true });

    const localAfter = await getWord(WORD_A.chinese);
    const { toPull, toPush } = diffWords([localAfter!], [remote]);
    expect(toPull).toHaveLength(0);
    expect(toPush).toHaveLength(1);
    expect(toPush[0].deprecated).toBe(true);
  });

  test('pulling a remote deprecated record overwrites a local non-deprecated record when remote is newer', async () => {
    const local = { ...WORD_A, deprecated: false, updated_at: '2024-01-01T00:00:00.000Z' };
    await putWordsRaw([local]);
    const remote = { ...WORD_A, deprecated: true, updated_at: '2024-06-01T00:00:00.000Z' };
    setupFetch({ words: [remote] });
    await syncFromServer();
    const stored = await getWord(WORD_A.chinese);
    expect(stored!.deprecated).toBe(true);
  });

  test('returns zero counts when already in sync', async () => {
    const fixedTs = '2024-01-01T00:00:00.000Z';
    const word = { ...WORD_A, updated_at: fixedTs };
    await putWordsRaw([word]); // preserve the timestamp so local == remote
    let callCount = 0;
    globalThis.fetch = mock(async (_url: string, _init?: RequestInit) => {
      callCount++;
      if (callCount === 1) return { ok: true, status: 200, json: async () => ({ words: [word] }) } as Response;
      return { ok: true, status: 200, json: async () => ({ success: true }) } as Response;
    });
    const { pulled, pushed } = await syncBidirectional();
    expect(pulled).toBe(0);
    expect(pushed).toBe(0);
  });
});

describe('ensureWords', () => {
  test('issues PUT /api/words with { words } and resolves on 2xx', async () => {
    setupFetch({ success: true });
    await ensureWords([WORD_A]);
    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0].url).toBe('/api/words');
    expect(fetchCalls[0].method).toBe('PUT');
    const body = fetchCalls[0].body as { words: unknown[] };
    expect(body.words).toHaveLength(1);
  });

  test('throws when server returns 500', async () => {
    setupFetch({}, 500);
    await expect(ensureWords([WORD_A])).rejects.toThrow();
  });

  test('throws when fetch rejects (offline)', async () => {
    globalThis.fetch = mock(async () => { throw new Error('Network error'); });
    await expect(ensureWords([WORD_A])).rejects.toThrow('Network error');
  });

  test('throws when response body fails zod parsing', async () => {
    setupFetch({ not_success: 'bad shape' });
    await expect(ensureWords([WORD_A])).rejects.toThrow();
  });

  test('ensureWords([]) resolves without firing a request', async () => {
    setupFetch({ success: true });
    await ensureWords([]);
    expect(fetchCalls).toHaveLength(0);
  });
});

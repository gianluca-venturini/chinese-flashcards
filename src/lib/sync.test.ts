import 'fake-indexeddb/auto';
import { describe, expect, test, mock, beforeEach } from 'bun:test';
import { reconcile, syncFromServer, ensureWords } from './sync';
import { newWord } from './schema';
import { putWord, getWord, clearAll } from './storage';

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

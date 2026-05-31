import 'fake-indexeddb/auto';
import { describe, expect, test, mock, beforeEach } from 'bun:test';
import { submitReview } from './review';
import { newWord, SR_DEFAULTS } from './schema';
import { putWord, getWord, clearAll } from './storage';
import { applySm2 } from './sm2';

const DEFAULT_WORD = newWord({ chinese: '你好', pinyin: 'nǐ hǎo', english: 'hello' });

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
  setupFetch({ success: true });
});

describe('submitReview', () => {
  test('persisted Word SR + last_reviewed_at match applySm2 output', async () => {
    await putWord(DEFAULT_WORD);
    const before = new Date().toISOString();
    await submitReview(DEFAULT_WORD.chinese, 4);
    const after = new Date().toISOString();

    const stored = await getWord(DEFAULT_WORD.chinese);
    const expected = applySm2({ n: DEFAULT_WORD.n, ef: DEFAULT_WORD.ef, i: DEFAULT_WORD.i }, 4);

    expect(stored!.n).toBe(expected.n);
    expect(stored!.ef).toBeCloseTo(expected.ef, 10);
    expect(stored!.i).toBe(expected.i);
    expect(stored!.last_reviewed_at! >= before).toBe(true);
    expect(stored!.last_reviewed_at! <= after).toBe(true);
  });

  test('q=5 on default Word produces n=1, i=1', async () => {
    await putWord(DEFAULT_WORD);
    const result = await submitReview(DEFAULT_WORD.chinese, 5);
    expect(result.n).toBe(1);
    expect(result.i).toBe(1);
  });

  test('q=0 on default Word keeps n=0, i=1 but bumps last_reviewed_at and adjusts ef', async () => {
    await putWord(DEFAULT_WORD);
    const before = new Date().toISOString();
    const result = await submitReview(DEFAULT_WORD.chinese, 0);

    expect(result.n).toBe(0);
    expect(result.i).toBe(1);
    expect(result.last_reviewed_at! >= before).toBe(true);
    const expectedEf = Math.max(1.3, SR_DEFAULTS.ef + (0.1 - 5 * (0.08 + 5 * 0.02)));
    expect(result.ef).toBeCloseTo(expectedEf, 10);
  });

  test('PUT call fires with the updated entity', async () => {
    await putWord(DEFAULT_WORD);
    await submitReview(DEFAULT_WORD.chinese, 5);

    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0].method).toBe('PUT');
    expect(fetchCalls[0].url).toBe('/api/words');
    const body = fetchCalls[0].body as { words: unknown[] };
    expect(body.words).toHaveLength(1);
  });

  test('when server returns 500, submitReview rejects but IDB retains the updated SR', async () => {
    await putWord(DEFAULT_WORD);
    setupFetch({}, 500);

    await expect(submitReview(DEFAULT_WORD.chinese, 5)).rejects.toThrow();

    const stored = await getWord(DEFAULT_WORD.chinese);
    const expected = applySm2({ n: DEFAULT_WORD.n, ef: DEFAULT_WORD.ef, i: DEFAULT_WORD.i }, 5);
    expect(stored!.n).toBe(expected.n);
    expect(stored!.i).toBe(expected.i);
    expect(stored!.last_reviewed_at).not.toBeNull();
  });
});

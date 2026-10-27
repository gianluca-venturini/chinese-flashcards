import { describe, expect, test, mock, beforeEach } from 'bun:test';
import {
  fetchAllWords,
  putWords,
  createWord,
  generateFields,
  mapLimit,
} from './apiClient';
import { newWord } from './schema';

const WORD_A = newWord({ chinese: '你好', pinyin: 'nǐ hǎo', english: 'hello' });
const WORD_B = newWord({ chinese: '谢谢', pinyin: 'xiè xie', english: 'thank you' });

type FetchCall = { url: string; method?: string; body?: unknown };
let calls: FetchCall[] = [];

function setupFetch(response: unknown, status = 200) {
  calls = [];
  globalThis.fetch = mock(async (url: string, init?: RequestInit) => {
    calls.push({
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

beforeEach(() => { calls = []; });

describe('fetchAllWords', () => {
  test('GETs /api/words and returns parsed words', async () => {
    setupFetch({ words: [WORD_A, WORD_B] });
    const result = await fetchAllWords();
    expect(calls[0].url).toBe('/api/words');
    expect(calls[0].method).toBeUndefined();
    expect(result).toHaveLength(2);
    expect(result[0].chinese).toBe(WORD_A.chinese);
  });

  test('throws on malformed response', async () => {
    setupFetch({ words: [{ not: 'a word' }] });
    await expect(fetchAllWords()).rejects.toThrow();
  });

  test('throws on non-2xx response', async () => {
    setupFetch({}, 401);
    await expect(fetchAllWords()).rejects.toThrow();
  });
});

describe('putWords', () => {
  test('PUTs /api/words/sync with body { words }', async () => {
    setupFetch({ success: true });
    await putWords([WORD_A, WORD_B]);
    expect(calls[0].url).toBe('/api/words/sync');
    expect(calls[0].method).toBe('PUT');
    expect((calls[0].body as { words: unknown[] }).words).toHaveLength(2);
  });

  test('empty array is a no-op — no fetch fired', async () => {
    setupFetch({ success: true });
    await putWords([]);
    expect(calls).toHaveLength(0);
  });

  test('throws on non-2xx response', async () => {
    setupFetch({}, 500);
    await expect(putWords([WORD_A])).rejects.toThrow();
  });
});

describe('createWord', () => {
  test('PUTs /api/words with body { chinese } and returns the word', async () => {
    setupFetch({ word: WORD_A, success: true });
    const result = await createWord('你好');
    expect(calls[0].url).toBe('/api/words');
    expect(calls[0].method).toBe('PUT');
    expect(calls[0].body).toEqual({ chinese: '你好' });
    expect(result.chinese).toBe('你好');
  });

  test('throws on 409 (word already exists)', async () => {
    setupFetch({ success: false }, 409);
    await expect(createWord('你好')).rejects.toThrow();
  });

  test('throws on malformed response', async () => {
    setupFetch({ word: { not: 'a word' } });
    await expect(createWord('你好')).rejects.toThrow();
  });
});

describe('generateFields', () => {
  test('POSTs /api/words with body { chinese, fields } and returns the row', async () => {
    setupFetch({ row: { english: 'hello' }, success: true });
    const result = await generateFields('你好', ['english']);
    expect(calls[0].url).toBe('/api/words');
    expect(calls[0].method).toBe('POST');
    expect(calls[0].body).toEqual({ chinese: '你好', fields: ['english'] });
    expect(result).toEqual({ english: 'hello' });
  });

  test('throws on an invalid category in the row', async () => {
    setupFetch({ row: { category: 'not_a_real_category' } });
    await expect(generateFields('好', ['category'])).rejects.toThrow();
  });
});

describe('mapLimit', () => {
  test('keeps the input order and never runs more than the limit at once', async () => {
    let running = 0;
    let maxRunning = 0;
    const result = await mapLimit([30, 10, 20, 5, 15], 2, async (ms) => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((r) => setTimeout(r, ms));
      running--;
      return ms * 2;
    });
    expect(result).toEqual([60, 20, 40, 10, 30]);
    expect(maxRunning).toBe(2);
  });

  test('empty input returns an empty array', async () => {
    expect(await mapLimit([], 5, async (x) => x)).toEqual([]);
  });
});

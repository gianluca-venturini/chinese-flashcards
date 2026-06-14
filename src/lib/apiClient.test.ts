import { describe, expect, test, mock, beforeEach } from 'bun:test';
import {
  fetchAllWords,
  putWords,
  classifyWords,
  translateWords,
  examplifyWords,
  generatePinyin,
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
  test('PUTs /api/words with body { words }', async () => {
    setupFetch({ success: true });
    await putWords([WORD_A, WORD_B]);
    expect(calls[0].url).toBe('/api/words');
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

describe('classifyWords', () => {
  test('POSTs /api/words/classify with body { chinese }', async () => {
    setupFetch({ classifications: [{ word: '你好', category: 'feelings_thoughts_communication' }] });
    const result = await classifyWords(['你好']);
    expect(calls[0].url).toBe('/api/words/classify');
    expect(calls[0].method).toBe('POST');
    expect((calls[0].body as { chinese: string[] }).chinese).toEqual(['你好']);
    expect(result[0].category).toBe('feelings_thoughts_communication');
  });

  test('empty array is a no-op', async () => {
    setupFetch({});
    const result = await classifyWords([]);
    expect(calls).toHaveLength(0);
    expect(result).toHaveLength(0);
  });

  test('throws on malformed response', async () => {
    setupFetch({ classifications: [{ word: '好', category: 'not_a_real_category' }] });
    await expect(classifyWords(['好'])).rejects.toThrow();
  });
});

describe('translateWords', () => {
  test('POSTs /api/words/translate with body { words }', async () => {
    setupFetch({ translations: [{ word: '你好', english: 'hello' }] });
    const result = await translateWords(['你好']);
    expect(calls[0].url).toBe('/api/words/translate');
    expect(calls[0].method).toBe('POST');
    expect((calls[0].body as { words: string[] }).words).toEqual(['你好']);
    expect(result[0].english).toBe('hello');
  });

  test('empty array is a no-op', async () => {
    setupFetch({});
    const result = await translateWords([]);
    expect(calls).toHaveLength(0);
    expect(result).toHaveLength(0);
  });

  test('throws on malformed response', async () => {
    setupFetch({ translations: [{ not: 'right' }] });
    await expect(translateWords(['好'])).rejects.toThrow();
  });
});

describe('examplifyWords', () => {
  test('POSTs /api/words/examplify with body { words, knownWords }', async () => {
    setupFetch({
      examples: [{ word: '你好', example_chinese: '你好吗？', example_pinyin: 'nǐ hǎo ma?', example_english: 'How are you?' }],
    });
    const result = await examplifyWords(['你好'], ['谢谢']);
    expect(calls[0].url).toBe('/api/words/examplify');
    expect(calls[0].method).toBe('POST');
    const body = calls[0].body as { words: string[]; knownWords: string[] };
    expect(body.words).toEqual(['你好']);
    expect(body.knownWords).toEqual(['谢谢']);
    expect(result[0].example_chinese).toBe('你好吗？');
    expect(result[0].example_english).toBe('How are you?');
  });

  test('empty targets is a no-op', async () => {
    setupFetch({});
    const result = await examplifyWords([], ['谢谢']);
    expect(calls).toHaveLength(0);
    expect(result).toHaveLength(0);
  });

  test('throws on malformed response', async () => {
    setupFetch({ examples: [{ missing: 'fields' }] });
    await expect(examplifyWords(['好'], [])).rejects.toThrow();
  });
});

describe('generatePinyin', () => {
  test('POSTs /api/words/pinyin with body { chinese }', async () => {
    setupFetch({ pinyins: [{ word: '你好', pinyin: 'nǐ hǎo' }] });
    const result = await generatePinyin(['你好']);
    expect(calls[0].url).toBe('/api/words/pinyin');
    expect(calls[0].method).toBe('POST');
    expect((calls[0].body as { chinese: string[] }).chinese).toEqual(['你好']);
    expect(result[0].pinyin).toBe('nǐ hǎo');
  });

  test('empty array is a no-op', async () => {
    setupFetch({});
    const result = await generatePinyin([]);
    expect(calls).toHaveLength(0);
    expect(result).toHaveLength(0);
  });

  test('throws on malformed response', async () => {
    setupFetch({ pinyins: [{ bad: 'shape' }] });
    await expect(generatePinyin(['好'])).rejects.toThrow();
  });
});

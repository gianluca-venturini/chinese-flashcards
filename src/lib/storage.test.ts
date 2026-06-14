import 'fake-indexeddb/auto';
import { describe, expect, test, beforeEach } from 'bun:test';
import { getAllWords, getWord, putWord, putWordsRaw, resetSr, clearAll } from './storage';
import { newWord, SR_DEFAULTS } from './schema';

beforeEach(async () => {
  await clearAll();
});

const WORD_A = newWord({ chinese: '你好', pinyin: 'nǐ hǎo', english: 'hello' });
const WORD_B = newWord({ chinese: '谢谢', pinyin: 'xiè xie', english: 'thank you' });

describe('putWord / getWord', () => {
  test('putWord then getWord round-trips', async () => {
    await putWord(WORD_A);
    const result = await getWord(WORD_A.chinese);
    expect(result).toBeDefined();
    expect(result!.chinese).toBe(WORD_A.chinese);
    expect(result!.english).toBe(WORD_A.english);
    expect(result!.pinyin).toBe(WORD_A.pinyin);
  });

  test('getWord returns undefined for unknown chinese', async () => {
    const result = await getWord('不存在');
    expect(result).toBeUndefined();
  });

  test('putWord rejects invalid input via zod', async () => {
    const bad = { ...WORD_A, n: -1 };
    await expect(putWord(bad as never)).rejects.toThrow();
  });

  test('putWord always sets a fresh updated_at, even if input already had one', async () => {
    const stale = { ...WORD_A, updated_at: '2020-01-01T00:00:00.000Z' };
    const before = new Date().toISOString();
    const result = await putWord(stale);
    const after = new Date().toISOString();
    expect(result.updated_at! >= before).toBe(true);
    expect(result.updated_at! <= after).toBe(true);
  });
});

describe('getAllWords', () => {
  test('returns every put word', async () => {
    await putWord(WORD_A);
    await putWord(WORD_B);
    const all = await getAllWords();
    const keys = all.map((w) => w.chinese);
    expect(keys).toContain(WORD_A.chinese);
    expect(keys).toContain(WORD_B.chinese);
    expect(all).toHaveLength(2);
  });

  test('returns empty array when store is empty', async () => {
    const all = await getAllWords();
    expect(all).toHaveLength(0);
  });
});

describe('resetSr', () => {
  test('resets SR fields on every word while leaving english/category/examples untouched', async () => {
    const reviewed = {
      ...WORD_A,
      n: 5,
      ef: 1.8,
      i: 15,
      last_reviewed_at: '2024-01-01T00:00:00.000Z',
      example_chinese: '你好吗？',
      example_pinyin: 'nǐ hǎo ma?',
      example_english: 'How are you?',
      category: 'feelings_thoughts_communication' as const,
    };
    await putWord(reviewed);
    await putWord(WORD_B);

    const modified = await resetSr();
    expect(modified).toHaveLength(2);

    const resetA = modified.find((w) => w.chinese === WORD_A.chinese)!;
    expect(resetA.n).toBe(SR_DEFAULTS.n);
    expect(resetA.ef).toBe(SR_DEFAULTS.ef);
    expect(resetA.i).toBe(SR_DEFAULTS.i);
    expect(resetA.last_reviewed_at).toBe(SR_DEFAULTS.last_reviewed_at);
    expect(resetA.english).toBe(WORD_A.english);
    expect(resetA.example_chinese).toBe('你好吗？');
    expect(resetA.example_pinyin).toBe('nǐ hǎo ma?');
    expect(resetA.example_english).toBe('How are you?');
    expect(resetA.category).toBe('feelings_thoughts_communication');
  });

  test('persists the reset to IDB', async () => {
    const reviewed = { ...WORD_A, n: 3, ef: 2.0, i: 6 };
    await putWord(reviewed);
    await resetSr();

    const fetched = await getWord(WORD_A.chinese);
    expect(fetched!.n).toBe(SR_DEFAULTS.n);
    expect(fetched!.ef).toBe(SR_DEFAULTS.ef);
    expect(fetched!.i).toBe(SR_DEFAULTS.i);
  });

  test('leaves deprecated unchanged', async () => {
    await putWord({ ...WORD_A, deprecated: true });
    await putWord({ ...WORD_B, deprecated: false });
    const modified = await resetSr();
    expect(modified.find((w) => w.chinese === WORD_A.chinese)!.deprecated).toBe(true);
    expect(modified.find((w) => w.chinese === WORD_B.chinese)!.deprecated).toBe(false);
  });
});

describe('putWordsRaw', () => {
  test('preserves updated_at — does not bump to now', async () => {
    const stale = { ...WORD_A, updated_at: '2020-01-01T00:00:00.000Z' };
    await putWordsRaw([stale]);
    const result = await getWord(stale.chinese);
    expect(result!.updated_at).toBe('2020-01-01T00:00:00.000Z');
  });

  test('writes multiple words in one call', async () => {
    const a = { ...WORD_A, updated_at: '2020-01-01T00:00:00.000Z' };
    const b = { ...WORD_B, updated_at: '2021-06-15T12:00:00.000Z' };
    await putWordsRaw([a, b]);
    const all = await getAllWords();
    expect(all).toHaveLength(2);
    expect(all.find((w) => w.chinese === WORD_A.chinese)!.updated_at).toBe('2020-01-01T00:00:00.000Z');
    expect(all.find((w) => w.chinese === WORD_B.chinese)!.updated_at).toBe('2021-06-15T12:00:00.000Z');
  });

  test('empty array is a no-op', async () => {
    await putWordsRaw([]);
    expect(await getAllWords()).toHaveLength(0);
  });
});

describe('clearAll', () => {
  test('empties the store; getAllWords returns [] after clearAll', async () => {
    await putWord(WORD_A);
    await putWord(WORD_B);
    await clearAll();
    const all = await getAllWords();
    expect(all).toHaveLength(0);
  });
});

import { describe, expect, test } from 'bun:test';
import { WordSchema, newWord, SR_DEFAULTS } from './schema';

const VALID_WORD = {
  chinese: '你好',
  pinyin: 'nǐ hǎo',
  created_at: '2024-01-15T10:30:00.000Z',
  i: 1,
  ef: 2.5,
  n: 0,
  english: 'hello',
  category: 'feelings_thoughts_communication',
  example_chinese: '你好吗？',
  example_pinyin: 'nǐ hǎo ma?',
  last_reviewed_at: '2024-01-14T08:00:00.000Z',
  updated_at: '2024-01-15T10:30:00.000Z',
};

describe('WordSchema', () => {
  test('fully-populated Word parses cleanly', () => {
    expect(() => WordSchema.parse(VALID_WORD)).not.toThrow();
    const result = WordSchema.parse(VALID_WORD);
    expect(result.chinese).toBe('你好');
    expect(result.english).toBe('hello');
  });

  test('n < 0 fails', () => {
    expect(() => WordSchema.parse({ ...VALID_WORD, n: -1 })).toThrow();
  });

  test('ef < 1.3 fails', () => {
    expect(() => WordSchema.parse({ ...VALID_WORD, ef: 1.2 })).toThrow();
  });

  test('i < 1 fails', () => {
    expect(() => WordSchema.parse({ ...VALID_WORD, i: 0 })).toThrow();
  });

  test('non-ISO created_at fails', () => {
    expect(() => WordSchema.parse({ ...VALID_WORD, created_at: '2024-01-15' })).toThrow();
    expect(() => WordSchema.parse({ ...VALID_WORD, created_at: 'not-a-date' })).toThrow();
  });

  test('non-ISO last_reviewed_at fails when present', () => {
    expect(() => WordSchema.parse({ ...VALID_WORD, last_reviewed_at: '2024-01-15' })).toThrow();
  });

  test('non-ISO updated_at fails when present', () => {
    expect(() => WordSchema.parse({ ...VALID_WORD, updated_at: 'yesterday' })).toThrow();
  });

  test('english accepts null and a valid value', () => {
    expect(() => WordSchema.parse({ ...VALID_WORD, english: null })).not.toThrow();
    expect(() => WordSchema.parse({ ...VALID_WORD, english: 'hello' })).not.toThrow();
  });

  test('category accepts null and a valid value', () => {
    expect(() => WordSchema.parse({ ...VALID_WORD, category: null })).not.toThrow();
    expect(() => WordSchema.parse({ ...VALID_WORD, category: 'people_identity' })).not.toThrow();
  });

  test('example_chinese accepts null and a valid value', () => {
    expect(() => WordSchema.parse({ ...VALID_WORD, example_chinese: null })).not.toThrow();
    expect(() => WordSchema.parse({ ...VALID_WORD, example_chinese: '你好吗？' })).not.toThrow();
  });

  test('example_pinyin accepts null and a valid value', () => {
    expect(() => WordSchema.parse({ ...VALID_WORD, example_pinyin: null })).not.toThrow();
    expect(() => WordSchema.parse({ ...VALID_WORD, example_pinyin: 'nǐ hǎo ma?' })).not.toThrow();
  });

  test('updated_at accepts null and a valid ISO value', () => {
    expect(() => WordSchema.parse({ ...VALID_WORD, updated_at: null })).not.toThrow();
    expect(() => WordSchema.parse({ ...VALID_WORD, updated_at: '2024-01-15T10:30:00.000Z' })).not.toThrow();
  });

  test('last_reviewed_at accepts null and a valid ISO value', () => {
    expect(() => WordSchema.parse({ ...VALID_WORD, last_reviewed_at: null })).not.toThrow();
    expect(() => WordSchema.parse({ ...VALID_WORD, last_reviewed_at: '2024-01-15T10:30:00.000Z' })).not.toThrow();
  });
});

describe('newWord', () => {
  test('newWord with only chinese and pinyin produces all nullable fields as null', () => {
    const word = newWord({ chinese: '你好', pinyin: 'nǐ hǎo' });
    expect(word.english).toBeNull();
    expect(word.category).toBeNull();
    expect(word.example_chinese).toBeNull();
    expect(word.example_pinyin).toBeNull();
    expect(() => WordSchema.parse(word)).not.toThrow();
  });

  test('newWord fills SR_DEFAULTS', () => {
    const word = newWord({ chinese: '你好', pinyin: 'nǐ hǎo' });
    expect(word.n).toBe(SR_DEFAULTS.n);
    expect(word.ef).toBe(SR_DEFAULTS.ef);
    expect(word.i).toBe(SR_DEFAULTS.i);
    expect(word.last_reviewed_at).toBe(SR_DEFAULTS.last_reviewed_at);
  });

  test('newWord with all optionals round-trips through WordSchema', () => {
    const word = newWord({
      chinese: '你好',
      pinyin: 'nǐ hǎo',
      english: 'hello',
      category: 'feelings_thoughts_communication',
    });
    expect(() => WordSchema.parse(word)).not.toThrow();
    const parsed = WordSchema.parse(word);
    expect(parsed.english).toBe('hello');
    expect(parsed.category).toBe('feelings_thoughts_communication');
    expect(parsed.example_chinese).toBeNull();
    expect(parsed.example_pinyin).toBeNull();
  });

  test('newWord sets created_at and updated_at to a valid ISO timestamp', () => {
    const before = new Date().toISOString();
    const word = newWord({ chinese: '好', pinyin: 'hǎo' });
    const after = new Date().toISOString();
    expect(word.created_at >= before).toBe(true);
    expect(word.created_at <= after).toBe(true);
    expect(word.updated_at).toBe(word.created_at);
  });
});

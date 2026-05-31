import { describe, expect, test } from 'bun:test';
import { rowToWord, PutBodySchema } from './wordMapper';
import { WordSchema, newWord } from '@/lib/schema';

const FULL_ROW = {
  chinese: '你好',
  pinyin: 'nǐ hǎo',
  english: 'hello',
  created_at: new Date('2024-01-15T10:00:00.000Z'),
  n: 0,
  ef: 2.5,
  i: 1,
  category: 'feelings_thoughts_communication',
  example_chinese: '你好吗？',
  example_pinyin: 'nǐ hǎo ma?',
  last_reviewed_at: new Date('2024-01-14T08:00:00.000Z'),
  updated_at: new Date('2024-01-15T10:00:00.000Z'),
};

describe('rowToWord', () => {
  test('produces a value that parses through WordSchema', () => {
    const word = rowToWord(FULL_ROW);
    expect(() => WordSchema.parse(word)).not.toThrow();
    expect(word.chinese).toBe('你好');
    expect(word.english).toBe('hello');
    expect(word.last_reviewed_at).toBe('2024-01-14T08:00:00.000Z');
    expect(word.updated_at).toBe('2024-01-15T10:00:00.000Z');
  });

  test('maps old-era rows (no updated_at, no last_reviewed_at) to null for the new fields', () => {
    const oldEraRow = {
      chinese: '谢谢',
      pinyin: 'xiè xie',
      english: 'thank you',
      created_at: new Date('2023-06-01T00:00:00.000Z'),
      n: 2,
      ef: 2.0,
      i: 6,
      category: null,
      example_chinese: null,
      example_pinyin: null,
      last_review_applied_timestamp: new Date('2023-06-10T00:00:00.000Z'),
      // no last_reviewed_at, no updated_at
    };
    const word = rowToWord(oldEraRow);
    expect(word.last_reviewed_at).toBeNull();
    expect(word.updated_at).toBeNull();
    expect(() => WordSchema.parse(word)).not.toThrow();
  });

  test('handles null nullable fields without throwing', () => {
    const row = {
      ...FULL_ROW,
      english: null,
      category: null,
      example_chinese: null,
      example_pinyin: null,
    };
    expect(() => rowToWord(row)).not.toThrow();
  });
});

describe('PutBodySchema', () => {
  test('accepts { words: [] }', () => {
    expect(() => PutBodySchema.parse({ words: [] })).not.toThrow();
  });

  test('accepts { words: [w1, w2] }', () => {
    const w1 = newWord({ chinese: '你好', pinyin: 'nǐ hǎo' });
    const w2 = newWord({ chinese: '谢谢', pinyin: 'xiè xie' });
    expect(() => PutBodySchema.parse({ words: [w1, w2] })).not.toThrow();
  });

  test('rejects a bare Word object (not wrapped in { words })', () => {
    const word = newWord({ chinese: '你好', pinyin: 'nǐ hǎo' });
    expect(() => PutBodySchema.parse(word)).toThrow();
  });

  test('rejects a body missing the words key', () => {
    expect(() => PutBodySchema.parse({ notWords: [] })).toThrow();
  });
});

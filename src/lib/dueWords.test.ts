import { describe, expect, test } from 'bun:test';
import { isWordDue, getDueWords } from './dueWords';
import { newWord } from './schema';
import type { Word } from './schema';

const NOW = new Date('2024-06-15T12:00:00.000Z');
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function makeWord(overrides: Partial<Word> = {}): Word {
  return { ...newWord({ chinese: '好', pinyin: 'hǎo' }), ...overrides };
}

describe('isWordDue', () => {
  test('never-reviewed word (last_reviewed_at == null) is always due', () => {
    const word = makeWord({ last_reviewed_at: null });
    expect(isWordDue(word, NOW)).toBe(true);
  });

  test('exactly i days since last review is due', () => {
    const lastReviewed = new Date(NOW.getTime() - 1 * MS_PER_DAY).toISOString();
    const word = makeWord({ last_reviewed_at: lastReviewed, i: 1 });
    expect(isWordDue(word, NOW)).toBe(true);
  });

  test('more than i days since last review is due', () => {
    const lastReviewed = new Date(NOW.getTime() - 3 * MS_PER_DAY).toISOString();
    const word = makeWord({ last_reviewed_at: lastReviewed, i: 2 });
    expect(isWordDue(word, NOW)).toBe(true);
  });

  test('less than i days since last review is not due', () => {
    const lastReviewed = new Date(NOW.getTime() - 1 * MS_PER_DAY + 1).toISOString();
    const word = makeWord({ last_reviewed_at: lastReviewed, i: 2 });
    expect(isWordDue(word, NOW)).toBe(false);
  });

  test('one millisecond short of i days is not due', () => {
    const lastReviewed = new Date(NOW.getTime() - 6 * MS_PER_DAY + 1).toISOString();
    const word = makeWord({ last_reviewed_at: lastReviewed, i: 6 });
    expect(isWordDue(word, NOW)).toBe(false);
  });
});

describe('getDueWords', () => {
  test('returns only due words', () => {
    const due = makeWord({ last_reviewed_at: null });
    const notDue = makeWord({
      chinese: '你',
      pinyin: 'nǐ',
      last_reviewed_at: new Date(NOW.getTime() - 1).toISOString(),
      i: 1,
    });
    expect(getDueWords([due, notDue], NOW)).toEqual([due]);
  });

  test('sort order: nulls first, then ascending last_reviewed_at', () => {
    const older = makeWord({
      chinese: '一',
      pinyin: 'yī',
      last_reviewed_at: new Date(NOW.getTime() - 10 * MS_PER_DAY).toISOString(),
      i: 1,
    });
    const newer = makeWord({
      chinese: '二',
      pinyin: 'èr',
      last_reviewed_at: new Date(NOW.getTime() - 5 * MS_PER_DAY).toISOString(),
      i: 1,
    });
    const never = makeWord({ chinese: '三', pinyin: 'sān', last_reviewed_at: null });

    const result = getDueWords([newer, older, never], NOW);
    expect(result[0].chinese).toBe('三'); // null first
    expect(result[1].chinese).toBe('一'); // older next
    expect(result[2].chinese).toBe('二'); // newer last
  });

  test('limit truncates the result', () => {
    const words = [
      makeWord({ chinese: '一', pinyin: 'yī', last_reviewed_at: null }),
      makeWord({ chinese: '二', pinyin: 'èr', last_reviewed_at: null }),
      makeWord({ chinese: '三', pinyin: 'sān', last_reviewed_at: null }),
    ];
    expect(getDueWords(words, NOW, 2)).toHaveLength(2);
  });

  test('limit 0 returns empty array', () => {
    const words = [makeWord({ last_reviewed_at: null })];
    expect(getDueWords(words, NOW, 0)).toHaveLength(0);
  });

  test('no limit returns all due words', () => {
    const words = Array.from({ length: 5 }, (_, k) =>
      makeWord({ chinese: String(k), pinyin: String(k), last_reviewed_at: null }),
    );
    expect(getDueWords(words, NOW)).toHaveLength(5);
  });
});

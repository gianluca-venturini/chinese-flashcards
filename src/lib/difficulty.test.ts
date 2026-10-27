import { describe, expect, test } from 'bun:test';
import {
  compareByDifficulty,
  getDifficultyColor,
  getDifficultyLevel,
  getDifficultyScore,
  getHardestWords,
  scoreToColor,
} from './difficulty';
import { applySm2 } from './sm2';
import { newWord } from './schema';
import type { Word } from './schema';
import { DIFFICULTY_COLOR_STOPS, UNREVIEWED_COLOR } from './colors';

const REVIEWED_AT = '2024-06-15T12:00:00.000Z';

function makeWord(overrides: Partial<Word> = {}): Word {
  return { ...newWord({ chinese: '好', pinyin: 'hǎo' }), last_reviewed_at: REVIEWED_AT, ...overrides };
}

// Replays the grades of the review screen (0 = fail, 5 = correct) on a new word.
function wordAfter(grades: number[]): Word {
  let sr = { n: 0, ef: 2.5, i: 1 };
  for (const q of grades) sr = applySm2(sr, q);
  return makeWord(sr);
}

describe('getDifficultyLevel', () => {
  test('never-reviewed word is na', () => {
    expect(getDifficultyLevel(makeWord({ last_reviewed_at: null }))).toBe('na');
  });

  test('1 fail is medium', () => {
    expect(getDifficultyLevel(wordAfter([0]))).toBe('medium');
  });

  test('1 fail then 5 correct answers is easy', () => {
    expect(getDifficultyLevel(wordAfter([0, 5, 5, 5, 5, 5]))).toBe('easy');
  });

  test('2 fails is hard', () => {
    expect(getDifficultyLevel(wordAfter([0, 0]))).toBe('hard');
  });

  test('2 fails then 2 correct answers is hard', () => {
    expect(getDifficultyLevel(wordAfter([0, 0, 5, 5]))).toBe('hard');
  });

  test('only correct answers is easy', () => {
    expect(getDifficultyLevel(wordAfter([5, 5, 5]))).toBe('easy');
  });

  test('limits: 1.5 is hard, 1.51 is medium, 2.19 is medium, 2.2 is easy', () => {
    expect(getDifficultyLevel(makeWord({ ef: 1.5 }))).toBe('hard');
    expect(getDifficultyLevel(makeWord({ ef: 1.51 }))).toBe('medium');
    expect(getDifficultyLevel(makeWord({ ef: 2.19 }))).toBe('medium');
    expect(getDifficultyLevel(makeWord({ ef: 2.2 }))).toBe('easy');
  });
});

describe('getDifficultyScore', () => {
  test('is 0 at ef 1.3 and 1 at ef 2.5', () => {
    expect(getDifficultyScore(makeWord({ ef: 1.3 }))).toBe(0);
    expect(getDifficultyScore(makeWord({ ef: 2.5 }))).toBe(1);
  });

  test('is 1 above ef 2.5', () => {
    expect(getDifficultyScore(makeWord({ ef: 2.8 }))).toBe(1);
  });

  test('is null when not reviewed', () => {
    expect(getDifficultyScore(makeWord({ last_reviewed_at: null }))).toBeNull();
  });
});

describe('compareByDifficulty', () => {
  test('sorts lower ef first and never-reviewed words last', () => {
    const easy = makeWord({ chinese: '易', ef: 2.5 });
    const hard = makeWord({ chinese: '难', ef: 1.3 });
    const unreviewed = makeWord({ chinese: '新', last_reviewed_at: null });
    const sorted = [unreviewed, easy, hard].sort(compareByDifficulty);
    expect(sorted.map((w) => w.chinese)).toEqual(['难', '易', '新']);
  });

  test('on the same ef, a word failed last time (n = 0) goes first', () => {
    const recovering = makeWord({ chinese: '甲', ef: 1.3, n: 2 });
    const failed = makeWord({ chinese: '乙', ef: 1.3, n: 0 });
    expect([recovering, failed].sort(compareByDifficulty).map((w) => w.chinese)).toEqual(['乙', '甲']);
  });

  test('on the same ef and n, the older review goes first', () => {
    const recent = makeWord({ chinese: '甲', ef: 1.3, n: 0, last_reviewed_at: '2024-06-15T12:00:00.000Z' });
    const older = makeWord({ chinese: '乙', ef: 1.3, n: 0, last_reviewed_at: '2024-06-10T12:00:00.000Z' });
    expect([recent, older].sort(compareByDifficulty).map((w) => w.chinese)).toEqual(['乙', '甲']);
  });

  test('equal words are sorted by chinese, so the order is stable', () => {
    const a = makeWord({ chinese: 'b' });
    const b = makeWord({ chinese: 'a' });
    expect([a, b].sort(compareByDifficulty).map((w) => w.chinese)).toEqual(['a', 'b']);
  });
});

describe('colors', () => {
  test('gives the exact stop colors at 0, 0.5 and 1', () => {
    expect(scoreToColor(0)).toBe(DIFFICULTY_COLOR_STOPS[0]);
    expect(scoreToColor(0.5)).toBe(DIFFICULTY_COLOR_STOPS[2]);
    expect(scoreToColor(1)).toBe(DIFFICULTY_COLOR_STOPS[4]);
  });

  test('mixes the two nearest stops between them', () => {
    // Halfway between #E5989B and #F4B183.
    expect(scoreToColor(0.125)).toBe('#EDA58F');
  });

  test('gives gray for a never-reviewed word', () => {
    expect(getDifficultyColor(makeWord({ last_reviewed_at: null }))).toBe(UNREVIEWED_COLOR);
  });

  test('gives the hard color for ef 1.3', () => {
    expect(getDifficultyColor(makeWord({ ef: 1.3 }))).toBe(DIFFICULTY_COLOR_STOPS[0]);
  });
});

describe('getHardestWords', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const at = (daysAgo: number) => new Date(Date.parse(REVIEWED_AT) - daysAgo * DAY).toISOString();

  test('sorts Hard, then Medium, then Easy, then never reviewed', () => {
    const words = [
      makeWord({ chinese: '新', last_reviewed_at: null }),
      makeWord({ chinese: '易', ef: 2.5 }),
      makeWord({ chinese: '中', ef: 1.8 }),
      makeWord({ chinese: '难', ef: 1.3 }),
    ];
    expect(getHardestWords(words).map((w) => w.chinese)).toEqual(['难', '中', '易', '新']);
  });

  test('in one level, the oldest SM-2 due date comes first, not the lowest ef', () => {
    // 甲: ef 1.3, reviewed 1 day ago, i 1 -> due today.
    // 乙: ef 1.5, reviewed 10 days ago, i 6 -> due 4 days ago.
    const words = [
      makeWord({ chinese: '甲', ef: 1.3, i: 1, last_reviewed_at: at(1) }),
      makeWord({ chinese: '乙', ef: 1.5, i: 6, last_reviewed_at: at(10) }),
    ];
    expect(getHardestWords(words).map((w) => w.chinese)).toEqual(['乙', '甲']);
  });

  test('includes words that are not due yet', () => {
    const notDue = makeWord({ chinese: '难', ef: 1.3, i: 30, last_reviewed_at: new Date().toISOString() });
    expect(getHardestWords([notDue]).map((w) => w.chinese)).toEqual(['难']);
  });

  test('never-reviewed words are sorted by oldest created_at', () => {
    const words = [
      makeWord({ chinese: '甲', last_reviewed_at: null, created_at: at(1) }),
      makeWord({ chinese: '乙', last_reviewed_at: null, created_at: at(5) }),
    ];
    expect(getHardestWords(words).map((w) => w.chinese)).toEqual(['乙', '甲']);
  });

  test('removes deprecated words', () => {
    const words = [makeWord({ chinese: '旧', ef: 1.3, deprecated: true }), makeWord({ chinese: '难', ef: 1.3 })];
    expect(getHardestWords(words).map((w) => w.chinese)).toEqual(['难']);
  });

  test('limit cuts the result', () => {
    const words = [makeWord({ chinese: '难', ef: 1.3 }), makeWord({ chinese: '易', ef: 2.5 })];
    expect(getHardestWords(words, 1).map((w) => w.chinese)).toEqual(['难']);
  });
});

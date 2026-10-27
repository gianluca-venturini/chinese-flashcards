import { SR_DEFAULTS, type Word } from './schema';
import { DIFFICULTY_COLOR_STOPS, UNREVIEWED_COLOR } from './colors';

export type DifficultyLevel = 'hard' | 'medium' | 'easy' | 'na';

export const DIFFICULTY_LABELS: { [key in DifficultyLevel]: string } = {
  hard: 'Hard',
  medium: 'Medium',
  easy: 'Easy',
  na: 'Not reviewed',
};

// The review screen sends only grade 0 or 5, so ef goes down 0.8 for a fail
// and up 0.1 for a correct answer. A low ef means many recent fails.
export const EF_MIN = 1.3;
export const EF_START = SR_DEFAULTS.ef;
export const HARD_MAX_EF = 1.5;
export const EASY_MIN_EF = 2.2;

// Rounds away float errors such as 2.5 - 0.8 + 0.1 * 5 = 2.1999999999999997.
function roundedEf(word: Word): number {
  return Math.round(word.ef * 100) / 100;
}

export function getDifficultyLevel(word: Word): DifficultyLevel {
  if (word.last_reviewed_at === null) return 'na';
  const ef = roundedEf(word);
  if (ef <= HARD_MAX_EF) return 'hard';
  if (ef >= EASY_MIN_EF) return 'easy';
  return 'medium';
}

// 0 = hardest, 1 = easiest, null = not reviewed.
export function getDifficultyScore(word: Word): number | null {
  if (word.last_reviewed_at === null) return null;
  const score = (roundedEf(word) - EF_MIN) / (EF_START - EF_MIN);
  return Math.min(1, Math.max(0, score));
}

export function compareByDifficulty(a: Word, b: Word): number {
  const aReviewed = a.last_reviewed_at !== null;
  const bReviewed = b.last_reviewed_at !== null;
  if (aReviewed !== bReviewed) return aReviewed ? -1 : 1;
  if (aReviewed && bReviewed) {
    const efDiff = roundedEf(a) - roundedEf(b);
    if (efDiff !== 0) return efDiff;
    if (a.n !== b.n) return a.n - b.n;
    const dateDiff = Date.parse(a.last_reviewed_at!) - Date.parse(b.last_reviewed_at!);
    if (dateDiff !== 0) return dateDiff;
  }
  return a.chinese.localeCompare(b.chinese);
}

function hexToRgb(hex: string): [number, number, number] {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

function rgbToHex(rgb: [number, number, number]): string {
  return '#' + rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('').toUpperCase();
}

export function scoreToColor(score: number): string {
  const stops = DIFFICULTY_COLOR_STOPS;
  const position = Math.min(1, Math.max(0, score)) * (stops.length - 1);
  const index = Math.min(Math.floor(position), stops.length - 2);
  const t = position - index;
  const from = hexToRgb(stops[index]);
  const to = hexToRgb(stops[index + 1]);
  return rgbToHex([0, 1, 2].map((c) => from[c] + (to[c] - from[c]) * t) as [number, number, number]);
}

export function getDifficultyColor(word: Word): string {
  const score = getDifficultyScore(word);
  return score === null ? UNREVIEWED_COLOR : scoreToColor(score);
}

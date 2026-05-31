import { type Word } from './schema';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function isWordDue(word: Word, now: Date): boolean {
  if (word.last_reviewed_at === null) return true;
  return now.getTime() - new Date(word.last_reviewed_at).getTime() >= word.i * MS_PER_DAY;
}

export function getDueWords(words: Word[], now: Date, limit?: number): Word[] {
  const due = words.filter((w) => isWordDue(w, now));

  due.sort((a, b) => {
    if (a.last_reviewed_at === null && b.last_reviewed_at === null) return 0;
    if (a.last_reviewed_at === null) return -1;
    if (b.last_reviewed_at === null) return 1;
    return new Date(a.last_reviewed_at).getTime() - new Date(b.last_reviewed_at).getTime();
  });

  return limit !== undefined ? due.slice(0, limit) : due;
}

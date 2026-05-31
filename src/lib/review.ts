import { type Word } from './schema';
import { getWord, putWord } from './storage';
import { applySm2 } from './sm2';
import { ensureWords } from './sync';

export async function submitReview(chinese: string, q: number): Promise<Word> {
  const word = await getWord(chinese);
  if (!word) throw new Error(`Word not found in IDB: ${chinese}`);

  const { n, ef, i } = applySm2({ n: word.n, ef: word.ef, i: word.i }, q);

  const persisted = await putWord({
    ...word,
    n,
    ef,
    i,
    last_reviewed_at: new Date().toISOString(),
  });

  await ensureWords([persisted]);
  return persisted;
}

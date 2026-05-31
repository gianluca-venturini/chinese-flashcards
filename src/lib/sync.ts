import { type Word } from './schema';
import { getWord, putWord } from './storage';
import { fetchAllWords, putWords } from './apiClient';

const EPOCH = new Date(0).getTime();

function ts(updated_at: string | null): number {
  return updated_at ? new Date(updated_at).getTime() : EPOCH;
}

export function reconcile(local: Word | undefined, remote: Word): Word {
  if (!local) return remote;
  return ts(remote.updated_at) >= ts(local.updated_at) ? remote : local;
}

export async function syncFromServer(): Promise<void> {
  const remoteWords = await fetchAllWords();
  for (const remote of remoteWords) {
    const local = await getWord(remote.chinese);
    const winner = reconcile(local, remote);
    if (winner === remote) {
      await putWord(remote);
    }
  }
}

export async function ensureWords(words: Word[]): Promise<void> {
  if (words.length === 0) return;
  await putWords(words);
}

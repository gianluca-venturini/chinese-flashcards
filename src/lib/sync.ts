import { type Word } from './schema';
import { getAllWords, putWordsRaw } from './storage';
import { fetchAllWords, putWords } from './apiClient';

const EPOCH = new Date(0).getTime();

function ts(updated_at: string | null): number {
  return updated_at ? new Date(updated_at).getTime() : EPOCH;
}

export function reconcile(local: Word | undefined, remote: Word): Word {
  if (!local) return remote;
  return ts(remote.updated_at) >= ts(local.updated_at) ? remote : local;
}

export type SyncDiff = {
  toPull: Word[];
  toPush: Word[];
};

export type SyncStatus = {
  staleLocal: number;
  staleRemote: number;
};

export function diffWords(local: Word[], remote: Word[]): SyncDiff {
  const localMap = new Map(local.map((w) => [w.chinese, w]));
  const remoteMap = new Map(remote.map((w) => [w.chinese, w]));

  const toPull: Word[] = [];
  const toPush: Word[] = [];

  for (const [chinese, remoteWord] of remoteMap) {
    const localWord = localMap.get(chinese);
    if (!localWord || ts(remoteWord.updated_at) > ts(localWord.updated_at)) {
      toPull.push(remoteWord);
    }
  }

  for (const [chinese, localWord] of localMap) {
    const remoteWord = remoteMap.get(chinese);
    if (!remoteWord || ts(localWord.updated_at) > ts(remoteWord.updated_at)) {
      toPush.push(localWord);
    }
  }

  return { toPull, toPush };
}

export function toSyncStatus(syncDiff: SyncDiff): SyncStatus {
  return {
    staleLocal: syncDiff.toPull.length,
    staleRemote: syncDiff.toPush.length,
  };
}

export async function syncFromServer(): Promise<void> {
  const [remoteWords, localWords] = await Promise.all([fetchAllWords(), getAllWords()]);
  const { toPull } = diffWords(localWords, remoteWords);
  await putWordsRaw(toPull);
}

export async function syncBidirectional(): Promise<{ pulled: number; pushed: number }> {
  const [remoteWords, localWords] = await Promise.all([fetchAllWords(), getAllWords()]);
  const { toPull, toPush } = diffWords(localWords, remoteWords);
  await putWordsRaw(toPull);
  await putWords(toPush);
  return { pulled: toPull.length, pushed: toPush.length };
}

export async function ensureWords(words: Word[]): Promise<void> {
  if (words.length === 0) return;
  await putWords(words);
}

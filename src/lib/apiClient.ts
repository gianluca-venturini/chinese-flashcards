import { z } from 'zod';
import {
  type Word,
  type GeneratedRow,
  type GeneratedField,
  WordSchema,
  GeneratedRowSchema,
} from './schema';

const FetchAllWordsResponseSchema = z.object({
  words: z.array(WordSchema),
});

const PutWordsResponseSchema = z.object({
  success: z.boolean(),
});

const CreateWordResponseSchema = z.object({
  word: WordSchema,
});

const GenerateFieldsResponseSchema = z.object({
  row: GeneratedRowSchema.partial(),
});

const API_TIMEOUT_MS = 60_000;

// Wraps fetch with an AbortController timeout so API calls fail fast when the
// network is unavailable or the server's auth validation hangs (e.g. Stack
// reaching its remote backend while the device has no internet access).
function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  return fetch(input, { ...init, signal: controller.signal }).finally(() =>
    clearTimeout(timer),
  );
}

async function parseJson<T>(res: Response, schema: z.ZodType<T>): Promise<T> {
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return schema.parse(await res.json());
}

export async function fetchAllWords(): Promise<Word[]> {
  const res = await fetchWithTimeout('/api/words');
  return (await parseJson(res, FetchAllWordsResponseSchema)).words;
}

export async function putWords(words: Word[]): Promise<void> {
  if (words.length === 0) return;
  const res = await fetchWithTimeout('/api/words/sync', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ words }),
  });
  await parseJson(res, PutWordsResponseSchema);
}

// Creates one word on the server. The server makes all its fields with the LLM.
export async function createWord(chinese: string): Promise<Word> {
  const res = await fetchWithTimeout('/api/words', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chinese }),
  });
  return (await parseJson(res, CreateWordResponseSchema)).word;
}

// Makes only the given fields of one word with the LLM. Saves nothing.
export async function generateFields(
  chinese: string,
  fields: Exclude<GeneratedField, 'chinese'>[],
): Promise<Partial<GeneratedRow>> {
  const res = await fetchWithTimeout('/api/words', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chinese, fields }),
  });
  return (await parseJson(res, GenerateFieldsResponseSchema)).row;
}

// Runs fn on each item, with at most `limit` calls at the same time.
// Results keep the order of items.
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

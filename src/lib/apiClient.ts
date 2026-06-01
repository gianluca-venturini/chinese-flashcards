import { z } from 'zod';
import { type Word, WordSchema } from './schema';
import { type CategoryId, CATEGORY_IDS } from './categories';

const FetchAllWordsResponseSchema = z.object({
  words: z.array(WordSchema),
});

const ClassifyResponseSchema = z.object({
  classifications: z.array(
    z.object({
      word: z.string(),
      category: z.enum([...CATEGORY_IDS] as [string, ...string[]]),
    }),
  ),
});

const TranslateResponseSchema = z.object({
  translations: z.array(
    z.object({
      word: z.string(),
      english: z.string(),
    }),
  ),
});

const ExamplifyResponseSchema = z.object({
  examples: z.array(
    z.object({
      word: z.string(),
      example_chinese: z.string(),
      example_pinyin: z.string(),
    }),
  ),
});

const PutWordsResponseSchema = z.object({
  success: z.boolean(),
});

const PinyinResponseSchema = z.object({
  pinyins: z.array(
    z.object({
      word: z.string(),
      pinyin: z.string(),
    }),
  ),
});

const API_TIMEOUT_MS = 10_000;

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
  const res = await fetchWithTimeout('/api/words', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ words }),
  });
  await parseJson(res, PutWordsResponseSchema);
}

export async function classifyWords(
  chinese: string[],
): Promise<{ word: string; category: CategoryId }[]> {
  if (chinese.length === 0) return [];
  const res = await fetchWithTimeout('/api/words/classify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chinese }),
  });
  return (await parseJson(res, ClassifyResponseSchema)).classifications as {
    word: string;
    category: CategoryId;
  }[];
}

export async function translateWords(
  chinese: string[],
): Promise<{ word: string; english: string }[]> {
  if (chinese.length === 0) return [];
  const res = await fetchWithTimeout('/api/words/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ words: chinese }),
  });
  return (await parseJson(res, TranslateResponseSchema)).translations;
}

export async function examplifyWords(
  targets: string[],
  knownWords: string[],
): Promise<{ word: string; example_chinese: string; example_pinyin: string }[]> {
  if (targets.length === 0) return [];
  const res = await fetchWithTimeout('/api/words/examplify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ words: targets, knownWords }),
  });
  return (await parseJson(res, ExamplifyResponseSchema)).examples;
}

export async function generatePinyin(
  chinese: string[],
): Promise<{ word: string; pinyin: string }[]> {
  if (chinese.length === 0) return [];
  const res = await fetchWithTimeout('/api/words/pinyin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chinese }),
  });
  return (await parseJson(res, PinyinResponseSchema)).pinyins;
}

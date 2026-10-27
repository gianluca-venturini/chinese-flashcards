import { z } from 'zod';
import { CATEGORY_IDS, type CategoryId } from './categories';

export const WordSchema = z.object({
  chinese: z.string(),
  pinyin: z.string(),
  created_at: z.iso.datetime(),
  i: z.int().min(1),
  ef: z.number().min(1.3),
  n: z.int().min(0),
  english: z.string().nullable(),
  category: z.enum([...CATEGORY_IDS] as [string, ...string[]]).nullable(),
  example_chinese: z.string().nullable(),
  example_pinyin: z.string().nullable(),
  example_english: z.string().nullable(),
  last_reviewed_at: z.iso.datetime().nullable(),
  updated_at: z.iso.datetime().nullable(),
  deprecated: z.boolean(),
});

export type Word = z.infer<typeof WordSchema>;

// The row fields that the LLM makes. The order matters: the model writes the
// example sentence before its pinyin and its translation.
export const GeneratedRowSchema = z.object({
  chinese: z.string().describe('The input Chinese word, unchanged'),
  pinyin: z.string().describe('The pinyin of the word with tone marks, e.g. nǐ hǎo'),
  english: z.string().describe('A short, learner-friendly English translation'),
  category: z.enum(CATEGORY_IDS).describe('The category ID'),
  example_chinese: z.string().describe('A short example sentence in Chinese that contains the word'),
  example_pinyin: z.string().describe('The pinyin of example_chinese, syllable for syllable, with the same punctuation'),
  example_english: z.string().describe('A natural English translation of example_chinese'),
});

export type GeneratedRow = z.infer<typeof GeneratedRowSchema>;
export type GeneratedField = keyof GeneratedRow;
export const GENERATED_FIELDS = GeneratedRowSchema.keyof().options;

export const SR_DEFAULTS = {
  n: 0,
  ef: 2.5,
  i: 1,
  last_reviewed_at: null,
} as const;

export function newWord(input: {
  chinese: string;
  pinyin: string;
  english?: string | null;
  category?: CategoryId | null;
  example_chinese?: string | null;
  example_pinyin?: string | null;
  example_english?: string | null;
}): Word {
  const now = new Date().toISOString();
  return {
    chinese: input.chinese,
    pinyin: input.pinyin,
    english: input.english ?? null,
    category: input.category ?? null,
    example_chinese: input.example_chinese ?? null,
    example_pinyin: input.example_pinyin ?? null,
    example_english: input.example_english ?? null,
    created_at: now,
    updated_at: now,
    deprecated: false,
    ...SR_DEFAULTS,
  };
}

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
  last_reviewed_at: z.iso.datetime().nullable(),
  updated_at: z.iso.datetime().nullable(),
  deprecated: z.boolean(),
});

export type Word = z.infer<typeof WordSchema>;

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
}): Word {
  const now = new Date().toISOString();
  return {
    chinese: input.chinese,
    pinyin: input.pinyin,
    english: input.english ?? null,
    category: input.category ?? null,
    example_chinese: null,
    example_pinyin: null,
    created_at: now,
    updated_at: now,
    deprecated: false,
    ...SR_DEFAULTS,
  };
}

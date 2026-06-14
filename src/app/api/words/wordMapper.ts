import { z } from 'zod';
import { WordSchema, type Word } from '@/lib/schema';

export const PutBodySchema = z.object({
  words: z.array(WordSchema),
});

function toIso(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'string') return v;
  return null;
}

export function rowToWord(row: Record<string, unknown>): Word {
  return WordSchema.parse({
    chinese: row.chinese,
    pinyin: row.pinyin,
    english: row.english ?? null,
    created_at: row.created_at instanceof Date
      ? row.created_at.toISOString()
      : String(row.created_at),
    category: row.category ?? null,
    i: Number(row.i),
    ef: Number(row.ef),
    n: Number(row.n),
    example_chinese: row.example_chinese ?? null,
    example_pinyin: row.example_pinyin ?? null,
    example_english: row.example_english ?? null,
    last_reviewed_at: toIso(row.last_reviewed_at),
    updated_at: toIso(row.updated_at),
    deprecated: Boolean(row.deprecated),
  });
}

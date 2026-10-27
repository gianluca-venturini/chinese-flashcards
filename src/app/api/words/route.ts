import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { stackServerApp } from '@/stack';
import { newWord, GENERATED_FIELDS, type Word, type GeneratedRow } from '@/lib/schema';
import { generateWordRow } from '@/lib/generateWord';
import {
  rowToWord,
  CreateBodySchema,
  GenerateBodySchema,
} from './wordMapper';

export const maxDuration = 60;

const EXAMPLE_FIELDS = ['example_chinese', 'example_pinyin', 'example_english'];

async function getKnownWords(userId: string): Promise<string[]> {
  const rows = await sql`
    SELECT chinese FROM words WHERE user_id = ${userId} AND english IS NOT NULL
  `;
  return rows.map((r) => r.chinese as string);
}

async function getWordRow(userId: string, chinese: string): Promise<Word | null> {
  const rows = await sql`SELECT * FROM words WHERE user_id = ${userId} AND chinese = ${chinese}`;
  return rows.length > 0 ? rowToWord(rows[0] as Record<string, unknown>) : null;
}

export async function GET() {
  try {
    const user = await stackServerApp.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', success: false }, { status: 401 });
    }

    const rows = await sql`SELECT * FROM words WHERE user_id = ${user.id}`;
    const words: Word[] = [];
    for (const row of rows) {
      try {
        words.push(rowToWord(row as Record<string, unknown>));
      } catch (e) {
        console.warn('Skipping malformed word row:', row, e);
      }
    }

    return NextResponse.json({ words, success: true });
  } catch (error) {
    console.error('Error fetching words:', error);
    return NextResponse.json({ error: 'Failed to fetch words', success: false }, { status: 500 });
  }
}

// Creates one word: the LLM makes all fields, then the row is saved.
export async function PUT(request: NextRequest) {
  try {
    const user = await stackServerApp.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', success: false }, { status: 401 });
    }

    const body = await request.json();
    const parsed = CreateBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid body', success: false },
        { status: 400 },
      );
    }

    const { chinese } = parsed.data;
    if (await getWordRow(user.id, chinese)) {
      return NextResponse.json({ error: 'Word already exists', success: false }, { status: 409 });
    }

    const row = await generateWordRow({
      chinese,
      fields: GENERATED_FIELDS,
      knownWords: await getKnownWords(user.id),
    });

    // The input word stays the key; the LLM cannot change it.
    const word = newWord({
      chinese,
      pinyin: row.pinyin ?? chinese,
      english: row.english ?? null,
      category: row.category ?? null,
      example_chinese: row.example_chinese ?? null,
      example_pinyin: row.example_pinyin ?? null,
      example_english: row.example_english ?? null,
    });

    const inserted = await sql`
      INSERT INTO words (
        chinese, user_id, pinyin, english, created_at, n, ef, i,
        category, example_chinese, example_pinyin, example_english,
        last_reviewed_at, updated_at,
        deprecated
      ) VALUES (
        ${word.chinese}, ${user.id}, ${word.pinyin}, ${word.english},
        ${word.created_at}, ${word.n}, ${word.ef}, ${word.i},
        ${word.category}, ${word.example_chinese}, ${word.example_pinyin}, ${word.example_english},
        ${word.last_reviewed_at}, ${word.updated_at},
        ${word.deprecated}
      )
      ON CONFLICT (chinese, user_id) DO NOTHING
      RETURNING chinese
    `;
    if (inserted.length === 0) {
      return NextResponse.json({ error: 'Word already exists', success: false }, { status: 409 });
    }

    return NextResponse.json({ word, success: true });
  } catch (error) {
    console.error('Error creating word:', error);
    return NextResponse.json({ error: 'Failed to create word', success: false }, { status: 500 });
  }
}

// Makes only the requested fields of one word. Does not save anything.
export async function POST(request: NextRequest) {
  try {
    const user = await stackServerApp.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', success: false }, { status: 401 });
    }

    const body = await request.json();
    const parsed = GenerateBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid body', success: false },
        { status: 400 },
      );
    }

    const { chinese, fields } = parsed.data;
    const needsExamples = fields.some((f) => EXAMPLE_FIELDS.includes(f));
    const [existing, knownWords] = await Promise.all([
      getWordRow(user.id, chinese),
      needsExamples ? getKnownWords(user.id) : undefined,
    ]);

    const current: Partial<GeneratedRow> | undefined = existing
      ? { pinyin: existing.pinyin, english: existing.english ?? undefined }
      : undefined;

    const row = await generateWordRow({ chinese, fields, current, knownWords });
    return NextResponse.json({ row, success: true });
  } catch (error) {
    console.error('Error generating word fields:', error);
    return NextResponse.json({ error: 'Failed to generate word fields', success: false }, { status: 500 });
  }
}

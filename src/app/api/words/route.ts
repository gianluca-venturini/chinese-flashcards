import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { stackServerApp } from '@/stack';
import { type Word } from '@/lib/schema';
import { rowToWord, PutBodySchema } from './wordMapper';

export { rowToWord, PutBodySchema };

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

export async function PUT(request: NextRequest) {
  try {
    const user = await stackServerApp.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', success: false }, { status: 401 });
    }

    const body = await request.json();
    const parsed = PutBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid body', success: false },
        { status: 400 },
      );
    }

    const { words } = parsed.data;
    if (words.length === 0) {
      return NextResponse.json({ success: true });
    }

    await sql.begin(async (sql) => {
      for (const word of words) {
        await sql`
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
          ON CONFLICT (chinese, user_id) DO UPDATE SET
            pinyin = EXCLUDED.pinyin,
            english = EXCLUDED.english,
            n = EXCLUDED.n,
            ef = EXCLUDED.ef,
            i = EXCLUDED.i,
            category = EXCLUDED.category,
            example_chinese = EXCLUDED.example_chinese,
            example_pinyin = EXCLUDED.example_pinyin,
            example_english = EXCLUDED.example_english,
            last_reviewed_at = EXCLUDED.last_reviewed_at,
            updated_at = EXCLUDED.updated_at,
            deprecated = EXCLUDED.deprecated
        `;
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error upserting words:', error);
    return NextResponse.json({ error: 'Failed to upsert words', success: false }, { status: 500 });
  }
}

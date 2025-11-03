import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import type { Word } from '@/lib/db';

export const runtime = 'edge';

export async function GET() {
  try {
    const words = await sql<Word[]>`
      SELECT id, chinese, pinyin, english, created_at
      FROM words
      ORDER BY id
    `;

    return NextResponse.json({ words, success: true });
  } catch (error) {
    console.error('Error fetching words:', error);
    return NextResponse.json(
      { error: 'Failed to fetch words', success: false },
      { status: 500 }
    );
  }
}


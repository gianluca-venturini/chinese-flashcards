import { NextResponse } from 'next/server';
import { sql, Word } from '@/lib/db';

export const runtime = 'edge';

export async function GET() {
  try {
    const words = await sql`
      SELECT chinese, pinyin, english, created_at
      FROM words
    ` as Word[];

    return NextResponse.json({ words, success: true });
  } catch (error) {
    console.error('Error fetching words:', error);
    return NextResponse.json(
      { error: 'Failed to fetch words', success: false },
      { status: 500 }
    );
  }
}


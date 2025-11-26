import { NextResponse } from 'next/server';
import { sql, Word } from '@/lib/db';
import { stackServerApp } from '@/stack';

export async function GET(request: Request) {
  try {
    // Check if user is authenticated
    const user = await stackServerApp.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', success: false },
        { status: 401 }
      );
    }

    // Extract query parameters
    const { searchParams } = new URL(request.url);
    const all = searchParams.get('all') === 'true';

    // Fetch words for the authenticated user
    let words: Word[];
    if (all) {
      // Fetch all words for the user
      words = await sql`
      SELECT chinese, pinyin, english, created_at, category
      FROM words
      WHERE user_id = ${user.id}
      ORDER BY created_at DESC
      ` as Word[];
    } else {
      const limit = 10;
      // Fetch words that are due for review
      words = await sql`
        SELECT chinese, pinyin, english, created_at, category
        FROM words
        WHERE user_id = ${user.id}
          AND (
            last_review_applied_timestamp IS NULL
            OR last_review_applied_timestamp + (i * INTERVAL '1 day') < NOW()
          )
        ORDER BY last_review_applied_timestamp ASC NULLS FIRST, created_at DESC
        LIMIT ${limit}
      ` as Word[];
    }

    return NextResponse.json({ words, success: true });
  } catch (error) {
    console.error('Error fetching words:', error);
    return NextResponse.json(
      { error: 'Failed to fetch words', success: false },
      { status: 500 }
    );
  }
}


import { NextResponse } from 'next/server';
import { sql, Word } from '@/lib/db';
import { stackServerApp } from '@/stack';

export const runtime = 'edge';

export async function GET() {
  try {
    // Check if user is authenticated
    const user = await stackServerApp.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', success: false },
        { status: 401 }
      );
    }

    // Fetch words only for the authenticated user
    const words = await sql`
      SELECT chinese, pinyin, english, created_at
      FROM words
      WHERE user_id = ${user.id}
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


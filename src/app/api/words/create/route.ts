import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { stackServerApp } from '@/stack';
import { generatePinyin } from '@/lib/translate';

export async function POST(request: NextRequest) {
  try {
    const user = await stackServerApp.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', success: false },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { chinese, english } = body;

    if (!chinese || typeof chinese !== 'string') {
      return NextResponse.json(
        { error: 'chinese parameter is required and must be a string', success: false },
        { status: 400 }
      );
    }

    if (!english || typeof english !== 'string') {
      return NextResponse.json(
        { error: 'english parameter is required and must be a string', success: false },
        { status: 400 }
      );
    }

    const pinyin = await generatePinyin(chinese);

    const result = await sql`
      INSERT INTO words (chinese, pinyin, english, user_id)
      VALUES (${chinese}, ${pinyin}, ${english}, ${user.id})
      ON CONFLICT DO NOTHING
      RETURNING chinese, pinyin, english, created_at, category, i, ef, n
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Word already exists', success: false },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      word: result[0],
    });
  } catch (error) {
    console.error('Error creating word:', error);
    return NextResponse.json(
      { error: 'Failed to create word', success: false },
      { status: 500 }
    );
  }
}

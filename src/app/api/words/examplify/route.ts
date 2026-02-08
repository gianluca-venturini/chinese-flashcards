import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { stackServerApp } from '@/stack';
import { generateExampleSentences, generatePinyin } from '@/lib/translate';
import { z } from 'zod';

const RequestSchema = z.object({
  words: z.array(z.string()).min(1, 'At least one word is required'),
});

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
    const parseResult = RequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0].message, success: false },
        { status: 400 }
      );
    }

    const { words } = parseResult.data;

    // Fetch all user's words for known vocabulary context
    const allWords = await sql`
      SELECT chinese FROM words WHERE user_id = ${user.id}
    `;
    const knownWords = allWords.map((w) => w.chinese as string);

    // Generate example sentences
    const examples = await generateExampleSentences(words, knownWords);

    // Generate pinyin for each example sentence in parallel
    const examplesWithPinyin = await Promise.all(
      examples.map(async (ex) => {
        const example_pinyin = await generatePinyin(ex.example_chinese);
        return { word: ex.word, example_chinese: ex.example_chinese, example_pinyin };
      })
    );

    return NextResponse.json({
      success: true,
      examples: examplesWithPinyin,
    });
  } catch (error) {
    console.error('Error generating examples:', error);
    return NextResponse.json(
      { error: 'Failed to generate examples', success: false },
      { status: 500 }
    );
  }
}

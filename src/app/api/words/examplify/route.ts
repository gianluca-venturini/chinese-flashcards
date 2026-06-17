import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { stackServerApp } from '@/stack';
import { generateExampleSentences, generatePinyin } from '@/lib/translate';

const RequestSchema = z.object({
  words: z.array(z.string()).min(1, 'At least one word is required'),
  knownWords: z.array(z.string()),
});

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const user = await stackServerApp.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', success: false }, { status: 401 });
    }

    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message, success: false },
        { status: 400 },
      );
    }

    const { words, knownWords } = parsed.data;
    const examples = await generateExampleSentences(words, knownWords);

    const examplesWithPinyin = await Promise.all(
      examples.map(async (ex) => ({
        word: ex.word,
        example_chinese: ex.example_chinese,
        example_pinyin: await generatePinyin(ex.example_chinese),
        example_english: ex.example_english,
      })),
    );

    return NextResponse.json({ examples: examplesWithPinyin, success: true });
  } catch (error) {
    console.error('Error generating examples:', error);
    return NextResponse.json({ error: 'Failed to generate examples', success: false }, { status: 500 });
  }
}

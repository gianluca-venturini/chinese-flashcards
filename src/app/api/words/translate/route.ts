import { NextRequest, NextResponse } from 'next/server';
import { stackServerApp } from '@/stack';
import { translateChineseWords, TranslationResult } from '@/lib/translate';
import { z } from 'zod';

const RequestSchema = z.object({
  words: z.array(z.string()).min(1, 'At least one word is required'),
});

export async function POST(request: NextRequest) {
  try {
    // Check if user is authenticated
    const user = await stackServerApp.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', success: false },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const parseResult = RequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0].message, success: false },
        { status: 400 }
      );
    }

    const { words } = parseResult.data;

    // Translate words
    const translations: TranslationResult[] = await translateChineseWords(words);

    return NextResponse.json({
      success: true,
      translations,
    });
  } catch (error) {
    console.error('Error translating words:', error);
    return NextResponse.json(
      { error: 'Failed to translate words', success: false },
      { status: 500 }
    );
  }
}

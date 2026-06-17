import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { stackServerApp } from '@/stack';
import { generatePinyin } from '@/lib/translate';

const RequestSchema = z.object({
  chinese: z.array(z.string()).min(1, 'At least one word is required'),
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

    const pinyins = await Promise.all(
      parsed.data.chinese.map(async (word) => ({
        word,
        pinyin: await generatePinyin(word),
      })),
    );

    return NextResponse.json({ pinyins, success: true });
  } catch (error) {
    console.error('Error generating pinyin:', error);
    return NextResponse.json({ error: 'Failed to generate pinyin', success: false }, { status: 500 });
  }
}

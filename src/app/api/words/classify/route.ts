import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { stackServerApp } from '@/stack';
import { classifyChineseWords } from '@/lib/categories';

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

    const classifications = await classifyChineseWords(parsed.data.chinese);
    return NextResponse.json({ classifications, success: true });
  } catch (error) {
    console.error('Error classifying words:', error);
    return NextResponse.json({ error: 'Failed to classify words', success: false }, { status: 500 });
  }
}

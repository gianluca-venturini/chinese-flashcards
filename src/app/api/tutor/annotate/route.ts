import { NextRequest, NextResponse } from 'next/server';
import { stackServerApp } from '@/stack';
import { z } from 'zod';
import { annotateSentence } from '@/lib/tutor/annotate';

export const maxDuration = 60;

const RequestSchema = z.object({
  hanzi: z.string().min(1, 'hanzi is required'),
});

// Returns pinyin + English for a Chinese sentence, used to backfill the tutor's
// lines, whose on-screen text comes from the audio transcript (Hanzi only).
export async function POST(request: NextRequest) {
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

  try {
    const { pinyin, english } = await annotateSentence(parseResult.data.hanzi);
    return NextResponse.json({ success: true, pinyin, english });
  } catch (error) {
    console.error('Failed to annotate sentence:', error);
    return NextResponse.json(
      { error: 'Failed to annotate sentence', success: false },
      { status: 500 }
    );
  }
}

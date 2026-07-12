import { NextResponse } from 'next/server';
import { stackServerApp } from '@/stack';
import { REALTIME_MODEL, REALTIME_VOICE } from '@/lib/tutor/config';

export const maxDuration = 60;

// Mints a short-lived credential for a browser realtime tutor session.
// Auth-gated so only signed-in learners can start a session.
export async function POST() {
  const user = await stackServerApp.getUser();

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized', success: false },
      { status: 401 }
    );
  }

  // The ephemeral token is attached in task 3.2; the model and voice the
  // browser should connect with are resolved server-side from config.
  return NextResponse.json({
    success: true,
    model: REALTIME_MODEL,
    voice: REALTIME_VOICE,
  });
}

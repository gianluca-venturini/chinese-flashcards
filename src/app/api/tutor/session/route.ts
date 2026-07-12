import { NextResponse } from 'next/server';
import { stackServerApp } from '@/stack';
import { REALTIME_MODEL, REALTIME_VOICE } from '@/lib/tutor/config';

export const maxDuration = 60;

const OPENAI_CLIENT_SECRETS_URL = 'https://api.openai.com/v1/realtime/client_secrets';

// Mints a short-lived credential for a browser realtime tutor session.
// Auth-gated so only signed-in learners can start a session. The long-lived
// OPENAI_API_KEY stays server-side; the browser only ever receives the
// short-lived ephemeral token.
export async function POST() {
  const user = await stackServerApp.getUser();

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized', success: false },
      { status: 401 }
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('OPENAI_API_KEY is not set');
    return NextResponse.json(
      { error: 'Server not configured for the voice tutor', success: false },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(OPENAI_CLIENT_SECRETS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session: {
          type: 'realtime',
          model: REALTIME_MODEL,
          audio: { output: { voice: REALTIME_VOICE } },
        },
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error('Failed to mint realtime token:', response.status, detail);
      return NextResponse.json(
        { error: 'Failed to create tutor session', success: false },
        { status: 502 }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      token: data.value,
      expiresAt: data.expires_at ?? null,
      model: REALTIME_MODEL,
      voice: REALTIME_VOICE,
    });
  } catch (error) {
    console.error('Error creating tutor session:', error);
    return NextResponse.json(
      { error: 'Failed to create tutor session', success: false },
      { status: 500 }
    );
  }
}

import { describe, expect, test, mock, beforeEach } from 'bun:test';

// Mock Stack auth so we can flip the signed-in user per test.
let currentUser: { id: string } | null = null;
mock.module('@/stack', () => ({
  stackServerApp: { getUser: async () => currentUser },
}));

const { POST } = await import('./route');

const originalFetch = global.fetch;

beforeEach(() => {
  currentUser = null;
  process.env.OPENAI_API_KEY = 'test-key';
  global.fetch = originalFetch;
});

describe('POST /api/tutor/session', () => {
  test('returns 401 when the user is not authenticated', async () => {
    currentUser = null;
    const res = await POST();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('returns the ephemeral token and connection info when authenticated', async () => {
    currentUser = { id: 'user-1' };
    global.fetch = mock(
      async () =>
        new Response(JSON.stringify({ value: 'ek_test_123', expires_at: 1234567890 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
    ) as unknown as typeof fetch;

    const res = await POST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.token).toBe('ek_test_123');
    expect(body.expiresAt).toBe(1234567890);
    expect(typeof body.model).toBe('string');
    expect(typeof body.voice).toBe('string');
  });

  test('never leaks the long-lived API key to the client', async () => {
    currentUser = { id: 'user-1' };
    global.fetch = mock(
      async () =>
        new Response(JSON.stringify({ value: 'ek_test_123', expires_at: 1 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
    ) as unknown as typeof fetch;

    const res = await POST();
    const raw = await res.text();
    expect(raw).not.toContain('test-key');
  });

  test('returns 502 when the provider rejects the mint request', async () => {
    currentUser = { id: 'user-1' };
    global.fetch = mock(
      async () => new Response('nope', { status: 400 })
    ) as unknown as typeof fetch;

    const res = await POST();
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.success).toBe(false);
  });
});

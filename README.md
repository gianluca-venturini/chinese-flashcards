# Chinese Flashcards

## Getting Started
Run the development server:

```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Database Setup
Seed the database (creates tables and runs migrations):

```bash
bun run scripts/seed-db.ts
```

Requires `DATABASE_URL` to be set in `.env.local`.

## Chinese Voice Tutor

The `/tutor` page runs a real-time, speech-to-speech Mandarin tutor (李老师) using the OpenAI Realtime API over WebRTC. Environment variables (see `.env.example`):

- `OPENAI_API_KEY` (required) — also used by the word AI routes; the realtime session is authorized with a short-lived ephemeral token minted server-side, so this key never reaches the browser.
- `REALTIME_VOICE` (optional) — the tutor's voice; defaults to `marin`.
- `OPENAI_REALTIME_MODEL` (optional) — the realtime model id; defaults to `gpt-realtime`.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Get local variables from Vercel
```bash
vercel env pull .env.local
```
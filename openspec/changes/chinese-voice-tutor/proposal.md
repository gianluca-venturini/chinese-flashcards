## Why

The app currently teaches Chinese through flashcards and spaced repetition, which builds recognition and recall but never exercises the two skills that matter most for real conversation: **listening to tones and speaking them aloud**. A real-time voice tutor closes that gap by letting a learner talk to a patient Mandarin teacher that hears their pronunciation directly and responds in spoken Chinese, while a synchronized on-screen panel shows Hanzi, pinyin, and English so the learner is never lost.

## What Changes

- Add a `/tutor` page hosting a browser-based, real-time voice conversation with an AI Mandarin teacher persona (李老师 / Lǐ Lǎoshī).
- Establish a native audio-in / audio-out realtime session between the browser and a speech-to-speech model (OpenAI Realtime primary, Google Gemini Live as a fallback provider), so the model hears raw microphone audio — tones and all — with no separate transcription step, and speaks back in Mandarin.
- Configure the session for natural turn-taking: server-side voice-activity detection, barge-in (learner can interrupt), and both text + audio modalities.
- Drive all on-screen text from **model tool calls**, not transcript parsing:
  - `display_utterance` is called for every sentence the teacher speaks, rendering Hanzi (large), pinyin with tone marks (medium, muted), and English (small, italic).
  - `show_correction` is called when correcting pronunciation, rendering a visually distinct amber correction card with the target word and a tone hint.
- Add a scrollable conversation panel that preserves the full history of tutor utterances (with correction styling retained) and learner turns (transcript when available), with auto-scroll that yields when the user scrolls up.
- Add session controls (Start/Stop, Mute) and explicit session-state indicators (idle, connecting, listening, thinking, speaking, error with reconnect).
- Add a server route that mints short-lived credentials for the realtime session so provider API keys never reach the browser.

## Capabilities

### New Capabilities
- `voice-tutor-session`: Establishing and managing the real-time speech-to-speech session — provider selection and abstraction, ephemeral credential minting, session configuration (VAD, barge-in, modalities, voice), the teacher persona and pedagogy, the two display tool contracts, and session lifecycle/state.
- `voice-tutor-ui`: The learner-facing surface — the live utterance display, correction cards, the scrollable conversation history, session controls, and state indicators.

### Modified Capabilities
<!-- None — this is a net-new capability with no changes to existing spec-level behavior. -->

## Impact

- **New page/route**: `src/app/tutor/page.tsx` and supporting client components.
- **New API route**: an authenticated endpoint that returns an ephemeral realtime session token (guarded by Stack auth, following the existing `src/app/api/words/*` route conventions).
- **New client library**: a realtime-session client/hook plus a provider abstraction layer.
- **Dependencies**: relies on the browser's microphone (`getUserMedia`) and the realtime transport (WebRTC/WebSocket). Requires provider access to a realtime model and new environment variables (e.g. `REALTIME_VOICE`, provider API keys already present for OpenAI).
- **No changes** to the existing flashcard/SRS data model, sync, or storage.
- **Note**: the installed stack is Next.js 16 + AI SDK v5 (`ai@^5`, `@ai-sdk/openai@^2`); AI SDK does not currently ship a realtime hook, so the transport is implemented directly against the provider's Realtime API. This reconciliation is detailed in `design.md`.

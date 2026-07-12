## 1. Setup & dependencies

- [x] 1.1 Add `REALTIME_VOICE` (and any realtime model id) to env handling and document required vars in README/`.env.local` example
- [x] 1.2 Initialize shadcn/ui targeting Base UI with the neutral base color, scoped so it does not disturb existing pages; verify it builds with Tailwind v4
- [x] 1.3 Add the shadcn primitives the tutor needs (button, card, toggle, and a select/segmented control for the sensitivity level) under `src/components/ui/`
- [x] 1.4 Add AI SDK Elements via the shadcn registry into `src/components/ai-elements/` — `conversation`, `message`, and `persona` — and confirm `Conversation`/`Message` render without a `useChat` provider and `Persona`'s Rive runtime loads/performs acceptably
- [x] 1.5 Confirm the exact shadcn init + registry `add` commands against current docs and record them as `package.json` scripts (e.g. `ui:add:*`) so the component installs are self-documenting/reproducible

## 2. Types & prompt

- [x] 2.1 Create `src/lib/tutor/types.ts`: conversation entry types (utterance, correction, learner turn), session state enum (idle/connecting/listening/thinking/speaking/error), sensitivity level type (LOW/MEDIUM/HIGH)
- [x] 2.2 Create `src/lib/tutor/prompt.ts`: system prompt builder taking a sensitivity level, encoding the 李老师 persona, Chinese-only ordinary speech, mixed-language verbal correction explanations, HSK2 baseline, LOW/MEDIUM/HIGH thresholds for pronunciation + grammar, and the tool-usage rules
- [x] 2.3 Define the two tool schemas (`display_utterance` = {hanzi, pinyin, english}; `show_correction` = {targetHanzi, targetPinyin, description}) with the minimal fields

## 3. Ephemeral credential endpoint

- [x] 3.1 Create `POST /api/tutor/session/route.ts` following existing route conventions (Stack auth → 401 if unauthenticated, `maxDuration = 60`, JSON response)
- [x] 3.2 Mint a short-lived realtime session token server-side using the existing OpenAI key; return `{ token, model, voice }` and never expose the long-lived key
- [x] 3.3 Add a test covering the unauthenticated 401 path and the shape of a successful response

## 4. Provider abstraction

- [x] 4.1 Create `src/lib/tutor/provider.ts`: define the `RealtimeProvider` interface (mint-credentials contract, build session config, interpret events/tool-calls/state)
- [x] 4.2 Implement the OpenAI Realtime provider behind the interface; leave a documented seam for a future Gemini Live impl (no full Gemini adapter in this change)

## 5. Realtime session hook

- [x] 5.1 Create `src/lib/tutor/useTutorSession.ts`: fetch ephemeral token, set up `RTCPeerConnection`, capture mic via `getUserMedia`, attach remote audio track to an `<audio>` element started on the user gesture
- [x] 5.2 Open the `oai-events` data channel and send `session.update` with modalities `["text","audio"]`, `server_vad` turn detection (barge-in), persona/system prompt, and tool definitions
- [x] 5.3 Parse data-channel events into typed conversation entries (`display_utterance`, `show_correction`), append learner turns from input transcription when available, and fall back to transcript text if a tutor turn emits no tool call
- [x] 5.4 Drive the session state machine (idle → connecting → listening ↔ thinking ↔ speaking, error) and expose start/stop, mute, and reconnect actions; stopping releases the mic and closes the connection
- [x] 5.6 Add Web Audio `AnalyserNode`s on the mic stream and the remote tutor track; expose live audio-activity signals (which source is active + amplitude) so the UI can drive the `Persona` visual reactively
- [x] 5.5 Support changing the sensitivity level mid-session by re-sending `session.update` with a regenerated prompt

## 6. Tutor UI

- [x] 6.1 Create `src/app/tutor/page.tsx`, auth-gated per app conventions, laid out chat-forward with a full-height thread and a pinned bottom dock; use `ConversationEmptyState` for the idle "press start" state
- [x] 6.2 Build the pinned dock: `Persona` state visual mapping session state → `idle/listening/thinking/speaking` and driven by the live audio-activity signals from 5.6 so it reacts to the learner's mic and the tutor's voice (custom red error/reconnect treatment for `error`), the current live utterance (Hanzi + pinyin), Start/Stop and Mute (with visual muted indicator), and the sensitivity control (LOW/MEDIUM/HIGH, default MEDIUM, visible active level)
- [x] 6.3 Build the live utterance display in the dock: Hanzi `text-2xl`, pinyin medium/muted, English small italic secondary
- [x] 6.4 Render the thread with Elements `Conversation`/`ConversationContent`: tutor turns as left `Message` bubbles (🎓 李老师) with Hanzi/pinyin/English, learner turns as right `Message` bubbles (🎤 You); rely on `Conversation` auto-scroll + `ConversationScrollButton` for the scrolled-up case
- [x] 6.5 Build the inline correction card (amber styling `bg-amber-50 border-l-4 border-amber-400`, dark `bg-amber-950/30 border-amber-500`) rendered in the thread flow, showing target Hanzi/pinyin, the `description`, and the retry label; covers pronunciation and grammar, and retains its styling in scrollback

## 8. Tool-call fallback backfill

<!-- Found during 7.1: the realtime model sometimes speaks without calling
     display_utterance, so those teacher lines showed Hanzi only (from the audio
     transcript) with no pinyin/english. -->

- [x] 8.1 Strengthen the `display_utterance` instructions in the system prompt so the model calls it for every spoken sentence
- [x] 8.2 Add a sentence-annotation endpoint (`POST /api/tutor/annotate`) and lib that returns `{ pinyin, english }` for a full Chinese sentence, auth-gated per route conventions
- [ ] 8.3 In `useTutorSession`, when a fallback (transcript-only) utterance is created, backfill its pinyin/english from the annotate endpoint and update the entry in place

## 7. Verification

- [ ] 7.1 Manually exercise a session end-to-end: mic permission, speaking, hearing a Mandarin reply, utterance/correction rendering, barge-in, mute, stop/reconnect, and switching sensitivity levels
- [ ] 7.2 Verify light/dark styling of the correction card and state indicators
- [ ] 7.3 Run `bun run lint` and `bun test`, and confirm `bun run build` succeeds

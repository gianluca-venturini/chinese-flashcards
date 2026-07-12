## Context

The app is a Next.js 16 (App Router) + React 19 + TypeScript flashcard app using Stack for auth, Postgres for storage, AI SDK v5 (`ai@^5`, `@ai-sdk/openai@^2`) for its existing text AI routes, and Tailwind v4. Server AI routes (`src/app/api/words/*`) share a pattern: `stackServerApp.getUser()` for auth, Zod request validation, `maxDuration = 60`, and JSON `NextResponse` with `{ success }`. The app currently styles with plain Tailwind and has no component library.

This change adds a real-time, speech-to-speech Mandarin tutor at `/tutor`. The learner talks; a speech-to-speech model hears the raw audio (tones included), replies in spoken Mandarin, and drives an on-screen text panel via tool calls.

The original request described AI SDK 7 and an `experimental_useRealtime` hook. Those do not exist in the installed toolchain (AI SDK is v5, and AI SDK does not currently ship a browser realtime hook). This design reconciles that: we implement the realtime transport directly against the provider's Realtime API and keep a thin provider abstraction so the UI is provider-agnostic.

## Goals / Non-Goals

**Goals:**

- Establish a browser ↔ model speech-to-speech session with no STT step in the audio path.
- Keep provider API keys server-side; the browser uses only ephemeral credentials.
- Render all text from `display_utterance` / `show_correction` tool calls, not transcript parsing.
- Support a learner-selectable correction sensitivity level (LOW/MEDIUM/HIGH) covering pronunciation and grammar.
- Provider abstraction with OpenAI Realtime primary and a documented path to Gemini Live.
- Clear session lifecycle/state surfaced to the UI, built on shadcn/ui (Base UI, neutral) components.

**Non-Goals:**

- Persisting tutor sessions/transcripts to Postgres (in-memory for the session only).
- Integrating tutor activity with the SRS/flashcard data model.
- Building the Gemini Live adapter fully in this change (abstraction + primary provider only; Gemini is a follow-up behind the same interface).
- Migrating the rest of the app's existing UI to shadcn (only the new `/tutor` surface adopts it here).
- Multi-user or shared sessions.

## Decisions

### Transport: OpenAI Realtime over WebRTC, direct (not via an AI SDK hook)

Browser realtime audio is best served by WebRTC: the browser captures the mic track, adds it to an `RTCPeerConnection`, and receives the model's audio as a remote track played through an `<audio>` element. Tool calls and session events flow over a WebRTC **data channel** (`oai-events`). We connect using an **ephemeral token** minted server-side.

- **Alternative — WebSocket with manual PCM streaming:** works but forces us to handle audio capture/encode/resample and playback buffering by hand. WebRTC handles jitter, echo cancellation, and playback natively. Rejected as primary.
- **Alternative — wait for an AI SDK realtime hook:** not available in v5; blocking on it stalls the feature. Rejected.

We wrap the connection in a client hook `useTutorSession` that exposes state and events, isolating WebRTC details from the UI.

### Ephemeral credential endpoint

Add `POST /api/tutor/session` following existing route conventions: require `stackServerApp.getUser()` (401 otherwise), then call the provider's REST endpoint (server-side, using the existing OpenAI key) to create a realtime session and return `{ token, model, voice }`. The token is short-lived and single-session. The browser never sees the long-lived key.

- Voice comes from `REALTIME_VOICE` (default e.g. `marin`); model id is a server constant/env.

### Session configuration (persona, tools, sensitivity)

On data-channel open, the client sends a `session.update` carrying: modalities `["text","audio"]`, `turn_detection: { type: "server_vad" }` (barge-in enabled), the system prompt (persona + pedagogy), and the two tool definitions. The **correction sensitivity level** is injected into the system prompt text; changing it re-sends `session.update` with regenerated instructions so it takes effect on subsequent turns without reconnecting.

The system prompt encodes: 李老师 persona, Chinese-only for ordinary talk, mixed-language verbal explanation for corrections, HSK2 baseline, the LOW/MEDIUM/HIGH thresholds for pronunciation+grammar, and the rule that corrections go through `show_correction` (never `display_utterance`).

### Tool-call-driven display

The two tools are declared in the session. When the model emits a function call over the data channel, `useTutorSession` parses it and appends a typed entry to the conversation state:

- `display_utterance({ hanzi, pinyin, english })` → utterance entry.
- `show_correction({ targetHanzi, targetPinyin, description })` → correction entry (amber card).

Both may occur in one turn. Learner turns are appended from input-audio transcription events when available. UI state is a single ordered list of entries; the live display shows the latest, the panel shows history.

### UI component layer: shadcn/ui with Base UI (neutral)

The `/tutor` surface is built with shadcn/ui configured against **Base UI** primitives and the **neutral** base color. shadcn components are copied into the repo (`src/components/ui/*`) and composed by the tutor components, giving accessible primitives (buttons, toggles, cards, select/segmented control for the sensitivity level) consistent with a design system rather than ad-hoc Tailwind.

- **Alternative — hand-rolled Tailwind (current app style):** fine for the existing pages but weaker on accessibility and consistency for interactive controls (toggle, select). Rejected for the new interactive surface.
- **Scope:** only the tutor surface adopts shadcn now; the rest of the app is untouched to avoid a broad refactor. Exact `shadcn` CLI init flags (Base UI, neutral) are confirmed at implementation against current shadcn docs.
- **Documenting installs:** the exact registry/CLI commands used to add shadcn and each Elements component are recorded as `package.json` scripts (e.g. `ui:add:*`) so the setup is reproducible and self-documenting rather than living only in shell history.
- Amber correction-card styling is applied on top of the shadcn Card via the Tailwind classes named in the spec.

### AI SDK Elements for the chat surface

On top of shadcn, the tutor UI uses **AI SDK Elements** (elements.ai-sdk.dev) — shadcn-registry components that install into `src/components/ai-elements/*`:

- **`Conversation`** (`ConversationContent`, `ConversationScrollButton`, `ConversationEmptyState`) — the scrollable thread. Its built-in "auto-scroll to bottom with a scroll button when scrolled up" behavior directly satisfies the auto-scroll requirement, so we do not hand-roll that logic. `ConversationEmptyState` covers the idle "press start" state.
- **`Message` / `MessageContent`** — tutor and learner bubbles. Hanzi/pinyin/English render inside a tutor `Message`; the amber correction card is a custom element rendered inline in the thread (not a `Message`).
- **`Persona`** — a Rive/WebGL2 animated AI "blob" driven by `state` (`idle | listening | thinking | speaking | asleep`), used as the tutor's avatar/state indicator in the pinned dock. Our session states map to it: connecting → `thinking`, listening → `listening`, thinking → `thinking`, speaking → `speaking`, idle → `idle`/`asleep`; the `error` state is not a Persona state, so the dock renders a distinct red error/reconnect treatment instead.
- **Persona reacts to live audio, not just coarse state.** Two Web Audio `AnalyserNode`s — one on the mic capture stream, one on the remote (tutor) audio track — produce running amplitude. The dominant live source flips `Persona` between `listening` (learner audio present) and `speaking` (tutor audio present), and the amplitude feeds the visual's intensity where the API allows, so the blob visibly reacts to who is talking and how loudly, settling to `idle` when both are quiet. `useTutorSession` exposes these audio-activity signals so the dock stays a thin consumer.

- **Important — presentational use, not `useChat`:** Elements are documented alongside `@ai-sdk/react`'s `useChat`, but our conversation state comes from the realtime session (`useTutorSession`), not `useChat`. We use the Elements components purely presentationally, mapping our own entry list onto `Message`/`Conversation` and passing `state` to `Persona`. No `useChat` wiring.
- **Alternative considered — build the thread from bare shadcn primitives:** more code and we'd re-implement the scroll/scroll-button behavior Elements already ships. Rejected.

### Layout direction: chat-forward

The chosen layout (validated via prototype) is **chat-forward**, built on the Elements `Conversation`: the conversation history is the primary, full-height column laid out as a message thread — tutor turns as left-aligned `Message` bubbles (🎓 李老师) with Hanzi/pinyin/English, learner turns as right-aligned `Message` bubbles (🎤 You), and corrections as full-width inline amber cards in the flow. A **pinned dock** sits at the bottom holding the `Persona` state visual, the current live utterance (Hanzi + pinyin), the sensitivity segmented control, and the Stop/Mute controls. Newest content sits at the bottom; `Conversation`'s built-in auto-scroll follows it and `ConversationScrollButton` handles the scrolled-up case.

- The state indicator is the `Persona` visual in the dock (idle/listening/thinking/speaking), with a distinct red error/reconnect treatment for the `error` state (not a Persona state).
- Palette from the prototype: cool-neutral ground, **jade** accent for active/identity, **amber** strictly for corrections, **red** strictly for errors.
- **Alternatives considered:** *Immersion* (single centered utterance, history hidden) — calm but hides context; *Split workspace* (stage + persistent transcript) — great for study but needs width. Chat-forward was chosen for familiarity and for keeping corrections visible inline. The other two remain easy pivots since the UI spec is layout-agnostic.

### Provider abstraction

A `RealtimeProvider` interface encapsulates: how to mint credentials (server), how to build the `session.update` config, and how to interpret events (tool calls, state). OpenAI is the concrete impl now; Gemini Live slots behind the same interface later. The UI/hook depend only on the interface, so swapping is a config/impl change, satisfying "swap = model-string change" in spirit.

### File layout

- `src/app/tutor/page.tsx` — page (auth-gated).
- `src/app/tutor/*` — client components: session controls, state indicator, live display, correction card, conversation panel, sensitivity control.
- `src/components/ui/*` — shadcn/ui (Base UI) primitives.
- `src/components/ai-elements/*` — AI SDK Elements (`Conversation`, `Message`, `Persona`, …) installed via the registry.
- `src/app/api/tutor/session/route.ts` — ephemeral credential route.
- `src/lib/tutor/useTutorSession.ts` — client hook (WebRTC + data channel + state machine).
- `src/lib/tutor/provider.ts` — provider abstraction + OpenAI impl.
- `src/lib/tutor/prompt.ts` — system prompt builder (takes sensitivity level).
- `src/lib/tutor/types.ts` — entry/state/tool types.

## Risks / Trade-offs

- **Model may not reliably call the display tools** → Prompt strongly requires a `display_utterance` per sentence; if a turn produces audio with no tool call, fall back to the audio transcript so the panel is never empty. Because that transcript has Hanzi only, the client then backfills pinyin/english for the fallback line via a sentence-annotation endpoint (`/api/tutor/annotate`) and updates the entry in place, so every teacher line still shows all three. (Observed in practice during verification; see tasks group 8.)
- **WebRTC/browser audio complexity (autoplay, echo, permissions)** → Play remote audio via a user-gesture-initiated `<audio>` element (Start button is the gesture); request mic with `getUserMedia`; surface permission-denied as an actionable error state.
- **Provider/AI-SDK mismatch (requested v7 hook absent)** → Documented above; direct WebRTC integration behind `useTutorSession` insulates callers, so a future AI SDK realtime hook is an internal swap.
- **shadcn + Base UI + Tailwind v4 setup friction** → Confirm the CLI supports the Base UI target for this shadcn/Tailwind v4 version at implementation; keep adoption scoped to the tutor surface so any friction is contained.
- **AI SDK Elements assume `useChat`; Persona is heavy WebGL2/Rive** → We use Elements presentationally with our own state, so verify `Conversation`/`Message` render fine without a `useChat` provider. `Persona` pulls a Rive runtime and renders an abstract "AI blob" — confirm it fits the 李老师 identity and performs acceptably; if not, fall back to a lightweight custom mic/state indicator in the dock (the prototype's orb/waveform) behind the same `state` prop.
- **Gemini Live protocol differs from OpenAI** → Kept as non-goal for full impl; abstraction boundary defined now so it doesn't require UI changes later.
- **Latency / cost of realtime models** → Session is user-initiated and explicitly stopped; ephemeral tokens are single-session; no background sessions.
- **Sensitivity level is prompt-enforced, not deterministic** → Accept as inherent to LLM behavior; thresholds are described qualitatively (HSK2 baseline) and tunable in `prompt.ts` without spec changes.
- **VAD false triggers / barge-in cutting off the tutor** → Rely on provider server_vad defaults initially; expose no tuning in this change, revisit if it misbehaves.

## Migration Plan

Net-new, additive. Deploy requires the OpenAI key (already present) and optional `REALTIME_VOICE`; adds shadcn/ui dev tooling, Base UI, AI SDK Elements components (and their transitive deps such as `@ai-sdk/react` and the Rive runtime for `Persona`). No schema/data migration. Rollback = remove the `/tutor` route, `/api/tutor/session`, and the tutor libs; the added `src/components/ui/*` and `src/components/ai-elements/*` are inert if unused.

## Open Questions

- Which exact OpenAI realtime model id/voice to standardize on (pin via env/constant at implementation time).
- Whether input-audio transcription should be enabled for learner-turn text (adds cost/latency but improves the conversation panel); default to enabled if cheap, else show learner turns as a generic "🎤 You" marker.
- Whether the sensitivity level should persist across sessions (localStorage) or reset to MEDIUM each visit — leaning localStorage, confirm during implementation.
- Exact shadcn CLI init flags/registry for Base UI + neutral on this Tailwind v4 setup.

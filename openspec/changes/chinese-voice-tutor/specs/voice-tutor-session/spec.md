## ADDED Requirements

### Requirement: Ephemeral realtime credentials

The system SHALL mint short-lived realtime session credentials on the server so that provider API keys are never exposed to the browser. The endpoint SHALL require an authenticated user.

#### Scenario: Authenticated user requests a session token

- **WHEN** an authenticated user requests a realtime session credential
- **THEN** the server returns a short-lived ephemeral token scoped to a single realtime session, along with the model id and voice to use

#### Scenario: Unauthenticated request is rejected

- **WHEN** a request for a realtime session credential arrives without a valid authenticated user
- **THEN** the server responds with a 401 and no credential is issued

#### Scenario: Provider key stays server-side

- **WHEN** the browser establishes a realtime session
- **THEN** it uses only the ephemeral token and never receives the long-lived provider API key

### Requirement: Native audio-in / audio-out session

The system SHALL establish a speech-to-speech realtime session in which raw microphone audio is streamed directly to the model and the model's spoken Mandarin audio is streamed back and played, with no intermediate speech-to-text step in the primary audio path.

#### Scenario: Learner speaks and hears a reply

- **WHEN** the learner speaks into the microphone during an active session
- **THEN** the model receives the raw audio (preserving tones and pronunciation) and responds with spoken Mandarin audio that is played back to the learner

#### Scenario: Microphone permission denied

- **WHEN** the browser denies microphone access
- **THEN** the session does not start and the learner is shown an actionable error

### Requirement: Turn-taking and barge-in

The session SHALL use server-side voice-activity detection for turn detection and SHALL allow the learner to interrupt (barge in) while the tutor is speaking.

#### Scenario: Server VAD ends the learner's turn

- **WHEN** the learner stops speaking
- **THEN** server-side VAD detects end-of-turn and the tutor begins its response without the learner pressing a button

#### Scenario: Learner interrupts the tutor

- **WHEN** the learner begins speaking while the tutor is still speaking
- **THEN** the tutor's current audio playback stops promptly and the tutor listens to the learner

### Requirement: Provider abstraction

The system SHALL treat the realtime provider as swappable behind an abstraction, with OpenAI Realtime as the primary provider and Google Gemini Live as a fallback. Selecting a provider/model SHALL not require changes to the UI layer.

#### Scenario: Primary provider is used by default

- **WHEN** no provider override is configured
- **THEN** the session connects using the OpenAI Realtime provider

#### Scenario: Voice is configurable

- **WHEN** the `REALTIME_VOICE` environment variable is set
- **THEN** the configured voice is used for the tutor's spoken audio, and a sensible default is used when it is unset

### Requirement: Teacher persona and pedagogy

The session SHALL be configured with a system prompt establishing the persona 李老师 (Lǐ Lǎoshī), a patient Mandarin tutor who speaks only Chinese, asks the learner questions, starts with simple topics (greetings, introductions) and increases complexity based on the learner's demonstrated level, and praises correct answers. When the tutor corrects the learner it SHALL take the time to talk through the correction verbally, explaining the mistake and the fix in mixed Chinese and English so a beginner can follow, rather than only flagging it.

#### Scenario: Tutor speaks only Chinese for ordinary conversation

- **WHEN** the tutor produces an ordinary conversational response
- **THEN** the response is in Mandarin Chinese

#### Scenario: Tutor verbally explains a correction

- **WHEN** the tutor corrects the learner
- **THEN** the tutor takes the time to explain the mistake and the fix in mixed Chinese and English, models the correct form, and waits for the learner to try again before continuing

### Requirement: Correction sensitivity level

The tutor SHALL correct both pronunciation and grammar, and how aggressively it corrects SHALL be governed by a learner-selected sensitivity level with three settings. The level SHALL be included in the session configuration and applied to the tutor's behavior. The default SHALL be MEDIUM.

- **LOW**: The tutor almost never corrects; it corrects only when the learner's speech is essentially nonsense or unintelligible.
- **MEDIUM**: Assuming an HSK2-level learner, the tutor tolerates slightly-off pronunciation and minor grammar mistakes, and corrects only when the meaning is not readily intelligible.
- **HIGH**: The tutor holds a high bar — pronunciation must be very good and grammar mostly correct, otherwise it corrects.

#### Scenario: Level changes correction frequency

- **WHEN** the learner sets the sensitivity level to LOW versus HIGH
- **THEN** at LOW the tutor lets minor pronunciation and grammar errors pass and corrects only near-unintelligible speech, while at HIGH the tutor corrects small pronunciation and grammar imperfections

#### Scenario: Default level

- **WHEN** the learner has not chosen a sensitivity level
- **THEN** the session uses MEDIUM, tolerating minor errors for an HSK2-level learner and correcting only when meaning is unclear

#### Scenario: Changing the level takes effect

- **WHEN** the learner changes the sensitivity level
- **THEN** subsequent tutor turns follow the new level's correction behavior

### Requirement: Display tool contracts

The model SHALL be given two tools and instructed to call them alongside its audio so the UI can render text without parsing transcripts. Each tool SHALL carry only the fields the UI needs to render, keeping the schemas minimal. The two tools are distinct in purpose: `display_utterance` renders ordinary teacher speech, and `show_correction` renders a correction — a correction is never rendered as a plain utterance. Both tools MAY be called in the same turn when the tutor corrects the learner and then continues with ordinary conversation.

The `display_utterance` tool SHALL accept `{ hanzi: string, pinyin: string, english: string }`, where `pinyin` uses tone marks (e.g. `nǐ hǎo`), and SHALL be called for each ordinary sentence the teacher speaks.

The `show_correction` tool SHALL accept `{ targetHanzi: string, targetPinyin: string, description: string }` and SHALL be used for both pronunciation and grammar corrections. `description` is a free-form explanation of the mistake and the fix, matching what the tutor says aloud and mixing English and Chinese as needed (e.g. "second tone, not fourth tone" or "用『了』because it already happened"). It SHALL be called whenever the tutor corrects the learner, and it is the only tool used to render a correction.

#### Scenario: Ordinary sentence emits an utterance

- **WHEN** the tutor speaks an ordinary sentence that is not a correction
- **THEN** the model calls `display_utterance` with matching Hanzi, tone-marked pinyin, and English, and does not call `show_correction`

#### Scenario: Correction emits a correction card

- **WHEN** the tutor corrects the learner's pronunciation or grammar
- **THEN** the model calls `show_correction` with the target word/phrase and a `description` that matches the tutor's spoken explanation, and the correction is rendered by that tool rather than as a `display_utterance`

#### Scenario: Correcting and continuing in one turn

- **WHEN** the tutor both corrects the learner and continues with a new ordinary sentence in the same turn
- **THEN** the model calls `show_correction` for the correction and `display_utterance` for the continuing sentence

### Requirement: Session lifecycle and state

The session SHALL expose a well-defined lifecycle so the UI can reflect it: idle, connecting, listening, thinking, speaking, and error. On a recoverable error the session SHALL surface a reconnect path.

#### Scenario: State transitions during a normal turn

- **WHEN** a session is active and the learner speaks then falls silent
- **THEN** the state moves from listening to thinking to speaking and back to listening as the tutor responds

#### Scenario: Error state offers recovery

- **WHEN** the realtime connection drops or a provider error occurs
- **THEN** the session enters the error state, surfaces a message, and offers a way to reconnect

#### Scenario: Stopping the session releases the microphone

- **WHEN** the learner stops the session
- **THEN** the microphone capture stops, the connection is closed, and the state returns to idle

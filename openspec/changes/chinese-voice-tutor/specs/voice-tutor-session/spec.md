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

### Requirement: Push-to-talk turn-taking

The session SHALL use push-to-talk turn-taking rather than automatic voice-activity detection, so the tutor never responds until the learner explicitly ends their turn. While the learner holds the talk control, their microphone audio is sent; on release, the learner's turn is committed and the tutor responds. If the learner starts talking while the tutor is speaking, the tutor's current response SHALL be interrupted so it stops talking over the learner.

#### Scenario: Tutor waits for the learner to release

- **WHEN** the learner is holding the talk control and pauses mid-sentence
- **THEN** the tutor does not respond, and it begins its response only after the learner releases the control

#### Scenario: Learner interrupts the tutor

- **WHEN** the learner starts talking (presses the talk control) while the tutor is still speaking
- **THEN** the tutor's current audio stops promptly and the session captures the learner's turn

#### Scenario: Microphone only captures while held

- **WHEN** the learner is not holding the talk control
- **THEN** no microphone audio is sent to the model

### Requirement: Provider abstraction

The system SHALL treat the realtime provider as swappable behind an abstraction, with OpenAI Realtime as the primary provider and Google Gemini Live as a fallback. Selecting a provider/model SHALL not require changes to the UI layer.

#### Scenario: Primary provider is used by default

- **WHEN** no provider override is configured
- **THEN** the session connects using the OpenAI Realtime provider

#### Scenario: Voice is configurable

- **WHEN** the `REALTIME_VOICE` environment variable is set
- **THEN** the configured voice is used for the tutor's spoken audio, and a sensible default is used when it is unset

### Requirement: Teacher persona and pedagogy

The session SHALL be configured with a system prompt establishing the persona 李老师 (Lǐ Lǎoshī), a patient Mandarin tutor who speaks only Chinese for ordinary conversation, responds to the learner (rather than repeating them) and moves the conversation forward, asks the learner questions, starts with simple topics (greetings, introductions) and increases complexity based on the learner's demonstrated level, and praises correct answers. Corrections are delivered verbally within the conversation: when the tutor corrects the learner it SHALL take the time to explain the mistake and the fix in mixed Chinese and English so a beginner can follow, model the correct form, and wait for the learner to try again.

#### Scenario: Tutor speaks only Chinese for ordinary conversation

- **WHEN** the tutor produces an ordinary conversational response
- **THEN** the response is spoken in Mandarin Chinese

#### Scenario: Tutor responds instead of echoing

- **WHEN** the learner says something (e.g. gives their name)
- **THEN** the tutor responds to it and advances the conversation, rather than repeating the learner's words back

#### Scenario: Tutor verbally explains a correction

- **WHEN** the tutor corrects the learner
- **THEN** the tutor explains the mistake and the fix aloud in mixed Chinese and English, models the correct form, and waits for the learner to try again before continuing

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

### Requirement: Teacher text from transcript

The system SHALL render the tutor's on-screen text from the session's audio transcript rather than from model tool calls, so that producing text never competes with producing speech. Because the transcript provides Chinese characters only, the client SHALL backfill pinyin (with tone marks) and an English translation for each tutor line and display all three. The session SHALL NOT declare display/correction tools.

#### Scenario: Teacher line rendered from transcript

- **WHEN** the tutor finishes speaking a turn
- **THEN** the tutor's spoken text is rendered on screen from the audio transcript, and its pinyin and English are backfilled and shown

#### Scenario: Backfill failure degrades gracefully

- **WHEN** the pinyin/English backfill for a tutor line fails
- **THEN** the line still displays its Chinese text and the session continues

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

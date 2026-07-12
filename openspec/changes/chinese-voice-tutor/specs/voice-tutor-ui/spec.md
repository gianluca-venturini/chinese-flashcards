## ADDED Requirements

### Requirement: Tutor page

The system SHALL provide a `/tutor` page that hosts the voice tutoring experience and is available to authenticated users following the app's existing auth conventions.

#### Scenario: Learner opens the tutor

- **WHEN** an authenticated learner navigates to `/tutor`
- **THEN** the page renders in the idle state with a control to start a session

### Requirement: Live utterance display

The UI SHALL render each tutor line as three lines: Hanzi large (`text-2xl`), pinyin medium and muted, and English small and italic (secondary). Pinyin and English may arrive shortly after the Hanzi (via backfill); the UI SHALL show them as soon as they are available.

#### Scenario: Utterance renders three lines

- **WHEN** a tutor line is displayed and its pinyin/English are available
- **THEN** the UI shows the Hanzi prominently, the tone-marked pinyin below it in a muted medium size, and the English in small italic secondary text

#### Scenario: Hanzi shown before backfill completes

- **WHEN** a tutor line has been rendered but its pinyin/English backfill has not yet returned
- **THEN** the UI shows the Hanzi immediately and fills in pinyin/English when they arrive

### Requirement: Correction sensitivity control

The UI SHALL let the learner choose the tutor's correction sensitivity level — LOW, MEDIUM, or HIGH — with MEDIUM selected by default, and SHALL apply the chosen level to the session. The current level SHALL be visible.

#### Scenario: Learner selects a level

- **WHEN** the learner selects LOW, MEDIUM, or HIGH
- **THEN** the UI reflects the selected level and the session is configured to use it for subsequent tutor turns

#### Scenario: Default level shown

- **WHEN** the learner has not changed the setting
- **THEN** the control shows MEDIUM as the active level

### Requirement: Conversation panel

The UI SHALL maintain a scrollable conversation history containing all tutor and learner turns. Tutor entries SHALL show a 🎓 李老师 badge with Hanzi/pinyin/English; learner entries SHALL show a 🎤 You badge with the transcript when available.

#### Scenario: History accumulates both speakers

- **WHEN** the tutor and learner exchange turns
- **THEN** each turn is appended to the conversation panel with the correct speaker badge and content

### Requirement: Auto-scroll behavior

The conversation panel SHALL auto-scroll to the latest entry, except when the user has scrolled up, in which case new entries SHALL NOT force-scroll the view.

#### Scenario: Auto-scroll when at bottom

- **WHEN** a new entry arrives and the panel is scrolled to the bottom
- **THEN** the panel scrolls to reveal the new entry

#### Scenario: No hijack when scrolled up

- **WHEN** a new entry arrives while the user has scrolled up to read earlier history
- **THEN** the panel does not force-scroll and preserves the user's scroll position

### Requirement: Session controls

The UI SHALL provide a Start/Stop control and a Mute toggle with a clear visual indicator of the muted state.

#### Scenario: Start and stop a session

- **WHEN** the learner activates the Start control
- **THEN** a session begins; and **WHEN** the learner activates Stop, the session ends and returns to idle

#### Scenario: Mute toggle

- **WHEN** the learner toggles Mute
- **THEN** the microphone input is suppressed and the UI shows a clear muted indicator, and toggling again resumes input

### Requirement: Session-state indicators

The UI SHALL display a distinct indicator for each session state: idle, connecting (spinner), listening, thinking (spinner), speaking, and error (message plus reconnect button). The listening and speaking indicators SHALL be an animated visual that reacts to live audio — responding to the learner's microphone input while listening and to the tutor's voice while speaking — rather than a static or purely time-based animation.

#### Scenario: Indicator reflects current state

- **WHEN** the session is in a given state
- **THEN** the UI shows the matching indicator for that state

#### Scenario: Indicator reacts to live audio

- **WHEN** the learner is speaking into the microphone (listening) or the tutor is speaking (speaking)
- **THEN** the animated visual reacts to the corresponding live audio level, visibly reflecting who is talking and their loudness, and settles when audio is quiet

#### Scenario: Error indicator offers reconnect

- **WHEN** the session is in the error state
- **THEN** the UI shows the error message and a reconnect button that re-establishes the session

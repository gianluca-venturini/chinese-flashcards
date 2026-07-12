// Shared types for the voice tutor session and its UI.

/** How aggressively 李老师 corrects the learner. */
export type SensitivityLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export const DEFAULT_SENSITIVITY: SensitivityLevel = 'MEDIUM';

/** Lifecycle of a realtime tutor session, surfaced to the UI. */
export type SessionState =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'error';

/** A sentence spoken by the tutor. Hanzi comes from the audio transcript; pinyin
 *  and english are backfilled shortly after (empty until then). */
export interface TeacherUtterance {
  kind: 'utterance';
  id: string;
  hanzi: string;
  pinyin: string;
  english: string;
}

/** A learner turn, from input-audio transcription when available. */
export interface LearnerTurn {
  kind: 'learner';
  id: string;
  /** Transcript of what the learner said; empty when transcription is unavailable. */
  text: string;
}

/** One entry in the ordered conversation history. */
export type ConversationEntry = TeacherUtterance | LearnerTurn;

/** Which live audio source is currently dominant, used to drive the Persona visual. */
export type AudioActivity = 'none' | 'learner' | 'tutor';

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

/** A sentence spoken by the tutor, rendered from a `display_utterance` tool call. */
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

/** A pronunciation or grammar correction, rendered from a `show_correction` tool call. */
export interface CorrectionEntry {
  kind: 'correction';
  id: string;
  targetHanzi: string;
  targetPinyin: string;
  /** Free-form explanation of the mistake and fix, mixing Chinese and English. */
  description: string;
}

/** One entry in the ordered conversation history. */
export type ConversationEntry = TeacherUtterance | LearnerTurn | CorrectionEntry;

/** Which live audio source is currently dominant, used to drive the Persona visual. */
export type AudioActivity = 'none' | 'learner' | 'tutor';

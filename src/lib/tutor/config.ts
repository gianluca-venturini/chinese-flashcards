// Realtime tutor session configuration, sourced from the environment.
// See the "Chinese Voice Tutor" section of the README for the full list.

/**
 * OpenAI Realtime model used for the speech-to-speech tutor session.
 * Overridable so we can track new realtime model ids without a code change.
 */
export const REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL ?? 'gpt-realtime';

/**
 * Voice the tutor speaks with. Configurable via REALTIME_VOICE; falls back to
 * a sensible default when unset.
 */
export const REALTIME_VOICE = process.env.REALTIME_VOICE ?? 'marin';

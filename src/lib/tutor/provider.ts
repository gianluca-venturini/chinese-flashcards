import type { SensitivityLevel } from './types';
import type { DisplayUtteranceArgs, ShowCorrectionArgs } from './tools';

// Provider abstraction for the realtime tutor session. The concrete provider
// (OpenAI Realtime) is implemented in task 4.2; a future Gemini Live provider
// can slot behind the same interface without touching the UI/hook.
//
// Note: the actual minting of the ephemeral credential happens server-side in
// the `sessionEndpoint` route (it needs the long-lived API key). Everything on
// this interface is browser-safe.

/**
 * A semantic event derived from a raw provider data-channel message. The
 * session hook maps these onto conversation entries and the state machine, so
 * it never has to know provider-specific event names.
 */
export type RealtimeDomainEvent =
  | { kind: 'utterance'; args: DisplayUtteranceArgs }
  | { kind: 'correction'; args: ShowCorrectionArgs }
  | { kind: 'learnerTranscript'; text: string }
  | { kind: 'learnerSpeechStarted' }
  | { kind: 'learnerSpeechStopped' }
  | { kind: 'responseStarted' }
  | { kind: 'audioDelta' }
  | { kind: 'responseDone' }
  | { kind: 'tutorTranscript'; text: string };

export interface RealtimeProvider {
  /** App route the browser calls to obtain a short-lived session credential. */
  readonly sessionEndpoint: string;
  /** Name of the WebRTC data channel carrying session events. */
  readonly eventChannel: string;
  /** URL the browser POSTs its SDP offer to for the given model. */
  callsUrl(model: string): string;
  /** Build the `session.update` payload for the given correction sensitivity. */
  buildSessionUpdate(level: SensitivityLevel): Record<string, unknown>;
  /** Interpret a parsed data-channel event into a domain event, or null to ignore. */
  interpretEvent(event: Record<string, unknown>): RealtimeDomainEvent | null;
}

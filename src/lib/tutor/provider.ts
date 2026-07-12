import type { SensitivityLevel } from './types';
import type { DisplayUtteranceArgs, ShowCorrectionArgs } from './tools';
import { DisplayUtteranceSchema, ShowCorrectionSchema, REALTIME_TOOLS } from './tools';
import { buildSystemPrompt } from './prompt';

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

const OPENAI_CALLS_URL = 'https://api.openai.com/v1/realtime/calls';

function toolCallEvent(name: string, argsJson: string): RealtimeDomainEvent | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(argsJson);
  } catch {
    return null;
  }
  if (name === 'display_utterance') {
    const result = DisplayUtteranceSchema.safeParse(parsed);
    return result.success ? { kind: 'utterance', args: result.data } : null;
  }
  if (name === 'show_correction') {
    const result = ShowCorrectionSchema.safeParse(parsed);
    return result.success ? { kind: 'correction', args: result.data } : null;
  }
  return null;
}

/**
 * OpenAI Realtime provider (primary). Event names track the current GA schema;
 * where the schema has drifted across versions both spellings are handled so a
 * minor model bump doesn't silently break parsing.
 */
export const openAiRealtimeProvider: RealtimeProvider = {
  sessionEndpoint: '/api/tutor/session',
  eventChannel: 'oai-events',

  callsUrl(model: string) {
    return `${OPENAI_CALLS_URL}?model=${encodeURIComponent(model)}`;
  },

  buildSessionUpdate(level: SensitivityLevel) {
    return {
      type: 'session.update',
      session: {
        type: 'realtime',
        instructions: buildSystemPrompt(level),
        output_modalities: ['audio'],
        tools: REALTIME_TOOLS,
        tool_choice: 'auto',
        audio: {
          input: {
            turn_detection: { type: 'server_vad' },
            transcription: { model: 'gpt-4o-mini-transcribe' },
          },
        },
      },
    };
  },

  interpretEvent(event: Record<string, unknown>): RealtimeDomainEvent | null {
    const type = typeof event.type === 'string' ? event.type : '';
    switch (type) {
      case 'input_audio_buffer.speech_started':
        return { kind: 'learnerSpeechStarted' };
      case 'input_audio_buffer.speech_stopped':
        return { kind: 'learnerSpeechStopped' };
      case 'response.created':
        return { kind: 'responseStarted' };
      case 'response.output_audio.delta':
      case 'response.audio.delta':
        return { kind: 'audioDelta' };
      case 'response.done':
        return { kind: 'responseDone' };
      case 'conversation.item.input_audio_transcription.completed':
        return { kind: 'learnerTranscript', text: String(event.transcript ?? '') };
      case 'response.output_audio_transcript.done':
      case 'response.audio_transcript.done':
        return { kind: 'tutorTranscript', text: String(event.transcript ?? '') };
      case 'response.function_call_arguments.done':
        return toolCallEvent(String(event.name ?? ''), String(event.arguments ?? ''));
      default:
        return null;
    }
  },
};

/**
 * Resolve the active realtime provider. OpenAI Realtime is primary; a future
 * Gemini Live provider would be selected here (e.g. via env) behind the same
 * `RealtimeProvider` interface, with no changes to the hook or UI.
 */
export function getRealtimeProvider(): RealtimeProvider {
  return openAiRealtimeProvider;
}

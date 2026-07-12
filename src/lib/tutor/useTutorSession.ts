'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getRealtimeProvider } from './provider';
import {
  DEFAULT_SENSITIVITY,
  type ConversationEntry,
  type SensitivityLevel,
  type SessionState,
} from './types';

export interface TutorSession {
  state: SessionState;
  entries: ConversationEntry[];
  error: string | null;
  level: SensitivityLevel;
  muted: boolean;
  start: () => Promise<void>;
  stop: () => void;
  reconnect: () => Promise<void>;
  toggleMute: () => void;
}

const provider = getRealtimeProvider();

function errorMessage(err: unknown): string {
  if (err instanceof DOMException && err.name === 'NotAllowedError') {
    return 'Microphone access was blocked. Allow the microphone and try again.';
  }
  if (err instanceof Error) return err.message;
  return 'Something went wrong starting the session.';
}

export function useTutorSession(): TutorSession {
  const [state, setState] = useState<SessionState>('idle');
  const [entries, setEntries] = useState<ConversationEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [level] = useState<SensitivityLevel>(DEFAULT_SENSITIVITY);
  const [muted, setMuted] = useState(false);

  // Per-response bookkeeping for the "no display tool call" fallback.
  const sawUtteranceRef = useRef(false);
  const tutorTranscriptRef = useRef('');

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const levelRef = useRef<SensitivityLevel>(level);
  levelRef.current = level;

  const sendEvent = useCallback((event: Record<string, unknown>) => {
    const dc = dcRef.current;
    if (dc?.readyState === 'open') dc.send(JSON.stringify(event));
  }, []);

  const appendEntry = useCallback((entry: ConversationEntry) => {
    setEntries((prev) => [...prev, entry]);
  }, []);

  const handleMessage = useCallback(
    (raw: string) => {
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return;
      }
      const event = provider.interpretEvent(parsed);
      if (!event) return;

      switch (event.kind) {
        case 'utterance':
          sawUtteranceRef.current = true;
          appendEntry({ kind: 'utterance', id: crypto.randomUUID(), ...event.args });
          break;
        case 'correction':
          appendEntry({ kind: 'correction', id: crypto.randomUUID(), ...event.args });
          break;
        case 'learnerTranscript':
          if (event.text.trim()) {
            appendEntry({ kind: 'learner', id: crypto.randomUUID(), text: event.text });
          }
          break;
        case 'tutorTranscript':
          tutorTranscriptRef.current = event.text;
          break;
        case 'learnerSpeechStarted':
          setState('listening');
          break;
        case 'learnerSpeechStopped':
          setState('thinking');
          break;
        case 'responseStarted':
          sawUtteranceRef.current = false;
          tutorTranscriptRef.current = '';
          setState('thinking');
          break;
        case 'audioDelta':
          setState('speaking');
          break;
        case 'responseDone':
          // Fallback: if the tutor spoke but never called display_utterance,
          // show the audio transcript so the panel is never empty.
          if (!sawUtteranceRef.current && tutorTranscriptRef.current.trim()) {
            appendEntry({
              kind: 'utterance',
              id: crypto.randomUUID(),
              hanzi: tutorTranscriptRef.current,
              pinyin: '',
              english: '',
            });
          }
          setState('listening');
          break;
        default:
          break;
      }
    },
    [appendEntry]
  );

  const cleanup = useCallback(() => {
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    dcRef.current?.close();
    dcRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    if (audioElRef.current) {
      audioElRef.current.srcObject = null;
      audioElRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    cleanup();
    setState('idle');
    setError(null);
  }, [cleanup]);

  const start = useCallback(async () => {
    setError(null);
    setEntries([]);
    setMuted(false);
    setState('connecting');
    try {
      // 1. Get a short-lived credential from our server.
      const res = await fetch(provider.sessionEndpoint, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? 'Could not start a tutor session.');
      }
      const { token, model } = data as { token: string; model: string };

      // 2. Set up the peer connection and remote audio playback.
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      const audioEl = new Audio();
      audioEl.autoplay = true;
      audioElRef.current = audioEl;
      pc.ontrack = (event) => {
        audioEl.srcObject = event.streams[0];
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') {
          setError('The connection dropped.');
          setState('error');
        }
      };

      // Data channel carrying session events. On open, configure the session
      // (persona, tools, VAD) and move to listening.
      const dc = pc.createDataChannel(provider.eventChannel);
      dcRef.current = dc;
      dc.onopen = () => {
        sendEvent(provider.buildSessionUpdate(levelRef.current));
        setState('listening');
      };
      dc.onmessage = (event) => handleMessage(event.data);

      // 3. Capture the microphone (started by the user gesture that called start()).
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = mic;
      mic.getTracks().forEach((track) => pc.addTrack(track, mic));

      // 4. Exchange SDP with the Realtime API using the ephemeral token.
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpRes = await fetch(provider.callsUrl(model), {
        method: 'POST',
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/sdp',
        },
      });
      if (!sdpRes.ok) throw new Error('Could not connect to the tutor.');

      await pc.setRemoteDescription({
        type: 'answer',
        sdp: await sdpRes.text(),
      });
    } catch (err) {
      cleanup();
      setError(errorMessage(err));
      setState('error');
    }
  }, [cleanup, sendEvent, handleMessage]);

  const reconnect = useCallback(() => start(), [start]);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      micStreamRef.current?.getAudioTracks().forEach((track) => {
        track.enabled = !next;
      });
      return next;
    });
  }, []);

  // Release audio/connection on unmount.
  useEffect(() => cleanup, [cleanup]);

  return { state, entries, error, level, muted, start, stop, reconnect, toggleMute };
}

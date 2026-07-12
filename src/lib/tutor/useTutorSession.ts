'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getRealtimeProvider } from './provider';
import {
  DEFAULT_SENSITIVITY,
  type AudioActivity,
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
  /** Which live audio source is currently dominant (drives the Persona state). */
  activity: AudioActivity;
  /** Current dominant audio amplitude (0..1); read per-frame for reactive visuals. */
  getAmplitude: () => number;
  start: () => Promise<void>;
  stop: () => void;
  reconnect: () => Promise<void>;
  toggleMute: () => void;
  setLevel: (level: SensitivityLevel) => void;
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
  const [level, setLevelState] = useState<SensitivityLevel>(DEFAULT_SENSITIVITY);
  const [muted, setMuted] = useState(false);
  const [activity, setActivity] = useState<AudioActivity>('none');

  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const activityRef = useRef<AudioActivity>('none');
  const amplitudeRef = useRef(0);

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

  // Analyse both live streams so the UI can react to who is talking and how
  // loudly. Runs once per session (guarded on the AudioContext).
  const startAnalysers = useCallback((remoteStream: MediaStream) => {
    const mic = micStreamRef.current;
    if (!mic || audioCtxRef.current || typeof window.AudioContext === 'undefined') return;

    const ctx = new window.AudioContext();
    audioCtxRef.current = ctx;

    const makeAnalyser = (stream: MediaStream) => {
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(analyser);
      return analyser;
    };
    const learnerAnalyser = makeAnalyser(mic);
    const tutorAnalyser = makeAnalyser(remoteStream);
    const buffer = new Uint8Array(learnerAnalyser.frequencyBinCount);

    const rms = (analyser: AnalyserNode) => {
      analyser.getByteTimeDomainData(buffer);
      let sum = 0;
      for (let i = 0; i < buffer.length; i++) {
        const centered = (buffer[i] - 128) / 128;
        sum += centered * centered;
      }
      return Math.sqrt(sum / buffer.length);
    };

    const THRESHOLD = 0.04;
    const tick = () => {
      const learner = rms(learnerAnalyser);
      const tutor = rms(tutorAnalyser);
      let next: AudioActivity = 'none';
      let amplitude = 0;
      if (tutor > THRESHOLD && tutor >= learner) {
        next = 'tutor';
        amplitude = tutor;
      } else if (learner > THRESHOLD) {
        next = 'learner';
        amplitude = learner;
      }
      amplitudeRef.current = amplitude;
      if (activityRef.current !== next) {
        activityRef.current = next;
        setActivity(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();
  }, []);

  const cleanup = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    activityRef.current = 'none';
    amplitudeRef.current = 0;
    setActivity('none');
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
        startAnalysers(event.streams[0]);
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
  }, [cleanup, sendEvent, handleMessage, startAnalysers]);

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

  // Changing the level re-sends session.update with a regenerated prompt so it
  // takes effect on subsequent turns without reconnecting (no-op when idle).
  const setLevel = useCallback(
    (next: SensitivityLevel) => {
      setLevelState(next);
      levelRef.current = next;
      sendEvent(provider.buildSessionUpdate(next));
    },
    [sendEvent]
  );

  const getAmplitude = useCallback(() => amplitudeRef.current, []);

  // Release audio/connection on unmount.
  useEffect(() => cleanup, [cleanup]);

  return {
    state,
    entries,
    error,
    level,
    muted,
    activity,
    getAmplitude,
    start,
    stop,
    reconnect,
    toggleMute,
    setLevel,
  };
}

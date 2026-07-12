'use client';

import { useEffect } from 'react';
import { Mic, Play, RotateCcw, Square } from 'lucide-react';
import type { TutorSession } from '@/lib/tutor/useTutorSession';
import { Button } from '@/components/ui/button';
import { TutorPersona } from './TutorPersona';
import { SensitivityControl } from './SensitivityControl';

const STATE_LABEL: Record<string, string> = {
  idle: 'Ready when you are',
  connecting: 'Connecting…',
  listening: 'Your turn — listening',
  thinking: 'Thinking…',
  speaking: '李老师 is speaking',
};

export function TutorDock({ session }: { session: TutorSession }) {
  const {
    state,
    entries,
    error,
    talking,
    activity,
    getAmplitude,
    level,
    start,
    stop,
    reconnect,
    startTalking,
    stopTalking,
    setLevel,
  } = session;

  const active = state !== 'idle' && state !== 'error';
  const canTalk = active && state !== 'connecting';

  const lastUtterance = [...entries]
    .reverse()
    .find((entry) => entry.kind === 'utterance');
  const showUtterance = state === 'speaking' && lastUtterance;

  // Hold SPACE to talk while the session is active.
  useEffect(() => {
    if (!canTalk) return;
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        startTalking();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        stopTalking();
      }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [canTalk, startTalking, stopTalking]);

  return (
    <div className="bg-muted/30 border-t">
      <div className="mx-auto flex w-full max-w-2xl items-center gap-4 p-4">
        <TutorPersona
          state={state}
          activity={activity}
          getAmplitude={getAmplitude}
          className={state === 'error' ? 'opacity-40' : ''}
        />

        <div className="min-w-0 flex-1">
          {state === 'error' ? (
            <p className="text-destructive text-sm">{error ?? 'Something went wrong.'}</p>
          ) : showUtterance ? (
            <div className="min-w-0">
              <p className="text-2xl leading-tight font-medium">{lastUtterance.hanzi}</p>
              {lastUtterance.pinyin && (
                <p className="text-muted-foreground text-base">{lastUtterance.pinyin}</p>
              )}
              {lastUtterance.english && (
                <p className="text-muted-foreground/80 text-sm italic">{lastUtterance.english}</p>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">{STATE_LABEL[state]}</p>
          )}
        </div>

        <SensitivityControl level={level} onChange={setLevel} />

        {state === 'idle' && (
          <Button onClick={() => start()}>
            <Play className="size-4" /> Start
          </Button>
        )}

        {state === 'error' && (
          <Button onClick={() => reconnect()}>
            <RotateCcw className="size-4" /> Reconnect
          </Button>
        )}

        {active && (
          <>
            <Button
              variant={talking ? 'default' : 'outline'}
              disabled={!canTalk}
              aria-pressed={talking}
              onPointerDown={(e) => {
                e.preventDefault();
                e.currentTarget.setPointerCapture(e.pointerId);
                startTalking();
              }}
              onPointerUp={() => stopTalking()}
              onPointerCancel={() => stopTalking()}
            >
              <Mic className="size-4" />
              {talking ? 'Listening… release to send' : 'Hold to talk (Space)'}
            </Button>
            <Button variant="destructive" size="icon" aria-label="Stop session" onClick={() => stop()}>
              <Square className="size-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

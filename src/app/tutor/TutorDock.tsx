'use client';

import { Mic, MicOff, Play, RotateCcw, Square } from 'lucide-react';
import type { TutorSession } from '@/lib/tutor/useTutorSession';
import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import { TutorPersona } from './TutorPersona';
import { SensitivityControl } from './SensitivityControl';

const STATE_LABEL: Record<string, string> = {
  idle: 'Ready when you are',
  connecting: 'Connecting…',
  listening: 'Listening…',
  thinking: 'Thinking…',
  speaking: '李老师 is speaking',
};

export function TutorDock({ session }: { session: TutorSession }) {
  const {
    state,
    error,
    muted,
    activity,
    getAmplitude,
    level,
    start,
    stop,
    reconnect,
    toggleMute,
    setLevel,
  } = session;

  const active = state !== 'idle' && state !== 'error';

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
            <Toggle
              pressed={muted}
              onPressedChange={() => toggleMute()}
              aria-label={muted ? 'Unmute microphone' : 'Mute microphone'}
              variant="outline"
            >
              {muted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
            </Toggle>
            <Button variant="destructive" onClick={() => stop()}>
              <Square className="size-4" /> Stop
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

'use client';

import { useEffect, useRef } from 'react';
import { Persona, type PersonaState } from '@/components/ai-elements/persona';
import type { AudioActivity, SessionState } from '@/lib/tutor/types';

// Map our session state + live audio activity onto the Persona's state machine.
// Live audio wins so the visual reflects who is actually talking.
function toPersonaState(state: SessionState, activity: AudioActivity): PersonaState {
  if (activity === 'tutor') return 'speaking';
  if (activity === 'learner') return 'listening';
  switch (state) {
    case 'speaking':
      return 'speaking';
    case 'listening':
      return 'listening';
    case 'connecting':
    case 'thinking':
      return 'thinking';
    default:
      return 'idle';
  }
}

export function TutorPersona({
  state,
  activity,
  getAmplitude,
  className,
}: {
  state: SessionState;
  activity: AudioActivity;
  getAmplitude: () => number;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);

  // Pulse the visual with the live audio amplitude (skipped when the user
  // prefers reduced motion).
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const tick = () => {
      const amp = Math.min(getAmplitude(), 1);
      if (wrapRef.current) {
        wrapRef.current.style.transform = `scale(${1 + amp * 0.12})`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [getAmplitude]);

  return (
    <div
      ref={wrapRef}
      className={className}
      style={{ transition: 'transform 60ms linear' }}
    >
      <Persona state={toPersonaState(state, activity)} variant="obsidian" className="size-16" />
    </div>
  );
}

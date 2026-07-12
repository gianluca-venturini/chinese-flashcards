'use client';

import { Button } from '@/components/ui/button';
import type { SensitivityLevel } from '@/lib/tutor/types';

const LEVELS: SensitivityLevel[] = ['LOW', 'MEDIUM', 'HIGH'];

const label = (level: SensitivityLevel) => level[0] + level.slice(1).toLowerCase();

export function SensitivityControl({
  level,
  onChange,
}: {
  level: SensitivityLevel;
  onChange: (level: SensitivityLevel) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Correction sensitivity"
      className="bg-background inline-flex rounded-md border p-0.5"
    >
      {LEVELS.map((option) => (
        <Button
          key={option}
          type="button"
          size="sm"
          variant={option === level ? 'default' : 'ghost'}
          aria-pressed={option === level}
          onClick={() => onChange(option)}
          className="h-7 px-3 text-xs"
        >
          {label(option)}
        </Button>
      ))}
    </div>
  );
}

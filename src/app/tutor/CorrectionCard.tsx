import type { CorrectionEntry } from '@/lib/tutor/types';

export function CorrectionCard({ entry }: { entry: CorrectionEntry }) {
  return (
    <div className="rounded-md border-l-4 border-amber-400 bg-amber-50 p-4 dark:border-amber-500 dark:bg-amber-950/30">
      <p className="mb-2 text-xs font-bold tracking-wide text-amber-700 dark:text-amber-300">
        🔄 Try again · 发音纠正
      </p>
      <div className="mb-1 flex items-baseline gap-3">
        <span className="text-2xl font-semibold">{entry.targetHanzi}</span>
        <span className="font-medium text-amber-700 dark:text-amber-300">
          {entry.targetPinyin}
        </span>
      </div>
      <p className="text-foreground text-sm">{entry.description}</p>
    </div>
  );
}

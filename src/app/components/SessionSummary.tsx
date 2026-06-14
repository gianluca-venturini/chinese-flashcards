"use client";

import { type Word } from "@/lib/schema";

export type SessionResult = {
  word: Word;
  q: number;
  after: { n: number; ef: number; i: number };
};

type Props = {
  results: SessionResult[];
  onRestart: () => void;
};

export default function SessionSummary({ results, onRestart }: Props) {
  const numPassed = results.filter((r) => r.q >= 3).length;

  return (
    <div className="flex flex-1 w-full select-none flex-col items-center justify-center overflow-hidden bg-zinc-50 p-4 font-sans dark:bg-black">
      <div className="flex w-full max-w-md flex-col items-center gap-4">
        <div className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          {numPassed} / {results.length} passed on first try
        </div>
        <div className="w-full max-h-[60vh] overflow-y-auto rounded-md bg-white shadow dark:bg-zinc-900">
          {results.map((r) => (
            <div
              key={r.word.chinese}
              className="flex items-center gap-3 border-b border-zinc-100 px-4 py-2 last:border-b-0 dark:border-zinc-800"
            >
              <span className="w-8 text-2xl" aria-label={r.q >= 3 ? "passed" : "failed"}>
                {r.q >= 3 ? "✅" : "❌"}
              </span>
              <span className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                {r.word.chinese}
              </span>
              <span className="ml-auto font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                i: {r.word.i}→{r.after.i}, ef: {r.word.ef.toFixed(2)}→{r.after.ef.toFixed(2)}, n: {r.word.n}→{r.after.n}
              </span>
            </div>
          ))}
        </div>
        <button
          onClick={onRestart}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Start new session
        </button>
      </div>
    </div>
  );
}

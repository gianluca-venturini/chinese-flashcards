"use client";

import { useEffect, useState } from "react";
import { getAllWords } from "@/lib/storage";
import { isWordDue } from "@/lib/dueWords";

type Counts = {
  dueToday: number;
  total: number;
  deprecated: number;
};

export default function WordStats() {
  const [counts, setCounts] = useState<Counts | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const words = await getAllWords();
      if (cancelled) return;
      const now = new Date();
      setCounts({
        dueToday: words.filter((w) => isWordDue(w, now)).length,
        total: words.length,
        deprecated: words.filter((w) => w.deprecated).length,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="grid grid-cols-3 gap-3">
      <Tile label="Due today" value={counts?.dueToday} />
      <Tile label="Total" value={counts?.total} />
      <Tile label="Deprecated" value={counts?.deprecated} />
    </div>
  );
}

function Tile({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="rounded-md bg-zinc-50 p-3 text-center dark:bg-zinc-800">
      <div className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        {value ?? "—"}
      </div>
      <div className="text-xs text-zinc-500 dark:text-zinc-400">{label}</div>
    </div>
  );
}

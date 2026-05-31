"use client";

import { useState } from "react";
import { diffWords, toSyncStatus, syncBidirectional } from "@/lib/sync";
import { fetchAllWords } from "@/lib/apiClient";
import { getAllWords } from "@/lib/storage";

export default function SyncSection() {
  const [busy, setBusy] = useState<null | "check" | "sync">(null);
  const [message, setMessage] = useState<string | null>(null);

  const flash = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 5000);
  };

  const handleCheck = async () => {
    setBusy("check");
    setMessage(null);
    try {
      const [remote, local] = await Promise.all([fetchAllWords(), getAllWords()]);
      const status = toSyncStatus(diffWords(local, remote));
      if (status.staleLocal === 0 && status.staleRemote === 0) {
        flash("✅ In sync");
      } else {
        flash(`Local stale: ${status.staleLocal} · Remote stale: ${status.staleRemote}`);
      }
    } catch {
      flash("❌ Check failed");
    } finally {
      setBusy(null);
    }
  };

  const handleSync = async () => {
    setBusy("sync");
    setMessage(null);
    try {
      const { pulled, pushed } = await syncBidirectional();
      flash(`✅ Pulled ${pulled} · Pushed ${pushed}`);
      if (pulled > 0) {
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch {
      flash("❌ Sync failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {message && (
        <span className="text-xs text-zinc-600 dark:text-zinc-400">{message}</span>
      )}
      <button
        onClick={handleCheck}
        disabled={busy !== null}
        className={`text-blue-600 dark:text-blue-400 hover:underline text-sm ${busy !== null ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        {busy === "check" ? "Checking…" : "Check"}
      </button>
      <button
        onClick={handleSync}
        disabled={busy !== null}
        className={`text-blue-600 dark:text-blue-400 hover:underline text-sm ${busy !== null ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        {busy === "sync" ? "Syncing…" : "Sync"}
      </button>
    </div>
  );
}

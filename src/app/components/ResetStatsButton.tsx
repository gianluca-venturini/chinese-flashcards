"use client";

import { useState } from "react";
import { resetSr } from "@/lib/storage";
import { ensureWords } from "@/lib/sync";

export default function ResetStatsButton() {
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleReset = async () => {
    if (!confirm("Are you sure you want to reset all your stats? This cannot be undone.")) {
      return;
    }

    setResetting(true);
    setMessage(null);

    try {
      const modifiedWords = await resetSr();
      try {
        await ensureWords(modifiedWords);
      } catch {
        // Local reset is preserved; will sync on next session
      }
      setMessage('✅ Stats reset successfully!');
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error('Reset stats error:', error);
      setMessage('❌ Failed to reset stats');
    } finally {
      setResetting(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {message && (
        <span className="text-xs text-zinc-600 dark:text-zinc-400">
          {message}
        </span>
      )}
      <button
        onClick={handleReset}
        disabled={resetting}
        className={`text-blue-600 dark:text-blue-400 hover:underline text-sm ${
          resetting ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        {resetting ? 'Resetting...' : 'Reset Stats'}
      </button>
    </div>
  );
}


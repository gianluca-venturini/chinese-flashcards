"use client";

import { useState } from "react";

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
      const response = await fetch('/api/reset-stats', {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        setMessage('✅ Stats reset successfully!');
        // Optionally refresh the page
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        setMessage(`❌ Error: ${data.error || 'Failed to reset stats'}`);
      }
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


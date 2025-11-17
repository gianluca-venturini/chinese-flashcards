"use client";

import { useState } from "react";

export default function ClassifyButton() {
  const [classifying, setClassifying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleClassify = async () => {
    setClassifying(true);
    setMessage(null);

    try {
      const response = await fetch('/api/words/classify', {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        setMessage(`✅ Classified ${data.classified} words${data.errors > 0 ? ` (${data.errors} errors)` : ''}!`);
        // Optionally refresh the page to show updated words
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        setMessage(`❌ Error: ${data.error || 'Failed to classify words'}`);
      }
    } catch (error) {
      console.error('Classification error:', error);
      setMessage('❌ Failed to classify words');
    } finally {
      setClassifying(false);
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
        onClick={handleClassify}
        disabled={classifying}
        className={`text-blue-600 dark:text-blue-400 hover:underline text-sm ${
          classifying ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        {classifying ? 'Classifying...' : 'Classify Words'}
      </button>
    </div>
  );
}


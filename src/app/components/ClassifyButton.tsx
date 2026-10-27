"use client";

import { useState } from "react";
import { getAllWords, putWord } from "@/lib/storage";
import { generateFields, mapLimit } from "@/lib/apiClient";
import { ensureWords } from "@/lib/sync";

export default function ClassifyButton() {
  const [classifying, setClassifying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleClassify = async () => {
    setClassifying(true);
    setMessage(null);

    try {
      const allWords = await getAllWords();
      const unclassified = allWords.filter((w) => w.category === null);

      if (unclassified.length === 0) {
        setMessage('✅ All words are already classified!');
        return;
      }

      const updatedWords = await mapLimit(unclassified, 5, async (word) => {
        const { category } = await generateFields(word.chinese, ['category']);
        return putWord({ ...word, category: category ?? null });
      });

      try {
        await ensureWords(updatedWords);
      } catch {
        // Local classify is preserved; will sync on next session
      }

      setMessage(`✅ Classified ${updatedWords.length} words!`);
      setTimeout(() => {
        window.location.reload();
      }, 2000);
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


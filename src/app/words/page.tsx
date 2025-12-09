"use client";
import { useEffect, useState } from "react";
import { Word } from "@/lib/db";
import { CategoryId } from "@/lib/categories";
import { CATEGORY_COLORS, UNKNOWN_CATEGORY_COLOR } from "@/lib/colors";
import { getShortDefinition } from "@/lib/formatDefinition";

export default function WordsPage() {
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredWord, setHoveredWord] = useState<Word | null>(null);
  const [editingWord, setEditingWord] = useState<Word | null>(null);
  const [englishValue, setEnglishValue] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    async function fetchWords() {
      try {
        const response = await fetch('/api/words?all=true');
        const data = await response.json();

        if (data.success && data.words) {
          setWords(data.words);
        } else {
          setError('Failed to load words');
        }
      } catch (err) {
        console.error('Error fetching words:', err);
        setError('Failed to load words');
      } finally {
        setLoading(false);
      }
    }

    fetchWords();
  }, []);

  const handleWordClick = (word: Word) => {
    setEditingWord(word);
    setEnglishValue(word.english);
  };

  const handleDialogClose = () => {
    setEditingWord(null);
    setEnglishValue("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWord) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/words/update', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chinese: editingWord.chinese,
          english: englishValue,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Update the word in local state
        setWords((prevWords) =>
          prevWords.map((word) =>
            word.chinese === editingWord.chinese
              ? { ...word, english: englishValue }
              : word
          )
        );
        handleDialogClose();
      } else {
        alert(`Failed to update word: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Error updating word:', err);
      alert('Failed to update word');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-50 p-4 font-sans dark:bg-black">
        <div className="text-xl text-zinc-600 dark:text-zinc-400">Loading words...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-50 p-4 font-sans dark:bg-black">
        <div className="text-xl text-red-600 dark:text-red-400">{error}</div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen w-screen bg-zinc-50 p-4 font-sans dark:bg-black select-none"
      onTouchStart={(e) => {
        // Dismiss card if tapping outside
        if (hoveredWord && !(e.target as HTMLElement).closest('[data-word-card]')) {
          setHoveredWord(null);
        }
      }}
      onClick={(e) => {
        // Dismiss card if clicking outside
        if (hoveredWord && !(e.target as HTMLElement).closest('[data-word-card]')) {
          setHoveredWord(null);
        }
      }}
    >
      <div className="mx-auto max-w-7xl">
        <h1 className="mb-6 text-3xl font-bold text-zinc-900 dark:text-zinc-100">
          All Words ({words.length})
        </h1>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(1.5rem,1fr))] gap-1 relative">
          {words.map((word, index) => {
            const categoryColor =
              CATEGORY_COLORS[word.category as CategoryId] ?? UNKNOWN_CATEGORY_COLOR;
            const charCount = word.chinese.length;
            return (
              <div
                key={`${word.chinese}-${index}`}
                data-word-card
                className="flex items-center justify-center rounded p-0.5 shadow-sm transition-shadow hover:shadow-md cursor-pointer relative"
                style={{
                  backgroundColor: categoryColor,
                  gridColumn: charCount > 1 ? `span ${Math.min(charCount, 3)}` : 'span 1',
                  aspectRatio: charCount === 1 ? '1' : 'auto',
                  minHeight: '1.5rem'
                }}
                onMouseEnter={() => {
                  setHoveredWord(word);
                }}
                onMouseLeave={() => {
                  setHoveredWord(null);
                }}
                onClick={() => {
                  handleWordClick(word);
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  setHoveredWord(word);
                }}
              >
                <span className="text-[10px] font-semibold text-zinc-900 sm:text-xs whitespace-nowrap">
                  {word.chinese}
                </span>
              </div>
            );
          })}
        </div>
        {hoveredWord && (
          <div
            data-word-card
            className="fixed z-50 pointer-events-none"
            style={{
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div
              className="flex flex-col items-center justify-center rounded-2xl p-8 shadow-2xl min-w-[300px] max-w-[90vw]"
              style={{
                backgroundColor: CATEGORY_COLORS[hoveredWord.category as CategoryId] ?? UNKNOWN_CATEGORY_COLOR,
              }}
            >
              <h1 className="text-5xl font-bold text-zinc-900 mb-4">
                {hoveredWord.chinese}
              </h1>
              <p className="text-xl text-zinc-900 mb-2">
                {hoveredWord.pinyin}
              </p>
              <p className="text-lg text-zinc-900">
                {getShortDefinition(hoveredWord.english)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      {editingWord && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          onClick={handleDialogClose}
        >
          <div
            className="bg-white dark:bg-zinc-800 rounded-lg p-6 shadow-xl max-w-md w-full mx-4 select-text"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
              Edit Translation
            </h2>
            <div className="mb-4">
              <p className="text-lg font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                {editingWord.chinese}
              </p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                {editingWord.pinyin}
              </p>
            </div>
            <form onSubmit={handleSubmit}>
              <label className="block mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                English Translation
              </label>
              <textarea
                value={englishValue}
                onChange={(e) => setEnglishValue(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                rows={4}
                required
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={handleDialogClose}
                  className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-200 dark:bg-zinc-700 rounded-md hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


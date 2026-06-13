"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { debounce } from "lodash";
import { getShortDefinition } from "@/lib/formatDefinition";
import { CategoryId } from "@/lib/categories";
import { type Word } from "@/lib/schema";
import { CATEGORY_COLORS, UNKNOWN_CATEGORY_COLOR } from "@/lib/colors";
import { getAllWords } from "@/lib/storage";
import { syncFromServer } from "@/lib/sync";
import { submitReview as submitReviewLocal } from "@/lib/review";
import { getDueWords } from "@/lib/dueWords";

const ANIMATION_DURATION_MS = 200;
const MAX_WORDS_STACK = 3;
const DEFAULT_SESSION_SIZE = 10;

export default function Home() {
  /** List of words that should be reviewed in this session. */
  const [words, setWords] = useState<Word[]>([]);
  /** List of words that should be reviewed again in the end of this session. */
  const [repeatWords, setRepeatWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  /** Current index of the word being reviewed. */
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isRevealed, setIsRevealed] = useState<boolean>(false);
  const [swipeOffset, setSwipeOffset] = useState<number>(0);
  const [isSwiping, setIsSwiping] = useState<boolean>(false);
  const [startX, setStartX] = useState<number>(0);
  const [screenWidth, setScreenWidth] = useState<number>(800); // Default fallback value
  const [sessionSize, setSessionSize] = useState<number>(DEFAULT_SESSION_SIZE);
  const [showCustomDialog, setShowCustomDialog] = useState<boolean>(false);
  const [customSizeInput, setCustomSizeInput] = useState<string>(String(DEFAULT_SESSION_SIZE));

  const SWIPE_THRESHOLD_X = screenWidth / 6;
  const MAX_SWIPE_OFFSET_X = screenWidth / 2;

  const startSession = useCallback(async (size: number) => {
    setLoading(true);
    setError(null);
    setRepeatWords([]);
    setCurrentIndex(0);
    setIsRevealed(false);
    setSwipeOffset(0);
    setIsSwiping(false);
    try {
      await syncFromServer();
    } catch (err) {
      console.warn('Sync from server failed, using local data:', err);
    }
    try {
      const allWords = await getAllWords();
      setWords(getDueWords(allWords, new Date(), size));
    } catch (err) {
      console.error('Error loading words from storage:', err);
      setError('Failed to load words.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void startSession(DEFAULT_SESSION_SIZE);
  }, [startSession]);

  useEffect(() => {
    // Initialize screen width after mount to avoid hydration mismatch
    // This setState call is intentional to sync with browser API after hydration
    setScreenWidth(window.innerWidth);

    const handleResize = () => setScreenWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const nextWords = useMemo(() => [...words, ...repeatWords].slice(currentIndex, currentIndex + MAX_WORDS_STACK), [currentIndex, words, repeatWords]);

  const handleSwipeStart = useCallback((clientX: number) => {
    setStartX(clientX);
    setIsSwiping(true);
  }, []);

  const handleSwipeMove = useCallback((clientX: number) => {
    if (!isSwiping) return;
    const diff = clientX - startX;
    setSwipeOffset(diff);
  }, [isSwiping, startX]);

  const debouncedFlipRevealed = useMemo(
    () => debounce(() => {
      setIsRevealed(prev => !prev);
    }, 100),
    []
  );

  // Cleanup debounced function on unmount
  useEffect(() => {
    return () => {
      debouncedFlipRevealed.cancel();
    };
  }, [debouncedFlipRevealed]);

  const submitReview = useCallback((chinese: string, q: number) => {
    submitReviewLocal(chinese, q).catch((err) => {
      console.error('Review sync error:', err);
      // Suppress the toast when offline — the offline badge already signals the state.
      if (navigator.onLine) {
        setSyncError('Failed to sync review. Local state saved.');
        setTimeout(() => setSyncError(null), 5000);
      }
    });
  }, []);

  const handleSwipeEnd = useCallback(() => {
    if (!isSwiping) return;
    setIsSwiping(false);

    if (Math.abs(swipeOffset) < 5) {
      debouncedFlipRevealed();
    }

    if (Math.abs(swipeOffset) > SWIPE_THRESHOLD_X) {
      // Determine q value based on swipe direction
      // Left swipe (negative offset) = q = 0 (don't know)
      // Right swipe (positive offset) = q = 5 (know well)
      const q = swipeOffset > 0 ? 5 : 0;

      // Get current word
      const currentWord = [...words, ...repeatWords][currentIndex];

      // Call API endpoint to record swipe
      if (currentWord) {
        if (!repeatWords.includes(currentWord)) {
          // Repeat words are not submitted again because we only count the first review for each word.
          submitReview(currentWord.chinese, q);
        }
        if (q < 3) {
          // Low quality reviews are added to the repeat words list to make sure to review them again in the end of this session.
          setRepeatWords(prev => [...prev, currentWord]);
        }
      }

      // Animate card out
      setSwipeOffset(swipeOffset > 0 ? MAX_SWIPE_OFFSET_X : -MAX_SWIPE_OFFSET_X);
      setTimeout(() => {
        setCurrentIndex((prev) => prev + 1);
        setIsRevealed(false);
        setSwipeOffset(0);
      }, ANIMATION_DURATION_MS);
    } else {
      setSwipeOffset(0);
    }
  }, [isSwiping, swipeOffset, debouncedFlipRevealed, SWIPE_THRESHOLD_X, MAX_SWIPE_OFFSET_X, words, repeatWords, currentIndex, submitReview]);

  const handleMouseLeave = useCallback(() => {
    if (isSwiping) {
      setIsSwiping(false);
      setSwipeOffset(0);
    }
  }, [isSwiping]);

  const openCustomDialog = useCallback(() => {
    setCustomSizeInput(String(sessionSize));
    setShowCustomDialog(true);
  }, [sessionSize]);

  const closeCustomDialog = useCallback(() => {
    setShowCustomDialog(false);
  }, []);

  const parsedCustomSize = parseInt(customSizeInput, 10);
  const isCustomSizeValid = Number.isFinite(parsedCustomSize) && parsedCustomSize >= 1;

  const handleCustomSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(customSizeInput, 10);
    if (!Number.isFinite(parsed) || parsed < 1) return;
    setSessionSize(parsed);
    setShowCustomDialog(false);
    void startSession(parsed);
  }, [customSizeInput, startSession]);

  let content: React.ReactNode;
  if (loading) {
    content = (
      <div className="flex flex-1 w-full items-center justify-center p-4">
        <div className="text-xl text-zinc-600 dark:text-zinc-400">Loading flashcards...</div>
      </div>
    );
  } else if (error) {
    content = (
      <div className="flex flex-1 w-full items-center justify-center p-4">
        <div className="text-xl text-red-600 dark:text-red-400">{error}</div>
      </div>
    );
  } else if (nextWords.length === 0) {
    content = (
      <div className="flex flex-1 w-full items-center justify-center p-4">
        <div className="text-xl text-zinc-600 dark:text-zinc-400">All finished 🎉</div>
      </div>
    );
  } else {
    content = (
      <div className="flex flex-1 w-full items-center justify-center p-4">
        <div className="relative flex-1 h-full" style={{ maxWidth: '80%', maxHeight: '70%' }}>
          {nextWords.map((currentWord, index) => {
            const isTopCard = index === 0;
            const scale = 1 - (index * 0.05);
            const translateY = -(index * 10);

            return (
              <div
                key={currentIndex + index}
                onMouseDown={isTopCard ? (e) => handleSwipeStart(e.clientX) : undefined}
                onMouseMove={isTopCard ? (e) => handleSwipeMove(e.clientX) : undefined}
                onMouseUp={isTopCard ? handleSwipeEnd : undefined}
                onMouseLeave={isTopCard ? handleMouseLeave : undefined}
                onTouchStart={isTopCard ? (e) => handleSwipeStart(e.touches[0].clientX) : undefined}
                onTouchMove={isTopCard ? (e) => handleSwipeMove(e.touches[0].clientX) : undefined}
                onTouchEnd={isTopCard ? handleSwipeEnd : undefined}
                className="absolute left-0 top-0 flex w-full h-full cursor-pointer flex-col items-center justify-center rounded-3xl bg-white p-12 shadow-lg transition-all hover:shadow-xl sm:p-24 dark:bg-zinc-900"
                style={{
                  zIndex: MAX_WORDS_STACK - index,
                  transform: isTopCard
                    ? `translateX(${swipeOffset}px) rotate(${swipeOffset * 0.05}deg)`
                    : `translateY(${translateY}px) scale(${scale})`,
                  transition: isSwiping && isTopCard ? "none" : `transform ${ANIMATION_DURATION_MS}ms ease-out, opacity ${ANIMATION_DURATION_MS}ms ease-out`,
                  opacity: isTopCard && Math.abs(swipeOffset) < SWIPE_THRESHOLD_X
                    ? 1
                    : isTopCard
                      ? 1-(Math.abs(swipeOffset)- SWIPE_THRESHOLD_X)/(MAX_SWIPE_OFFSET_X-SWIPE_THRESHOLD_X)
                      : 1,
                  pointerEvents: isTopCard ? 'auto' : 'none',
                  backgroundColor: CATEGORY_COLORS[currentWord.category as CategoryId] ?? UNKNOWN_CATEGORY_COLOR,
                }}
              >
                <div className="relative flex flex-col items-center">
                  <h1 className="whitespace-nowrap text-[5rem] font-bold text-zinc-900 sm:text-[5rem]">
                    {currentWord.chinese}
                  </h1>
                  <p
                    className={`absolute top-full mt-4 whitespace-nowrap text-xl text-zinc-900 transition-opacity duration-75 sm:mt-6 sm:text-2xl ${
                      isTopCard ? (isRevealed ? "opacity-100" : "opacity-50") : "opacity-0"
                    }`}
                  >
                    {currentWord.pinyin}
                  </p>
                  <p
                    className={`absolute top-full mt-16 whitespace-nowrap text-lg text-zinc-900 transition-opacity duration-75 sm:mt-20 sm:text-xl ${
                      isTopCard && isRevealed ? "opacity-100" : "opacity-0"
                    }`}
                  >
                    {currentWord.english ? getShortDefinition(currentWord.english) : ''}
                  </p>
                  {currentWord.example_chinese && (
                    <p
                      className={`absolute top-full mt-28 w-[80vw] max-w-[600px] text-center text-lg text-zinc-800 transition-opacity duration-75 sm:mt-36 sm:text-xl ${
                        isTopCard ? "opacity-70" : "opacity-0"
                      }`}
                    >
                      <span className="block">{(() => {
                        const idx = currentWord.example_chinese.indexOf(currentWord.chinese);
                        if (idx === -1) return currentWord.example_chinese;
                        return <>{currentWord.example_chinese.slice(0, idx)}<strong>{currentWord.chinese}</strong>{currentWord.example_chinese.slice(idx + currentWord.chinese.length)}</>;
                      })()}</span>
                      <span className="block mt-1 text-base text-zinc-700 sm:text-lg">{(() => {
                        if (!currentWord.example_pinyin) return null;
                        const text = currentWord.example_pinyin;
                        const search = currentWord.pinyin;
                        const textNoSpaces = text.replace(/ /g, '').toLowerCase();
                        const searchNoSpaces = search.replace(/ /g, '').toLowerCase();
                        const idx = textNoSpaces.indexOf(searchNoSpaces);
                        if (idx === -1) return text;
                        // Map spaceless match indices back to original string positions
                        let spaceless = 0, startOrig = -1, endOrig = -1;
                        for (let i = 0; i <= text.length; i++) {
                          if (spaceless === idx && startOrig === -1) startOrig = i;
                          if (spaceless === idx + searchNoSpaces.length) { endOrig = i; break; }
                          if (i < text.length && text[i] !== ' ') spaceless++;
                        }
                        if (startOrig === -1 || endOrig === -1) return text;
                        return <>{text.slice(0, startOrig)}<strong>{text.slice(startOrig, endOrig)}</strong>{text.slice(endOrig)}</>;
                      })()}</span>
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-1 w-full select-none flex-col items-center justify-center overflow-hidden bg-zinc-50 font-sans dark:bg-black">
      {!loading && (
        <button
          onClick={openCustomDialog}
          className="absolute top-4 right-4 z-10 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-200 dark:bg-zinc-700 rounded-md hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors shadow"
        >
          Custom
        </button>
      )}
      {syncError && (
        <div className="w-full bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 text-sm text-center py-1 px-4">
          {syncError}
        </div>
      )}
      {content}
      {showCustomDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          onClick={closeCustomDialog}
        >
          <div
            className="bg-white dark:bg-zinc-800 rounded-lg p-6 shadow-xl max-w-md w-full mx-4 select-text"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
              Custom Session
            </h2>
            <form onSubmit={handleCustomSubmit}>
              <label className="block mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                How many words?
              </label>
              <input
                type="number"
                min={1}
                value={customSizeInput}
                onChange={(e) => setCustomSizeInput(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                required
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={closeCustomDialog}
                  className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-200 dark:bg-zinc-700 rounded-md hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!isCustomSizeValid}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Start
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

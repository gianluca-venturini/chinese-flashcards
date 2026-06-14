"use client";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { debounce } from "lodash";
import { getShortDefinition } from "@/lib/formatDefinition";
import { CategoryId } from "@/lib/categories";
import { type Word } from "@/lib/schema";
import { CATEGORY_COLORS, UNKNOWN_CATEGORY_COLOR } from "@/lib/colors";
import { getAllWords } from "@/lib/storage";
import { syncFromServer } from "@/lib/sync";
import { submitReview as submitReviewLocal } from "@/lib/review";
import { getDueWords } from "@/lib/dueWords";
import { CUSTOM_SIZE_PARAM } from "@/lib/sessionParams";

const ANIMATION_DURATION_MS = 200;
const KEYBOARD_ANIMATION_DURATION_MS = 120;
const MAX_WORDS_STACK = 3;
const DEFAULT_SESSION_SIZE = 10;

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  /** List of words that should be reviewed in this session. */
  const [words, setWords] = useState<Word[]>([]);
  /** List of words that should be reviewed again in the end of this session. */
  const [repeatWords, setRepeatWords] = useState<Word[]>([]);
  /** Number of first-attempt fails. Frozen once the first pass ends. */
  const [numFirstPassFails, setNumFirstPassFails] = useState<number>(0);
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
  const [animationDurationMs, setAnimationDurationMs] = useState<number>(ANIMATION_DURATION_MS);
  const isAnimatingRef = useRef<boolean>(false);

  const SWIPE_THRESHOLD_X = screenWidth / 6;
  const MAX_SWIPE_OFFSET_X = screenWidth / 2;

  const startSession = useCallback(async (size: number) => {
    setLoading(true);
    setError(null);
    setRepeatWords([]);
    setNumFirstPassFails(0);
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

  // Initial-mount flag so we only auto-start once when there's no customSize param.
  const initializedRef = useRef<boolean>(false);

  useEffect(() => {
    const customSizeParam = searchParams.get(CUSTOM_SIZE_PARAM);
    if (customSizeParam !== null) {
      const parsed = parseInt(customSizeParam, 10);
      const size = Number.isFinite(parsed) && parsed >= 1 ? parsed : DEFAULT_SESSION_SIZE;
      initializedRef.current = true;
      void startSession(size);
      // Clean the URL so a refresh doesn't replay the custom session.
      router.replace('/');
    } else if (!initializedRef.current) {
      initializedRef.current = true;
      void startSession(DEFAULT_SESSION_SIZE);
    }
  }, [searchParams, router, startSession]);

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

  const commitAnswer = useCallback((q: number, durationMs: number) => {
    if (isAnimatingRef.current) return;

    const currentWord = [...words, ...repeatWords][currentIndex];
    if (!currentWord) return;

    if (!repeatWords.includes(currentWord)) {
      // Repeat words are not submitted again because we only count the first review for each word.
      submitReview(currentWord.chinese, q);
    }
    if (q < 3) {
      // Low quality reviews are added to the repeat words list to make sure to review them again in the end of this session.
      setRepeatWords(prev => [...prev, currentWord]);
      if (currentIndex < words.length) {
        setNumFirstPassFails(prev => prev + 1);
      }
    }

    isAnimatingRef.current = true;
    setAnimationDurationMs(durationMs);
    setSwipeOffset(q >= 3 ? MAX_SWIPE_OFFSET_X : -MAX_SWIPE_OFFSET_X);
    setTimeout(() => {
      setCurrentIndex(prev => prev + 1);
      setIsRevealed(false);
      setSwipeOffset(0);
      setAnimationDurationMs(ANIMATION_DURATION_MS);
      isAnimatingRef.current = false;
    }, durationMs);
  }, [words, repeatWords, currentIndex, submitReview, MAX_SWIPE_OFFSET_X]);

  const handleSwipeEnd = useCallback(() => {
    if (!isSwiping) return;
    setIsSwiping(false);

    if (Math.abs(swipeOffset) < 5) {
      debouncedFlipRevealed();
    }

    if (Math.abs(swipeOffset) > SWIPE_THRESHOLD_X) {
      // Left swipe (negative offset) = q = 0 (don't know)
      // Right swipe (positive offset) = q = 5 (know well)
      const q = swipeOffset > 0 ? 5 : 0;
      commitAnswer(q, ANIMATION_DURATION_MS);
    } else {
      setSwipeOffset(0);
    }
  }, [isSwiping, swipeOffset, debouncedFlipRevealed, SWIPE_THRESHOLD_X, commitAnswer]);

  useEffect(() => {
    if (loading || error || nextWords.length === 0) return;

    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        commitAnswer(5, KEYBOARD_ANIMATION_DURATION_MS);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        commitAnswer(0, KEYBOARD_ANIMATION_DURATION_MS);
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        debouncedFlipRevealed();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [loading, error, nextWords.length, commitAnswer, debouncedFlipRevealed]);

  const handleMouseLeave = useCallback(() => {
    if (isSwiping) {
      setIsSwiping(false);
      setSwipeOffset(0);
    }
  }, [isSwiping]);

  if (loading) {
    return (
      <div className="flex flex-1 w-full select-none items-center justify-center overflow-hidden bg-zinc-50 p-4 font-sans dark:bg-black">
        <div className="text-xl text-zinc-600 dark:text-zinc-400">Loading flashcards...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 w-full select-none items-center justify-center overflow-hidden bg-zinc-50 p-4 font-sans dark:bg-black">
        <div className="text-xl text-red-600 dark:text-red-400">
          {error}
        </div>
      </div>
    );
  }

  if (nextWords.length === 0) {
    return (
      <div className="flex flex-1 w-full select-none items-center justify-center overflow-hidden bg-zinc-50 p-4 font-sans dark:bg-black">
        <div className="text-xl text-zinc-600 dark:text-zinc-400">All finished 🎉</div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-1 w-full select-none flex-col items-center justify-center overflow-hidden bg-zinc-50 font-sans dark:bg-black">
      {syncError && (
        <div className="w-full bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 text-sm text-center py-1 px-4">
          {syncError}
        </div>
      )}
      <div
        className="pointer-events-none absolute bottom-3 right-4 select-none font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400"
        aria-label="Session progress: completed / repeat / session"
      >
        {Math.min(currentIndex, words.length) - numFirstPassFails}
        /{repeatWords.length - Math.max(0, currentIndex - words.length)}
        /{words.length}
      </div>
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
                  transition: isSwiping && isTopCard ? "none" : `transform ${animationDurationMs}ms ease-out, opacity ${animationDurationMs}ms ease-out`,
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
                      {currentWord.example_english && (
                        <span
                          className={`block mt-1 text-base italic text-zinc-700 sm:text-lg transition-opacity duration-75 ${
                            isTopCard && isRevealed ? "opacity-100" : "opacity-0"
                          }`}
                        >
                          {currentWord.example_english}
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}

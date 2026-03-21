"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { debounce } from "lodash";
import { v7 as uuidv7 } from "uuid";
import { getShortDefinition } from "@/lib/formatDefinition";
import { CategoryId } from "@/lib/categories";
import { Word } from "@/lib/db";
import { CATEGORY_COLORS, UNKNOWN_CATEGORY_COLOR } from "@/lib/colors";

const ANIMATION_DURATION_MS = 200;
const MAX_WORDS_STACK = 3;

export default function Home() {
  /** List of words that should be reviewed in this session. */
  const [words, setWords] = useState<Word[]>([]);
  /** List of words that should be reviewed again in the end of this session. */
  const [repeatWords, setRepeatWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  /** Current index of the word being reviewed. */
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isRevealed, setIsRevealed] = useState<boolean>(false);
  const [swipeOffset, setSwipeOffset] = useState<number>(0);
  const [isSwiping, setIsSwiping] = useState<boolean>(false);
  const [startX, setStartX] = useState<number>(0);
  const [screenWidth, setScreenWidth] = useState<number>(800); // Default fallback value

  const SWIPE_THRESHOLD_X = screenWidth / 6;
  const MAX_SWIPE_OFFSET_X = screenWidth / 2;

  // Fetch words from API
  useEffect(() => {
    async function fetchWords() {
      try {
        const response = await fetch('/api/words');

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMessage = errorData.error || `Failed to load words (${response.status})`;
          setError(errorMessage);
          setLoading(false);
          return;
        }

        const data = await response.json();

        if (data.success && data.words) {
          setWords(data.words);
        } else {
          const errorMessage = data.error || 'Failed to load words';
          setError(errorMessage);
        }
      } catch (err) {
        console.error('Error fetching words:', err);
        setError('Failed to load words. Please check your connection and try again.');
      } finally {
        setLoading(false);
      }
    }

    fetchWords();
  }, []);

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
    const id = uuidv7();
    const timestamp = new Date().toISOString();

    fetch('/api/review', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id,
        chinese,
        q,
        timestamp,
      }),
    }).catch((error) => {
      // Silently handle errors - don't block UI if API call fails
      console.error('Error recording swipe:', error);
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
    <div className="flex flex-1 w-full select-none items-center justify-center overflow-hidden bg-zinc-50 p-4 font-sans dark:bg-black">
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
                  {getShortDefinition(currentWord.english)}
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

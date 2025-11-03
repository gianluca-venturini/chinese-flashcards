"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { debounce } from "lodash";

interface Word {
  chinese: string;
  pinyin: string;
  english: string;
}

const colors = [
  '#f1c40f',
  '#2ecc71',
  '#3498db',
  '#9b59b6',
  '#e74c3c',
  '#1abc9c',
]

const words: Word[] = [
  {
    chinese: "你好",
    pinyin: "nǐ hǎo",
    english: "Hello",
  },
  {
    chinese: "再见",
    pinyin: "zài jiàn",
    english: "Goodbye",
  },
  {
    chinese: "谢谢",
    pinyin: "xiè xiè",
    english: "Thank you",
  },
  {
    chinese: "对不起",
    pinyin: "duì bù qǐ",
    english: "Sorry",
  },
];

const ANIMATION_DURATION_MS = 200;
const MAX_WORDS_STACK = 3;

export default function Home() {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isRevealed, setIsRevealed] = useState<boolean>(false);
  const [swipeOffset, setSwipeOffset] = useState<number>(0);
  const [isSwiping, setIsSwiping] = useState<boolean>(false);
  const [startX, setStartX] = useState<number>(0);
  const [screenWidth, setScreenWidth] = useState<number>(800); // Default fallback value
  
  const SWIPE_THRESHOLD_X = screenWidth / 6;
  const MAX_SWIPE_OFFSET_X = screenWidth / 2;

  useEffect(() => {
    // Initialize screen width after mount to avoid hydration mismatch
    // This setState call is intentional to sync with browser API after hydration
    setScreenWidth(window.innerWidth); // eslint-disable-line
    
    const handleResize = () => setScreenWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const nextWords = useMemo(() => words.slice(currentIndex, currentIndex + MAX_WORDS_STACK), [currentIndex]);

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

  const handleSwipeEnd = useCallback(() => {
    if (!isSwiping) return;
    setIsSwiping(false);

    if (Math.abs(swipeOffset) < 5) {
      debouncedFlipRevealed();
    }

    if (Math.abs(swipeOffset) > SWIPE_THRESHOLD_X) {
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
  }, [isSwiping, swipeOffset, debouncedFlipRevealed, SWIPE_THRESHOLD_X, MAX_SWIPE_OFFSET_X]);

  const handleMouseLeave = useCallback(() => {
    if (isSwiping) {
      setIsSwiping(false);
      setSwipeOffset(0);
    }
  }, [isSwiping]);

  return (
    <div className="flex h-screen w-screen select-none items-center justify-center overflow-hidden bg-zinc-50 p-4 font-sans dark:bg-black">
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
                backgroundColor: colors[simpleHash(currentWord.chinese) % colors.length],
              }}
            >
              <div className="relative flex flex-col items-center">
                <h1 className="text-5xl font-bold text-zinc-900 sm:text-6xl">
                  {currentWord.chinese}
                </h1>
                <div
                  className={`absolute top-full mt-4 flex flex-col items-center gap-2 text-center transition-opacity duration-75 sm:mt-6 ${
                    isTopCard && isRevealed ? "opacity-100" : "opacity-0"
                  }`}
                >
                  <p className="text-xl text-zinc-900 sm:text-2xl">
                    {currentWord.pinyin}
                  </p>
                  <p className="text-lg text-zinc-900 sm:text-xl">
                    {currentWord.english}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function simpleHash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i); // hash * 33 + c
  }
  return hash >>> 0; // convert to unsigned 32-bit int
}

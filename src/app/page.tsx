"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { debounce } from "lodash";

interface Word {
  chinese: string;
  pinyin: string;
  english: string;
}

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

const SWIPE_THRESHOLD_X = 100;
const MAX_SWIPE_OFFSET_X = 500;
const ANIMATION_DURATION_MS = 500;

export default function Home() {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isRevealed, setIsRevealed] = useState<boolean>(false);
  const [swipeOffset, setSwipeOffset] = useState<number>(0);
  const [isSwiping, setIsSwiping] = useState<boolean>(false);
  const [startX, setStartX] = useState<number>(0);

  const currentWord = useMemo(() => words[currentIndex % words.length], [currentIndex]);

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

    if (swipeOffset === 0) {
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
  }, [isSwiping, swipeOffset, debouncedFlipRevealed]);

  return (
    <div className="flex h-screen w-screen select-none items-center justify-center overflow-hidden bg-zinc-50 p-4 font-sans dark:bg-black">
      <div
        key={currentIndex}
        onMouseDown={(e) => handleSwipeStart(e.clientX)}
        onMouseMove={(e) => handleSwipeMove(e.clientX)}
        onMouseUp={handleSwipeEnd}
        onTouchStart={(e) => handleSwipeStart(e.touches[0].clientX)}
        onTouchMove={(e) => handleSwipeMove(e.touches[0].clientX)}
        onTouchEnd={handleSwipeEnd}
        className="flex cursor-pointer flex-col items-center justify-center rounded-lg bg-white p-12 shadow-lg transition-all hover:shadow-xl sm:p-24 dark:bg-zinc-900"
        style={{
          transform: `translateX(${swipeOffset}px) rotate(${swipeOffset * 0.05}deg)`,
          transition: isSwiping ? "none" : `transform ${ANIMATION_DURATION_MS}ms ease-out, opacity ${ANIMATION_DURATION_MS}ms ease-out`,
          opacity: Math.abs(swipeOffset) < SWIPE_THRESHOLD_X ? 1 : 1-(Math.abs(swipeOffset)- SWIPE_THRESHOLD_X)/(MAX_SWIPE_OFFSET_X-SWIPE_THRESHOLD_X),
        }}
      >
        <h1 className="text-5xl font-bold text-zinc-900 sm:text-6xl dark:text-white">
          {currentWord.chinese}
        </h1>
        <div
          className={`mt-4 flex flex-col items-center gap-2 text-center transition-opacity duration-75 sm:mt-6 ${
            isRevealed ? "opacity-100" : "opacity-0"
          }`}
        >
          <p className="text-xl text-zinc-600 sm:text-2xl dark:text-zinc-400">
            {currentWord.pinyin}
          </p>
          <p className="text-lg text-zinc-500 sm:text-xl dark:text-zinc-500">
            {currentWord.english}
          </p>
        </div>
      </div>
      {swipeOffset}
    </div>
  );
}

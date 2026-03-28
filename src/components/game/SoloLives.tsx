'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const EASE = [0.22, 1, 0.36, 1] as const;
const TOTAL_LIVES = 3;

type SoloLivesProps = {
  livesRemaining: number;
};

export function SoloLives({ livesRemaining }: SoloLivesProps) {
  const prevLivesRef = useRef(livesRemaining);
  const [breakingIndex, setBreakingIndex] = useState<number | null>(null);

  useEffect(() => {
    if (livesRemaining < prevLivesRef.current) {
      // The heart that just broke is at index = livesRemaining (0-based)
      setBreakingIndex(livesRemaining);
      const timer = setTimeout(() => {
        setBreakingIndex(null);
      }, 700);
      prevLivesRef.current = livesRemaining;
      return () => clearTimeout(timer);
    }
    prevLivesRef.current = livesRemaining;
  }, [livesRemaining]);

  const isLastLife = livesRemaining === 1;

  return (
    <div className="pointer-events-none flex items-center gap-1.5">
      {Array.from({ length: TOTAL_LIVES }).map((_, i) => {
        const isFilled = i < livesRemaining;
        const isBreaking = i === breakingIndex;
        const isLast = isLastLife && isFilled;

        return (
          <motion.span
            key={i}
            className={`text-base sm:text-lg lg:text-xl 2xl:text-2xl ${
              isBreaking
                ? 'heart-break'
                : isLast
                  ? 'heart-last-pulse'
                  : ''
            }`}
            initial={false}
            animate={{
              scale: isFilled ? 1 : 0.8,
              opacity: isFilled ? 1 : 0.3,
            }}
            transition={{ duration: 0.3, ease: EASE }}
          >
            {isFilled || isBreaking ? (
              <span className="drop-shadow-[0_0_6px_rgba(239,68,68,0.5)]">
                ♥
              </span>
            ) : (
              <span className="text-zinc-600">♥</span>
            )}
          </motion.span>
        );
      })}
    </div>
  );
}

'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform, type MotionValue } from 'framer-motion';

function Word({ word, progress, range, accent }: {
  word: string; progress: MotionValue<number>; range: [number, number]; accent: boolean;
}) {
  const opacity = useTransform(progress, range, [0.13, 1]);
  const y = useTransform(progress, range, [6, 0]);
  return (
    <motion.span
      style={{ opacity, y, display: 'inline-block', marginRight: '0.26em', color: accent ? 'var(--color-ember)' : undefined }}
    >
      {word}
    </motion.span>
  );
}

/**
 * Prose that lights up word by word as it is scrolled through — the reader's
 * own scroll is the narrator's pace. Each line is a separate paragraph; the
 * last line is set in the accent, the way the story lands on its turn.
 */
export function ScrollWords({ lines, className }: { lines: readonly string[]; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.82', 'end 0.42'] });

  const total = lines.reduce((n, l) => n + l.split(' ').length, 0);
  let i = 0;

  return (
    <div ref={ref} className={className}>
      {lines.map((line, li) => {
        const accent = li === lines.length - 1;
        return (
          <p key={li} aria-label={line} style={{ margin: 0 }}>
            <span aria-hidden>
              {line.split(' ').map((w, wi) => {
                const start = i / total;
                i++;
                return (
                  <Word key={wi} word={w} progress={scrollYProgress} range={[start, Math.min(1, start + 3 / total)]} accent={accent} />
                );
              })}
            </span>
          </p>
        );
      })}
    </div>
  );
}

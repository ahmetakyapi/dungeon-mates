'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform, type MotionValue } from 'framer-motion';

function Line({ text, progress, range, accent }: {
  text: string; progress: MotionValue<number>; range: [number, number]; accent: boolean;
}) {
  const opacity = useTransform(progress, range, [0.28, 1]);
  return (
    <motion.p style={{ opacity, margin: 0, color: accent ? 'var(--color-ember)' : undefined }}>
      {text}
    </motion.p>
  );
}

/**
 * Prose that lights up line by line as it is scrolled through.
 *
 * It used to light word by word from 13% opacity: ~80 motion values on one
 * section, and most of the prologue sat unreadably dim at any moment. A line
 * is the unit the story is written in (one sentence each), dimmed text stays
 * legible at 28%, and the opacity is the only thing that changes.
 */
export function ScrollWords({ lines, className }: { lines: readonly string[]; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.8', 'end 0.5'] });
  const step = 1 / lines.length;

  return (
    <div ref={ref} className={className}>
      {lines.map((line, i) => (
        <Line
          key={i}
          text={line}
          progress={scrollYProgress}
          range={[i * step, Math.min(1, (i + 1.4) * step)]}
          accent={i === lines.length - 1}
        />
      ))}
    </div>
  );
}

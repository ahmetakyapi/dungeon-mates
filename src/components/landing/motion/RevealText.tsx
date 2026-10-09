'use client';

import { createElement, useRef, type CSSProperties } from 'react';
import { motion, useInView } from 'framer-motion';
import { EASE_OUT_EXPO } from '@/lib/motion';

type RevealTextProps = {
  text: string;
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span' | 'div';
  className?: string;
  style?: CSSProperties;
  /** Split into words (default) or individual letters. */
  by?: 'word' | 'char';
  delay?: number;
  stagger?: number;
  duration?: number;
  /**
   * Explicit trigger. Leave undefined to play when scrolled into view; pass a
   * boolean to hold the reveal until something else (the preloader) is done.
   */
  play?: boolean;
  /** Per-word style hook, e.g. to colour one word. */
  wordStyle?: (word: string, index: number) => CSSProperties | undefined;
};

/**
 * Masked text reveal: each word (or letter) rises out of its own clipped line
 * box. The real text is kept as an aria-label so screen readers get one
 * sentence rather than a pile of spans.
 */
export function RevealText({
  text, as = 'h2', className, style, by = 'word', delay = 0, stagger,
  duration = 1.05, play, wordStyle,
}: RevealTextProps) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -12% 0px' });
  const on = play ?? inView;
  const step = stagger ?? (by === 'char' ? 0.028 : 0.07);

  const words = text.split(' ');
  let n = 0;

  const children = words.map((w, wi) => {
    const units = by === 'char' ? Array.from(w) : [w];
    return (
      <span
        key={wi}
        aria-hidden
        style={{
          display: 'inline-block', overflow: 'hidden', verticalAlign: 'top',
          // Room for descenders and Turkish diacritics (Ş, Ğ) inside the mask.
          paddingBottom: '0.2em', marginBottom: '-0.2em',
          paddingTop: '0.16em', marginTop: '-0.16em',
          whiteSpace: 'nowrap',
          ...wordStyle?.(w, wi),
        }}
      >
        {units.map((u, ui) => {
          const i = n++;
          return (
            <motion.span
              key={ui}
              style={{ display: 'inline-block', willChange: 'transform' }}
              initial={{ y: '115%', rotate: by === 'char' ? 6 : 2 }}
              animate={on ? { y: '0%', rotate: 0 } : undefined}
              transition={{ duration, ease: EASE_OUT_EXPO, delay: delay + i * step }}
            >
              {u}
            </motion.span>
          );
        })}
        {wi < words.length - 1 ? ' ' : null}
      </span>
    );
  });

  return createElement(as, { ref, className, style, 'aria-label': text }, children);
}

'use client';

import { motion, useReducedMotion } from 'framer-motion';

/**
 * Odometer digits: when the value changes, each digit rolls in its own window
 * to the new one — no counting through the numbers in between, so a depth
 * gauge that changes as fast as the reader scrolls always settles.
 *
 * Ported from dev-starter's `snippets/ui/digit-roll.tsx` (motion/react →
 * framer-motion). Digits are keyed from the right, so 96 → 120 keeps the
 * ones digit as the same element. The first paint is still; the screen
 * reader reads the whole text once, the strips are hidden from it.
 */

const LINE = 1.1;
const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;
const SPRING = { type: 'spring', stiffness: 260, damping: 24, mass: 0.9 } as const;

export function DigitRoll({ value, className }: { value: string; className?: string }) {
  const reduce = useReducedMotion();
  const chars = [...value];

  return (
    <span className={className} style={{ display: 'inline-flex', whiteSpace: 'nowrap', lineHeight: LINE }}>
      <span className="sr-only">{value}</span>
      <span aria-hidden style={{ display: 'inline-flex' }}>
        {chars.map((char, index) => {
          const fromRight = chars.length - 1 - index;
          if (char < '0' || char > '9') {
            return <span key={`s${fromRight}${char}`} style={{ whiteSpace: 'pre' }}>{char}</span>;
          }
          return (
            <span key={`d${fromRight}`} style={{ position: 'relative', display: 'inline-block' }}>
              <span style={{ visibility: 'hidden' }}>{char}</span>
              <span style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
                <motion.span
                  style={{ position: 'absolute', left: 0, right: 0, top: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                  initial={false}
                  animate={{ y: `${-Number(char) * LINE}em` }}
                  transition={reduce ? { duration: 0 } : { ...SPRING, delay: Math.min(fromRight, 4) * 0.04 }}
                >
                  {DIGITS.map((d) => <span key={d} style={{ display: 'block', height: `${LINE}em` }}>{d}</span>)}
                </motion.span>
              </span>
            </span>
          );
        })}
      </span>
    </span>
  );
}

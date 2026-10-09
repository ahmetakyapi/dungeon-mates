'use client';

import { useRef, type ReactNode } from 'react';
import {
  motion, useAnimationFrame, useMotionValue, useScroll, useSpring, useTransform, useVelocity,
} from 'framer-motion';
import { prefersReducedMotion } from '@/lib/motion';

/**
 * A marquee that answers the scroll wheel: it drifts on its own, speeds up and
 * leans with the reader's scroll velocity, and reverses when they scroll back.
 * `children` is rendered twice; the strip wraps at -50%.
 */
export function VelocityMarquee({ children, baseSpeed = 2.2, className }: {
  children: ReactNode; baseSpeed?: number; className?: string;
}) {
  const base = useMotionValue(0);
  const { scrollY } = useScroll();
  const velocity = useVelocity(scrollY);
  const smooth = useSpring(velocity, { damping: 50, stiffness: 380 });
  const factor = useTransform(smooth, [-1600, 0, 1600], [-5, 0, 5], { clamp: false });
  const skew = useTransform(smooth, [-2400, 0, 2400], [7, 0, -7]);
  const dir = useRef(1);
  const reduced = useRef<boolean | null>(null);

  const x = useTransform(base, (v) => `${((v % 50) + 50) % 50 - 50}%`);

  useAnimationFrame((_, delta) => {
    if (reduced.current === null) reduced.current = prefersReducedMotion();
    if (reduced.current) return;
    const f = factor.get();
    if (f < 0) dir.current = -1; else if (f > 0) dir.current = 1;
    const move = dir.current * baseSpeed * (delta / 1000) * (1 + Math.abs(f));
    base.set(base.get() + move);
  });

  return (
    <div className={className} style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
      <motion.div style={{ x, skewX: skew, display: 'flex', width: 'max-content' }}>
        <div style={{ display: 'flex' }}>{children}</div>
        <div style={{ display: 'flex' }} aria-hidden>{children}</div>
      </motion.div>
    </div>
  );
}

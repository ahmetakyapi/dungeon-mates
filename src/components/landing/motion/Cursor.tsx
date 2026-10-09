'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, AnimatePresence } from 'framer-motion';

/**
 * A two-part cursor: an ember dot that tracks the pointer exactly, and a ring
 * that trails on a spring. Over anything interactive the ring opens up; over an
 * element with `data-cursor="…"` it opens wider and shows that word.
 *
 * Only on fine pointers. The native cursor is hidden on the page while this is
 * active, but kept over text inputs so typing still shows a caret.
 */
export function Cursor() {
  const [enabled, setEnabled] = useState(false);
  const [hover, setHover] = useState<null | { label: string | null }>(null);
  const [down, setDown] = useState(false);
  const [hidden, setHidden] = useState(true);
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const rx = useSpring(x, { stiffness: 260, damping: 26, mass: 0.5 });
  const ry = useSpring(y, { stiffness: 260, damping: 26, mass: 0.5 });
  const last = useRef<Element | null>(null);

  useEffect(() => {
    const fine = window.matchMedia('(pointer: fine)').matches;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!fine || reduced) return;
    setEnabled(true);
    document.documentElement.classList.add('dm-has-cursor');

    const onMove = (e: PointerEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
      setHidden(false);
      const t = e.target as Element | null;
      if (t === last.current) return;
      last.current = t;
      const hit = t?.closest?.('[data-cursor], a, button, [role="button"], label, input, select');
      if (!hit) { setHover(null); return; }
      setHover({ label: hit.getAttribute('data-cursor') });
    };
    const onDown = () => setDown(true);
    const onUp = () => setDown(false);
    const onLeave = () => setHidden(true);
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    document.documentElement.addEventListener('pointerleave', onLeave);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      document.documentElement.classList.remove('dm-has-cursor');
    };
  }, [x, y]);

  if (!enabled) return null;
  const label = hover?.label ?? null;
  const ringSize = label ? 86 : hover ? 54 : 34;

  return (
    <div aria-hidden className="dm-cursor" style={{ opacity: hidden ? 0 : 1 }}>
      <motion.div
        className="dm-cursor-ring"
        style={{ x: rx, y: ry }}
        animate={{ width: ringSize, height: ringSize, scale: down ? 0.82 : 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
        data-label={label ? 'on' : undefined}
      >
        <AnimatePresence>
          {label && (
            <motion.span
              key={label}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.2 }}
            >
              {label}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>
      <motion.div className="dm-cursor-dot" style={{ x, y }} animate={{ scale: hover ? 0 : 1 }} />
    </div>
  );
}

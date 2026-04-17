'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

type CinematicWipeProps = {
  /** Any value — when this changes, a wipe fires. */
  trigger: string | number;
  /** Optional tint for special phases (boss = red, victory = gold, defeat = red) */
  color?: string;
  /** Total duration in ms */
  durationMs?: number;
};

/**
 * Full-screen cinematic wipe — diagonal reveal + fade.
 * Fires whenever `trigger` changes. Use for phase transitions.
 */
export function CinematicWipe({
  trigger,
  color = '#000000',
  durationMs = 550,
}: CinematicWipeProps) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    // Skip first render
    const key = String(trigger);
    setActive(key);
    const t = window.setTimeout(() => setActive(null), durationMs);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  return (
    <AnimatePresence>
      {active !== null ? (
        <motion.div
          key={active}
          className="pointer-events-none fixed inset-0 z-[80]"
          initial={{ clipPath: 'polygon(-20% 0, -20% 0, -20% 100%, -20% 100%)', opacity: 0.95 }}
          animate={{
            clipPath: [
              'polygon(-20% 0, -20% 0, -20% 100%, -20% 100%)',
              'polygon(-20% 0, 120% 0, 120% 100%, -20% 100%)',
              'polygon(120% 0, 120% 0, 120% 100%, 120% 100%)',
            ],
            opacity: [0.95, 0.95, 0],
          }}
          exit={{ opacity: 0 }}
          transition={{ duration: durationMs / 1000, ease: [0.83, 0, 0.17, 1], times: [0, 0.6, 1] }}
          style={{ background: color }}
        />
      ) : null}
    </AnimatePresence>
  );
}

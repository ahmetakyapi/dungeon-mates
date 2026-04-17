'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useMemo } from 'react';

type ComboCounterProps = {
  count: number;
};

/** Premium combo counter — spring scale-in, gold glow at high combos */
export function ComboCounter({ count }: ComboCounterProps) {
  const show = count >= 2;
  const tier = useMemo(() => {
    if (count >= 10) return 3;
    if (count >= 6) return 2;
    if (count >= 4) return 1;
    return 0;
  }, [count]);

  const tierConfig = [
    { color: '#ffffff', glow: 'rgba(255,255,255,0.4)', label: '' },
    { color: '#fef3c7', glow: 'rgba(254,243,199,0.6)', label: 'KOMBO' },
    { color: '#fbbf24', glow: 'rgba(251,191,36,0.75)', label: 'SÜPER' },
    { color: '#ef4444', glow: 'rgba(239,68,68,0.85)', label: 'KATLİAM' },
  ] as const;
  const cfg = tierConfig[tier];

  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          key={`combo-${tier}`}
          initial={{ opacity: 0, scale: 0.4, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: -6 }}
          transition={{ type: 'spring', stiffness: 380, damping: 18 }}
          className="pointer-events-none absolute right-4 top-24 z-30 select-none text-right font-pixel sm:right-6 sm:top-28"
        >
          <motion.div
            key={count}
            initial={{ scale: 1.35 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 420, damping: 14 }}
            style={{
              color: cfg.color,
              textShadow: `0 0 10px ${cfg.glow}, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000`,
            }}
            className="text-3xl font-bold leading-none sm:text-4xl"
          >
            {count}×
          </motion.div>
          {cfg.label && (
            <div
              className="mt-1 text-[10px] font-semibold tracking-[0.25em] sm:text-xs"
              style={{ color: cfg.color, textShadow: `0 0 6px ${cfg.glow}` }}
            >
              {cfg.label}
            </div>
          )}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

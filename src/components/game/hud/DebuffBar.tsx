'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { PlayerState } from '../../../../shared/types';

type DebuffBarProps = {
  player: PlayerState;
};

type DebuffEntry = {
  key: string;
  icon: string;
  label: string;
  color: string;
  glow: string;
  ticks: number; // remaining ticks (20/sec)
  max: number;  // expected max (for progress bar)
};

/** Premium debuff indicator bar — shows poison/slow/stun/burn/freeze above HP */
export function DebuffBar({ player }: DebuffBarProps) {
  const entries: DebuffEntry[] = [];

  if (player.poisoned) {
    entries.push({ key: 'poison', icon: '☠', label: 'Zehir', color: '#c4b5fd', glow: 'rgba(196,181,253,0.4)', ticks: 60, max: 60 });
  }
  if (player.slowed) {
    entries.push({ key: 'slow', icon: '❄', label: 'Yavaş', color: '#bae6fd', glow: 'rgba(186,230,253,0.4)', ticks: 60, max: 60 });
  }
  if (player.stunTicks > 0) {
    entries.push({ key: 'stun', icon: '✦', label: 'Sersem', color: '#fcd34d', glow: 'rgba(252,211,77,0.45)', ticks: player.stunTicks, max: 60 });
  }
  const ps = player as PlayerState & { burnTicks?: number; freezeTicks?: number };
  if (ps.burnTicks && ps.burnTicks > 0) {
    entries.push({ key: 'burn', icon: '🔥', label: 'Yanma', color: '#fb923c', glow: 'rgba(251,146,60,0.4)', ticks: ps.burnTicks, max: 40 });
  }
  if (ps.freezeTicks && ps.freezeTicks > 0) {
    entries.push({ key: 'freeze', icon: '❄', label: 'Donmuş', color: '#7dd3fc', glow: 'rgba(125,211,252,0.45)', ticks: ps.freezeTicks, max: 30 });
  }

  return (
    <div className="pointer-events-none flex gap-1.5">
      <AnimatePresence>
        {entries.map((e) => {
          const pct = Math.max(0, Math.min(1, e.ticks / e.max));
          const urgent = e.ticks <= 20; // <1s
          return (
            <motion.div
              key={e.key}
              initial={{ scale: 0.5, opacity: 0, y: -6 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.6, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 22 }}
              className={`relative flex h-9 w-9 items-center justify-center rounded-md border font-pixel text-[10px] sm:h-10 sm:w-10 sm:text-xs ${urgent ? 'animate-pulse' : ''}`}
              style={{
                borderColor: `${e.color}99`,
                background: `linear-gradient(135deg, ${e.color}18, ${e.color}05)`,
                boxShadow: `0 0 6px ${e.glow}`,
                color: e.color,
                textShadow: `0 0 3px ${e.glow}`,
              }}
              title={e.label}
            >
              <span className="text-lg leading-none sm:text-xl">{e.icon}</span>
              {/* Countdown ring (SVG) */}
              <svg className="pointer-events-none absolute inset-0" viewBox="0 0 36 36">
                <circle
                  cx="18"
                  cy="18"
                  r="16"
                  fill="none"
                  stroke={e.color}
                  strokeWidth="1.5"
                  strokeDasharray={`${pct * 100} 100`}
                  strokeDashoffset="25"
                  opacity="0.5"
                  pathLength="100"
                  transform="rotate(-90 18 18)"
                />
              </svg>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

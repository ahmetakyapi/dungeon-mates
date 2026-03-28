'use client';

import { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CLASS_STATS } from '../../../shared/types';
import type { PlayerState } from '../../../shared/types';

const EASE = [0.22, 1, 0.36, 1] as const;

type PlayerHoverCardProps = {
  player: PlayerState;
  isVisible: boolean;
  anchorRect?: DOMRect | null;
};

function StatBar({
  label,
  current,
  max,
  color,
  gradient,
}: {
  label: string;
  current: number;
  max: number;
  color: string;
  gradient?: string;
}) {
  const pct = Math.max(0, Math.min(100, (current / max) * 100));

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between">
        <span className="font-pixel text-[6px] text-zinc-400 lg:text-[8px] xl:text-[9px] 2xl:text-[10px]">{label}</span>
        <span className="font-pixel text-[6px] text-zinc-300 lg:text-[8px] xl:text-[9px] 2xl:text-[10px]">
          {Math.ceil(current)}/{max}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full border border-zinc-700/50 bg-zinc-900">
        <motion.div
          className="h-full rounded-full"
          style={{ background: gradient ?? color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: EASE }}
        />
      </div>
    </div>
  );
}

export function PlayerHoverCard({ player, isVisible, anchorRect }: PlayerHoverCardProps) {
  const classInfo = CLASS_STATS[player.class];
  const cardRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState<{ top?: string; bottom?: string; left?: string; right?: string }>({});

  // Dynamic positioning to stay on screen
  useEffect(() => {
    if (!isVisible || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const pos: typeof adjustedPosition = {};

    if (rect.top < 10) {
      pos.top = '100%';
      pos.bottom = undefined;
    }
    if (rect.right > window.innerWidth - 10) {
      pos.left = undefined;
      pos.right = '0';
    }
    if (rect.left < 10) {
      pos.left = '0';
    }

    setAdjustedPosition(pos);
  }, [isVisible]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          ref={cardRef}
          className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-48 -translate-x-1/2 rounded-lg border border-white/[0.08] bg-dm-bg/95 p-3 shadow-xl backdrop-blur-lg lg:w-56 lg:p-4 2xl:w-64 2xl:p-5"
          style={{
            boxShadow:
              '0 8px 32px rgba(2,6,23,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
            ...adjustedPosition,
          }}
          initial={{ scale: 0.85, opacity: 0, y: 8 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.85, opacity: 0, y: 8 }}
          transition={{ duration: 0.2, ease: EASE }}
        >
          {/* Header */}
          <div className="mb-2 flex items-center gap-2">
            <span className="text-sm">{classInfo.emoji}</span>
            <div className="flex flex-col">
              <span className="font-pixel text-[8px] text-white lg:text-[10px] xl:text-[11px] 2xl:text-[13px]">{player.name}</span>
              <span className="font-pixel text-[6px] lg:text-[8px] xl:text-[9px] 2xl:text-[10px]" style={{ color: classInfo.color }}>
                {classInfo.label} Lv.{player.level}
              </span>
            </div>
          </div>

          {/* Bars */}
          <div className="flex flex-col gap-1.5">
            <StatBar
              label="HP"
              current={player.hp}
              max={player.maxHp}
              color="#ef4444"
              gradient="linear-gradient(90deg, #dc2626, #ef4444)"
            />
            <StatBar
              label="MP"
              current={player.mana}
              max={player.maxMana}
              color="#3b82f6"
              gradient="linear-gradient(90deg, #2563eb, #3b82f6)"
            />
          </div>

          {/* Stats row */}
          <div className="mt-2 flex justify-between border-t border-dm-border/40 pt-2">
            <span className="font-pixel text-[6px] text-zinc-400 lg:text-[8px] xl:text-[9px] 2xl:text-[10px]">⚔ {player.attack}</span>
            <span className="font-pixel text-[6px] text-zinc-400 lg:text-[8px] xl:text-[9px] 2xl:text-[10px]">🛡 {player.defense}</span>
            <span className="font-pixel text-[6px] text-dm-gold lg:text-[8px] xl:text-[9px] 2xl:text-[10px]">⭐ {player.xp} XP</span>
          </div>

          {/* Active boosts (if score indicates activity) */}
          {player.score > 0 && (
            <div className="mt-1.5 flex items-center gap-1 border-t border-dm-border/40 pt-1.5">
              <span className="font-pixel text-[5px] text-zinc-500 lg:text-[7px] xl:text-[8px] 2xl:text-[9px]">Skor:</span>
              <span className="font-pixel text-[6px] text-dm-gold lg:text-[8px] xl:text-[9px] 2xl:text-[10px]">{player.score * 10} 🪙</span>
            </div>
          )}

          {/* Dead indicator */}
          {!player.alive && (
            <div className="mt-2 rounded bg-dm-health/20 px-2 py-1 text-center font-pixel text-[7px] text-dm-health lg:text-[9px] xl:text-[10px] 2xl:text-[12px]">
              💀 Düşmüş
            </div>
          )}

          {/* Arrow */}
          <div className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-b border-r border-white/[0.08] bg-dm-bg/95" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

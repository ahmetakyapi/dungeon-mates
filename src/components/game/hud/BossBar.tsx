'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GameState } from '../../../../shared/types';
import { PixelFrame } from './PlayerBars';

const EASE = [0.22, 1, 0.36, 1] as const;

export const BOSS_DISPLAY_NAMES: Record<string, { name: string; emoji: string }> = {
  boss_demon: { name: 'Yozlasmis Kral Karanmir', emoji: '\u{1F451}' },
  boss_spider_queen: { name: 'Selvira \u2014 Dokumaci', emoji: '\uD83D\uDD78\uFE0F' },
  boss_forge_guardian: { name: 'Demirci Koruyucu', emoji: '\uD83D\uDD28' },
  boss_stone_warden: { name: 'Tas Muhafiz', emoji: '\uD83D\uDDFF' },
  boss_flame_knight: { name: 'Alev Sovalyesi', emoji: '\uD83D\uDD25' },
} as const;

export function BossHPBar({ gameState, bossDialogue }: { gameState: GameState; bossDialogue?: { bossType: string; dialogue: string; phase: number } | null }) {
  const boss = useMemo(() => {
    const entries = Object.values(gameState.monsters);
    return entries.find((m) => m.type.startsWith('boss_') && m.alive) ?? null;
  }, [gameState.monsters]);

  const prevHpRef = useRef<number | null>(null);
  const [delayedPct, setDelayedPct] = useState(100);

  const percentage = boss
    ? Math.max(0, Math.min((boss.hp / boss.maxHp) * 100, 100))
    : 0;

  // Dark Souls-style delayed damage bar
  useEffect(() => {
    if (!boss) return;
    if (prevHpRef.current !== null && boss.hp < prevHpRef.current) {
      // Delay the background bar
      const timer = setTimeout(() => {
        setDelayedPct(percentage);
      }, 600);
      prevHpRef.current = boss.hp;
      return () => clearTimeout(timer);
    }
    prevHpRef.current = boss.hp;
    setDelayedPct(percentage);
  }, [boss, percentage]);

  if (!boss) return null;

  return (
    <motion.div
      className="pointer-events-none absolute left-1/2 top-2 z-30 w-[80%] max-w-lg -translate-x-1/2 sm:top-4 sm:w-[60%]"
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: EASE }}
    >
      <PixelFrame className="p-2 sm:p-3">
        {/* Boss name with icons */}
        <div className="mb-1.5 flex items-center justify-center gap-2">
          <span className="text-xs sm:text-sm">{BOSS_DISPLAY_NAMES[boss.type]?.emoji ?? '\u{1F480}'}</span>
          <span className="boss-pulse font-pixel text-[9px] text-dm-health sm:text-[11px] lg:text-[12px] xl:text-[13px] 2xl:text-[15px]">
            {BOSS_DISPLAY_NAMES[boss.type]?.name ?? 'Boss'}
          </span>
          <span className="text-xs sm:text-sm">{BOSS_DISPLAY_NAMES[boss.type]?.emoji ?? '\u{1F480}'}</span>
        </div>

        {/* Boss dialogue subtitle */}
        <AnimatePresence>
          {bossDialogue && (
            <motion.p
              key={bossDialogue.dialogue}
              className="mb-1 text-center font-pixel text-[7px] italic text-red-300/80 sm:text-[8px] lg:text-[9px] xl:text-[10px] 2xl:text-[12px]"
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              transition={{ duration: 0.3, ease: EASE }}
            >
              &ldquo;{bossDialogue.dialogue}&rdquo;
            </motion.p>
          )}
        </AnimatePresence>

        {/* HP Bar */}
        <div className="relative h-5 overflow-hidden rounded-sm border border-red-900/60 bg-zinc-900 sm:h-6 lg:h-7 2xl:h-8">
          {/* Delayed damage bar (yellow/orange) */}
          <motion.div
            className="absolute inset-y-0 left-0 rounded-sm bg-amber-600/60"
            animate={{ width: `${delayedPct}%` }}
            transition={{ duration: 0.8, ease: EASE }}
          />
          {/* Actual HP bar */}
          <motion.div
            className="absolute inset-y-0 left-0 rounded-sm"
            style={{
              background: 'linear-gradient(90deg, #7f1d1d, #dc2626, #ef4444)',
            }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.3 }}
          />
          {/* Shine */}
          <div className="absolute inset-0 rounded-sm bg-gradient-to-b from-white/8 to-transparent" style={{ height: '40%' }} />
          {/* Low HP danger flash */}
          {percentage < 30 && (
            <motion.div
              className="absolute inset-0 rounded-sm bg-red-500/20"
              animate={{ opacity: [0, 0.5, 0] }}
              transition={{ duration: 0.8, repeat: Infinity }}
            />
          )}
          {/* HP text */}
          <div className="absolute inset-0 flex items-center justify-center gap-2">
            <span className="font-pixel text-[7px] text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] sm:text-[8px] lg:text-[9px] xl:text-[10px] 2xl:text-[12px]">
              {Math.ceil(boss.hp)}/{boss.maxHp}
            </span>
            <span className="font-pixel text-[6px] text-red-300/60 sm:text-[7px] lg:text-[8px] xl:text-[9px] 2xl:text-[11px]">
              ({Math.round(percentage)}%)
            </span>
          </div>
        </div>
      </PixelFrame>
    </motion.div>
  );
}

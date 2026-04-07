'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const EASE = [0.22, 1, 0.36, 1] as const;

export function PixelFrame({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`pointer-events-auto rounded-lg border border-white/[0.06] bg-dm-bg/80 backdrop-blur-md ${className}`}
      style={{
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.03), 0 4px 24px rgba(2,6,23,0.4)',
      }}
    >
      {children}
    </div>
  );
}

export function HPBar({
  value,
  max,
  showNumbers,
  isFlashing,
}: {
  value: number;
  max: number;
  showNumbers?: boolean;
  isFlashing?: boolean;
}) {
  const percentage = Math.max(0, Math.min((value / max) * 100, 100));
  const isLow = percentage < 25;
  const isCritical = percentage < 10 && percentage > 0;

  // Delayed damage ghost bar (Dark Souls style)
  const prevPercentRef = useRef(percentage);
  const [ghostPercent, setGhostPercent] = useState(percentage);

  useEffect(() => {
    if (percentage < prevPercentRef.current) {
      // Took damage: show ghost bar at previous level, then shrink after delay
      setGhostPercent(prevPercentRef.current);
      const timer = setTimeout(() => setGhostPercent(percentage), 600);
      prevPercentRef.current = percentage;
      return () => clearTimeout(timer);
    }
    prevPercentRef.current = percentage;
    setGhostPercent(percentage);
  }, [percentage]);

  // Gradient: green -> yellow -> orange -> red based on percentage
  const gradientColor = useMemo(() => {
    if (percentage > 60) return 'linear-gradient(90deg, #22c55e, #4ade80)';
    if (percentage > 30) return 'linear-gradient(90deg, #eab308, #facc15)';
    if (percentage > 10) return 'linear-gradient(90deg, #dc2626, #ef4444)';
    return 'linear-gradient(90deg, #991b1b, #dc2626)';
  }, [percentage]);

  return (
    <div className={`relative ${isLow ? 'low-hp-pulse' : ''}`}>
      <div
        className={`relative h-4 overflow-hidden rounded-sm border border-zinc-700/80 bg-zinc-900 sm:h-4 lg:h-4 2xl:h-5 ${
          isFlashing ? 'hp-flash' : ''
        } ${isCritical ? 'animate-pulse' : ''}`}
      >
        {/* Ghost bar (delayed damage feedback) */}
        {ghostPercent > percentage && (
          <motion.div
            className="absolute inset-y-0 left-0 rounded-sm bg-red-400/40"
            animate={{ width: `${ghostPercent}%` }}
            transition={{ duration: 0.8, ease: EASE }}
          />
        )}
        <motion.div
          className="absolute inset-y-0 left-0 rounded-sm"
          style={{ background: gradientColor }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.3, ease: EASE }}
        />
        {/* Shine overlay */}
        <div className="absolute inset-0 rounded-sm bg-gradient-to-b from-white/10 to-transparent" style={{ height: '50%' }} />
        {/* Segment markers for easier HP reading */}
        {max > 50 && (
          <div className="absolute inset-0">
            {[25, 50, 75].map(seg => (
              <div key={seg} className="absolute inset-y-0 w-px bg-black/20" style={{ left: `${seg}%` }} />
            ))}
          </div>
        )}
        {showNumbers && (
          <span className="absolute inset-0 flex items-center justify-center font-pixel text-[7px] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] sm:text-[7px] lg:text-[8px] xl:text-[9px] 2xl:text-[11px]">
            {Math.ceil(value)}/{max} HP
          </span>
        )}
      </div>
    </div>
  );
}

export function ManaBar({
  value,
  max,
  showNumbers,
  abilityReady,
}: {
  value: number;
  max: number;
  showNumbers?: boolean;
  abilityReady?: boolean;
}) {
  const percentage = Math.max(0, Math.min((value / max) * 100, 100));

  return (
    <div className="relative h-3.5 overflow-hidden rounded-sm border border-zinc-700/80 bg-zinc-900 sm:h-3.5 lg:h-4 2xl:h-5">
      <motion.div
        className="absolute inset-y-0 left-0 rounded-sm"
        style={{ background: 'linear-gradient(90deg, #2563eb, #3b82f6, #60a5fa)' }}
        animate={{ width: `${percentage}%` }}
        transition={{ duration: 0.3, ease: EASE }}
      />
      <div className="absolute inset-0 rounded-sm bg-gradient-to-b from-white/10 to-transparent" style={{ height: '50%' }} />
      {/* Pulse overlay when ability is ready */}
      {abilityReady && (
        <motion.div
          className="absolute inset-0 rounded-sm bg-blue-400/20"
          animate={{ opacity: [0, 0.4, 0] }}
          transition={{ duration: 1.2, repeat: Infinity }}
        />
      )}
      {showNumbers && (
        <span className="absolute inset-0 flex items-center justify-center font-pixel text-[6px] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] sm:text-[6px] lg:text-[7px] xl:text-[8px] 2xl:text-[10px]">
          {Math.ceil(value)}/{max} MP
        </span>
      )}
    </div>
  );
}

export function XPBar({
  xp,
  xpToNext,
  xpProgress,
  level,
}: {
  xp: number;
  xpToNext: number;
  xpProgress: number;
  level: number;
}) {
  const currentXP = xpProgress;
  const percentage = Math.max(0, Math.min((currentXP / xpToNext) * 100, 100));
  const prevXpRef = useRef(xp);
  const [xpGain, setXpGain] = useState<{ amount: number; id: number } | null>(null);

  useEffect(() => {
    if (xp > prevXpRef.current) {
      const gained = xp - prevXpRef.current;
      setXpGain({ amount: gained, id: Date.now() });
      const timer = setTimeout(() => setXpGain(null), 1200);
      prevXpRef.current = xp;
      return () => clearTimeout(timer);
    }
    prevXpRef.current = xp;
  }, [xp]);

  return (
    <div className="relative">
      <div className="relative h-2 overflow-hidden rounded-sm border border-zinc-700/60 bg-zinc-900 sm:h-2.5 lg:h-3 2xl:h-3.5">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-sm"
          style={{ background: 'linear-gradient(90deg, #d97706, #f59e0b, #fbbf24)' }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.3, ease: EASE }}
        />
      </div>
      <p className="mt-0.5 font-pixel text-[5px] text-dm-gold/70 sm:text-[6px] lg:text-[7px] xl:text-[8px] 2xl:text-[10px]">
        Seviye {level} — {currentXP}/{xpToNext} XP
      </p>
      {/* Floating +XP text */}
      <AnimatePresence>
        {xpGain && (
          <motion.span
            key={xpGain.id}
            className="absolute -right-1 -top-1 font-pixel text-[8px] text-dm-gold sm:text-[9px] lg:text-[10px] 2xl:text-[12px]"
            initial={{ opacity: 1, y: 0 }}
            animate={{ opacity: 0, y: -16 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1, ease: EASE }}
          >
            +{xpGain.amount} XP
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

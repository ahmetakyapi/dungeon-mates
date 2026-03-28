'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';

const EASE = [0.22, 1, 0.36, 1] as const;

type DamageNumberType = 'damage' | 'critical' | 'heal' | 'xp' | 'gold';

type DamageNumberProps = {
  x: number;
  y: number;
  value: number;
  type: DamageNumberType;
  index?: number; // For staggering multiple simultaneous numbers
  onComplete: () => void;
};

const TYPE_CONFIG: Record<
  DamageNumberType,
  {
    color: string;
    prefix: string;
    suffix: string;
    fontSize: string;
    mobileFontSize: string;
    glow: string;
    duration: number;
    yTravel: number;
  }
> = {
  damage: {
    color: '#ffffff',
    prefix: '-',
    suffix: '',
    fontSize: 'text-sm',
    mobileFontSize: 'text-xs',
    glow: 'rgba(255,255,255,0.4)',
    duration: 0.8,
    yTravel: -50,
  },
  critical: {
    color: '#fbbf24',
    prefix: '-',
    suffix: '!',
    fontSize: 'text-lg',
    mobileFontSize: 'text-base',
    glow: 'rgba(251,191,36,0.6)',
    duration: 1.0,
    yTravel: -65,
  },
  heal: {
    color: '#4ade80',
    prefix: '+',
    suffix: '',
    fontSize: 'text-sm',
    mobileFontSize: 'text-xs',
    glow: 'rgba(74,222,128,0.4)',
    duration: 0.9,
    yTravel: -40,
  },
  xp: {
    color: '#c084fc',
    prefix: '',
    suffix: '',
    fontSize: 'text-xs',
    mobileFontSize: 'text-[10px]',
    glow: 'rgba(192,132,252,0.4)',
    duration: 1.0,
    yTravel: -45,
  },
  gold: {
    color: '#fbbf24',
    prefix: '',
    suffix: '',
    fontSize: 'text-xs',
    mobileFontSize: 'text-[10px]',
    glow: 'rgba(251,191,36,0.4)',
    duration: 0.9,
    yTravel: -40,
  },
} as const;

export function DamageNumber({
  x,
  y,
  value,
  type,
  index = 0,
  onComplete,
}: DamageNumberProps) {
  const config = TYPE_CONFIG[type];

  // Stagger: offset x and y based on index so simultaneous numbers don't overlap
  const staggerOffsetX = useMemo(
    () => (Math.random() - 0.5) * 30 + index * 12,
    [index],
  );
  const staggerOffsetY = useMemo(() => index * -14, [index]);

  // Format display text
  const displayText = useMemo(() => {
    switch (type) {
      case 'xp':
        return `🌟+${value} XP`;
      case 'gold':
        return `🪙+${value}`;
      case 'critical':
        return `${config.prefix}${value}${config.suffix}`;
      default:
        return `${config.prefix}${value}${config.suffix}`;
    }
  }, [type, value, config.prefix, config.suffix]);

  const isCritical = type === 'critical';

  return (
    <motion.div
      className={`pointer-events-none absolute z-40 font-pixel font-bold ${config.fontSize} sm:${config.mobileFontSize}`}
      style={{
        left: x,
        top: y + staggerOffsetY,
        color: config.color,
        textShadow: `
          -1px -1px 0 #000,
          1px -1px 0 #000,
          -1px 1px 0 #000,
          1px 1px 0 #000,
          0 0 6px ${config.glow}
        `,
      }}
      initial={{
        opacity: 1,
        y: 0,
        x: staggerOffsetX,
        scale: isCritical ? 1.5 : 1.2,
      }}
      animate={{
        opacity: 0,
        y: config.yTravel,
        scale: isCritical ? 0.9 : 0.8,
        ...(isCritical
          ? {
              // Bounce for critical hits
              y: [0, -20, -10, config.yTravel],
            }
          : {}),
      }}
      transition={{
        duration: config.duration,
        ease: EASE,
        ...(isCritical
          ? {
              y: {
                duration: config.duration,
                times: [0, 0.2, 0.35, 1],
                ease: EASE,
              },
            }
          : {}),
      }}
      onAnimationComplete={onComplete}
    >
      {displayText}
    </motion.div>
  );
}

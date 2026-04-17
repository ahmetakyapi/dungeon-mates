'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';

const EASE = [0.22, 1, 0.36, 1] as const;

type DamageNumberType = 'damage' | 'critical' | 'heal' | 'xp' | 'gold' | 'fire' | 'ice' | 'poison' | 'holy';

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
    fontClasses: string;
    glow: string;
    duration: number;
    yTravel: number;
  }
> = {
  damage: {
    color: '#ffffff',
    prefix: '-',
    suffix: '',
    fontClasses: 'text-xs sm:text-sm lg:text-base 2xl:text-lg',
    glow: 'rgba(255,255,255,0.4)',
    duration: 0.8,
    yTravel: -50,
  },
  critical: {
    color: '#fbbf24',
    prefix: '-',
    suffix: '!',
    fontClasses: 'text-base sm:text-lg lg:text-xl 2xl:text-2xl',
    glow: 'rgba(251,191,36,0.6)',
    duration: 1.0,
    yTravel: -65,
  },
  heal: {
    color: '#4ade80',
    prefix: '+',
    suffix: '',
    fontClasses: 'text-xs sm:text-sm lg:text-base 2xl:text-lg',
    glow: 'rgba(74,222,128,0.4)',
    duration: 0.9,
    yTravel: -40,
  },
  xp: {
    color: '#c084fc',
    prefix: '',
    suffix: '',
    fontClasses: 'text-[10px] sm:text-xs lg:text-sm 2xl:text-base',
    glow: 'rgba(192,132,252,0.4)',
    duration: 1.0,
    yTravel: -45,
  },
  gold: {
    color: '#fbbf24',
    prefix: '',
    suffix: '',
    fontClasses: 'text-[10px] sm:text-xs lg:text-sm 2xl:text-base',
    glow: 'rgba(251,191,36,0.4)',
    duration: 0.9,
    yTravel: -40,
  },
  fire: {
    color: '#ff7a3a',
    prefix: '',
    suffix: '',
    fontClasses: 'text-xs sm:text-sm lg:text-base 2xl:text-lg',
    glow: 'rgba(255,122,58,0.6)',
    duration: 0.85,
    yTravel: -48,
  },
  ice: {
    color: '#7dd3fc',
    prefix: '',
    suffix: '',
    fontClasses: 'text-xs sm:text-sm lg:text-base 2xl:text-lg',
    glow: 'rgba(125,211,252,0.6)',
    duration: 0.85,
    yTravel: -45,
  },
  poison: {
    color: '#a78bfa',
    prefix: '',
    suffix: '',
    fontClasses: 'text-xs sm:text-sm lg:text-base 2xl:text-lg',
    glow: 'rgba(167,139,250,0.6)',
    duration: 0.85,
    yTravel: -45,
  },
  holy: {
    color: '#fde68a',
    prefix: '',
    suffix: '✦',
    fontClasses: 'text-sm sm:text-base lg:text-lg 2xl:text-xl',
    glow: 'rgba(253,230,138,0.7)',
    duration: 0.95,
    yTravel: -55,
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
      className={`pointer-events-none absolute z-40 font-pixel font-bold ${config.fontClasses}`}
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

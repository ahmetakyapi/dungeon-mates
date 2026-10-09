'use client';

import { motion } from 'framer-motion';
import type { CSSProperties, ElementType, ReactNode } from 'react';
import { EASE_OUT_EXPO } from '@/lib/motion';

type MaskRevealProps = {
  children: ReactNode;
  /** Seconds before the line starts rising. */
  delay?: number;
  duration?: number;
  className?: string;
  style?: CSSProperties;
  /** Where the line comes from. `up` rises from below the mask. */
  from?: 'up' | 'down';
  as?: ElementType;
};

/**
 * A single line that slides into view from behind a mask — the classic
 * editorial headline reveal. The outer element clips; the inner one moves.
 */
export function MaskReveal({
  children,
  delay = 0,
  duration = 0.9,
  className = '',
  style,
  from = 'up',
  as: Tag = 'span',
}: MaskRevealProps) {
  return (
    <Tag className={`relative inline-block overflow-hidden align-bottom ${className}`} style={style}>
      <motion.span
        className="inline-block will-change-transform"
        initial={{ y: from === 'up' ? '110%' : '-110%' }}
        animate={{ y: '0%' }}
        exit={{ y: from === 'up' ? '-110%' : '110%', transition: { duration: 0.35, ease: EASE_OUT_EXPO } }}
        transition={{ delay, duration, ease: EASE_OUT_EXPO }}
      >
        {children}
      </motion.span>
    </Tag>
  );
}

type SplitRevealProps = {
  text: string;
  delay?: number;
  /** Seconds between letters. */
  stagger?: number;
  duration?: number;
  className?: string;
  /** Applied to every letter — e.g. a text-shadow glow. */
  letterStyle?: CSSProperties;
  /** `rise` slides letters up through a mask; `drop` lets them fall in heavily. */
  variant?: 'rise' | 'drop';
};

/**
 * Letter-by-letter masked reveal. Words are kept together (nowrap) so a long
 * floor name still wraps between words on a phone rather than mid-word.
 */
export function SplitReveal({
  text,
  delay = 0,
  stagger = 0.035,
  duration = 0.8,
  className = '',
  letterStyle,
  variant = 'rise',
}: SplitRevealProps) {
  const words = text.split(' ');
  let index = 0;
  return (
    <span className={`inline-block ${className}`}>
      <span className="sr-only">{text}</span>
      {words.map((word, wi) => (
        <span key={`${word}-${wi}`} aria-hidden className="inline-block whitespace-nowrap">
          {Array.from(word).map((ch, ci) => {
            const i = index++;
            return (
              <span key={ci} className="relative inline-block overflow-hidden align-bottom" style={{ paddingBottom: '0.08em' }}>
                <motion.span
                  className="inline-block will-change-transform"
                  style={letterStyle}
                  initial={variant === 'rise' ? { y: '115%', rotate: 6 } : { y: '-120%', opacity: 0 }}
                  animate={{ y: '0%', rotate: 0, opacity: 1 }}
                  transition={
                    variant === 'rise'
                      ? { delay: delay + i * stagger, duration, ease: EASE_OUT_EXPO }
                      : { delay: delay + i * stagger, type: 'spring', stiffness: 520, damping: 24, mass: 1.1 }
                  }
                >
                  {ch}
                </motion.span>
              </span>
            );
          })}
          {wi < words.length - 1 ? <span className="inline-block">&nbsp;</span> : null}
        </span>
      ))}
    </span>
  );
}

type BlockBarProps = {
  /** 0..1 */
  value: number;
  blocks?: number;
  color?: string;
  /** Unlit block colour. */
  track?: string;
  className?: string;
  /** Block size in px. */
  size?: number;
  gap?: number;
};

/**
 * Progress drawn as a row of square pixels, echoing the shutter's blocks.
 * The leading lit block burns brighter so the bar always reads as "moving".
 */
export function BlockBar({
  value,
  blocks = 20,
  color = '#8b5cf6',
  track = 'rgba(255,255,255,0.06)',
  className = '',
  size = 8,
  gap = 3,
}: BlockBarProps) {
  const lit = Math.round(Math.min(1, Math.max(0, value)) * blocks);
  return (
    <div
      className={`flex ${className}`}
      style={{ gap }}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
    >
      {Array.from({ length: blocks }).map((_, i) => {
        const on = i < lit;
        const head = on && i === lit - 1;
        return (
          <span
            key={i}
            className="block transition-[background-color,box-shadow,transform] duration-300"
            style={{
              width: size,
              height: size,
              background: on ? color : track,
              boxShadow: head ? `0 0 10px ${color}, 0 0 2px #fff inset` : on ? `0 0 4px ${color}66` : 'none',
              transform: head ? 'translateY(-2px)' : 'none',
            }}
          />
        );
      })}
    </div>
  );
}

'use client';

import { type ButtonHTMLAttributes, type MouseEvent, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const EASE = [0.22, 1, 0.36, 1] as const;

type PixelButtonVariant = 'primary' | 'secondary' | 'danger' | 'gold';

type PixelButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: PixelButtonVariant;
  fullWidth?: boolean;
};

const VARIANT_STYLES: Record<PixelButtonVariant, string> = {
  primary:
    'bg-dm-accent hover:bg-dm-accent/90 border-purple-400/30 text-white shadow-[0_0_15px_rgba(139,92,246,0.2)]',
  secondary:
    'bg-zinc-700 hover:bg-zinc-600 border-zinc-500/30 text-zinc-200',
  danger:
    'bg-red-600 hover:bg-red-500 border-red-400/30 text-white shadow-[0_0_15px_rgba(239,68,68,0.2)]',
  gold: 'bg-dm-gold hover:bg-amber-400 border-yellow-300/30 text-dm-bg shadow-[0_0_15px_rgba(245,158,11,0.2)]',
} as const;

const VARIANT_HOVER_GLOW: Record<PixelButtonVariant, string> = {
  primary: '0 0 24px rgba(139,92,246,0.45)',
  secondary: '0 0 18px rgba(161,161,170,0.3)',
  danger: '0 0 24px rgba(239,68,68,0.45)',
  gold: '0 0 28px rgba(245,158,11,0.55)',
} as const;

const VARIANT_RIPPLE_COLOR: Record<PixelButtonVariant, string> = {
  primary: 'rgba(196,181,253,0.55)',
  secondary: 'rgba(228,228,231,0.45)',
  danger: 'rgba(254,202,202,0.55)',
  gold: 'rgba(254,243,199,0.6)',
} as const;

type Ripple = { id: number; x: number; y: number };

export function PixelButton({
  variant = 'primary',
  fullWidth = false,
  className = '',
  children,
  disabled,
  onClick,
  ...props
}: PixelButtonProps) {
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const nextId = useRef(0);

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = nextId.current++;
    setRipples((prev) => [...prev, { id, x, y }]);
    // Auto-remove after animation
    window.setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== id));
    }, 600);
    onClick?.(e);
  };

  return (
    <motion.button
      className={`
        relative overflow-hidden cursor-pointer border-2 px-5 py-3 font-pixel text-[10px] uppercase tracking-wider
        transition-colors
        sm:text-xs lg:text-sm lg:px-6 lg:py-3.5
        2xl:text-base 2xl:px-7 2xl:py-4
        3xl:px-8 3xl:py-4
        4xl:text-lg 4xl:px-10 4xl:py-5
        ${VARIANT_STYLES[variant]}
        ${fullWidth ? 'w-full' : ''}
        ${disabled ? 'cursor-not-allowed opacity-50' : ''}
        ${className}
      `}
      style={{
        clipPath: 'polygon(4px 0, calc(100% - 4px) 0, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 0 calc(100% - 4px), 0 4px)',
      }}
      whileHover={!disabled ? { scale: 1.03, boxShadow: VARIANT_HOVER_GLOW[variant] } : undefined}
      whileTap={!disabled ? { scale: 0.97, y: 2 } : undefined}
      transition={{ type: 'spring', stiffness: 380, damping: 22 }}
      disabled={disabled}
      onClick={handleClick}
      {...(props as Record<string, unknown>)}
    >
      <span className="relative z-10">{children}</span>
      {/* Ripple layer */}
      <AnimatePresence>
        {ripples.map((r) => (
          <motion.span
            key={r.id}
            className="pointer-events-none absolute rounded-full"
            style={{
              left: r.x,
              top: r.y,
              translate: '-50% -50%',
              background: VARIANT_RIPPLE_COLOR[variant],
              width: 6,
              height: 6,
            }}
            initial={{ scale: 0, opacity: 0.6 }}
            animate={{ scale: 40, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.55, ease: EASE }}
          />
        ))}
      </AnimatePresence>
    </motion.button>
  );
}

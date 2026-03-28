'use client';

import { type ButtonHTMLAttributes } from 'react';
import { motion } from 'framer-motion';

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

export function PixelButton({
  variant = 'primary',
  fullWidth = false,
  className = '',
  children,
  disabled,
  ...props
}: PixelButtonProps) {
  return (
    <motion.button
      className={`
        relative cursor-pointer border-2 px-5 py-3 font-pixel text-[10px] uppercase tracking-wider
        transition-colors
        sm:text-xs
        ${VARIANT_STYLES[variant]}
        ${fullWidth ? 'w-full' : ''}
        ${disabled ? 'cursor-not-allowed opacity-50' : ''}
        ${className}
      `}
      style={{
        clipPath: 'polygon(4px 0, calc(100% - 4px) 0, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 0 calc(100% - 4px), 0 4px)',
      }}
      whileHover={!disabled ? { scale: 1.03 } : undefined}
      whileTap={!disabled ? { scale: 0.97, y: 2 } : undefined}
      transition={{ duration: 0.2, ease: EASE }}
      disabled={disabled}
      {...(props as Record<string, unknown>)}
    >
      {children}
    </motion.button>
  );
}

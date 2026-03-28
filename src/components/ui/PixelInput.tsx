'use client';

import { type InputHTMLAttributes } from 'react';

type PixelInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
};

export function PixelInput({
  label,
  className = '',
  ...props
}: PixelInputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="font-pixel text-[9px] text-zinc-400">{label}</label>
      )}
      <input
        className={`
          w-full border-2 border-dm-border bg-dm-surface px-4 py-3
          font-pixel text-[10px] text-white placeholder-zinc-600
          outline-none
          transition-all
          focus:border-dm-accent focus:shadow-[0_0_10px_rgba(139,92,246,0.2)]
          sm:text-xs
          ${className}
        `}
        style={{
          clipPath:
            'polygon(4px 0, calc(100% - 4px) 0, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 0 calc(100% - 4px), 0 4px)',
        }}
        {...props}
      />
    </div>
  );
}

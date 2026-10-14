'use client';

import { forwardRef, type InputHTMLAttributes } from 'react';

type PixelInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
};

export const PixelInput = forwardRef<HTMLInputElement, PixelInputProps>(function PixelInput({
  label,
  className = '',
  id,
  ...props
}, ref) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="dm-label text-zinc-400">{label}</label>
      )}
      <input
        ref={ref}
        id={id}
        className={`
          w-full border-2 border-dm-border bg-dm-surface px-4 py-3
          font-pixel text-xs text-white placeholder-zinc-600
          outline-none
          transition-all
          focus:border-dm-accent focus:shadow-[0_0_10px_rgba(139,92,246,0.2)]
          sm:text-xs lg:text-sm lg:px-5 lg:py-3.5
          2xl:text-base 2xl:px-6 2xl:py-4
          3xl:px-7 3xl:py-4
          4xl:text-lg 4xl:px-8 4xl:py-5
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
});

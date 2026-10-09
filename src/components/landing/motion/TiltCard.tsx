'use client';

import { useRef, type CSSProperties, type ReactNode } from 'react';
import { motion, useMotionTemplate, useMotionValue, useSpring } from 'framer-motion';

/**
 * A card that leans toward the pointer and carries a soft spotlight under it.
 * Small angles — it should feel like a slab catching torchlight, not a toy.
 */
export function TiltCard({ children, className, style, max = 7, glow = 'rgba(145,132,217,0.18)' }: {
  children: ReactNode; className?: string; style?: CSSProperties; max?: number; glow?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const mx = useMotionValue(50);
  const my = useMotionValue(50);
  const srx = useSpring(rx, { stiffness: 180, damping: 18 });
  const sry = useSpring(ry, { stiffness: 180, damping: 18 });
  const bg = useMotionTemplate`radial-gradient(420px circle at ${mx}% ${my}%, ${glow}, transparent 60%)`;

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ ...style, rotateX: srx, rotateY: sry, transformPerspective: 900, position: 'relative' }}
      onPointerMove={(e) => {
        if (e.pointerType !== 'mouse' || !ref.current) return;
        const r = ref.current.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        ry.set((px - 0.5) * max * 2);
        rx.set(-(py - 0.5) * max * 2);
        mx.set(px * 100);
        my.set(py * 100);
      }}
      onPointerLeave={() => { rx.set(0); ry.set(0); }}
    >
      {children}
      <motion.span
        aria-hidden
        style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none', background: bg, mixBlendMode: 'screen' }}
      />
    </motion.div>
  );
}

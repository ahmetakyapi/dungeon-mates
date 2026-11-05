'use client';

import { useRef, type CSSProperties, type ReactNode } from 'react';
import { motion, useMotionTemplate, useMotionValue, useSpring } from 'framer-motion';

/**
 * A card that leans toward the pointer and carries a soft spotlight under it;
 * its rim lights up nearest the pointer.
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
  // The rim catches the light first: a brighter, tighter circle masked to the
  // 1px border (landing.css → .dm-edge-light).
  const edge = useMotionTemplate`radial-gradient(260px circle at ${mx}% ${my}%, rgba(255,210,160,0.75), transparent 70%)`;

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
        ref.current.dataset.lit = 'true';
      }}
      onPointerLeave={() => { rx.set(0); ry.set(0); if (ref.current) delete ref.current.dataset.lit; }}
    >
      {children}
      <motion.span
        aria-hidden
        style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none', background: bg, mixBlendMode: 'screen' }}
      />
      <motion.span aria-hidden className="dm-edge-light" style={{ background: edge }} />
    </motion.div>
  );
}

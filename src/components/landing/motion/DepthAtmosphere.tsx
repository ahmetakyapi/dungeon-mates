'use client';

import { useEffect, useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { PixelMotes } from '@/components/fx/PixelMotes';

/**
 * The page as a descent you can feel.
 *
 * One fixed layer behind the content that changes with depth:
 *
 *   tint     three washes — the cold surface, the violet depths, the heart of
 *            the Fire — crossfaded by scroll progress (opacity only, so the
 *            compositor does it without repainting the gradients)
 *   motes    a single low-resolution canvas of pixel motes: pale dust near the
 *            surface, rising embers further down. The count follows depth.
 *   torch    on a fine pointer, a warm light that follows the cursor — the
 *            reader carries the torch. Moved by transform, batched per frame.
 *
 * Everything sits behind the content (z-index 0) and never takes the pointer.
 * Reduced motion: the tint stays, the motes and the torch do not run.
 */

export function DepthAtmosphere() {
  const { scrollYProgress } = useScroll();
  const surface = useTransform(scrollYProgress, [0, 0.25, 0.45], [1, 0.6, 0]);
  const depths = useTransform(scrollYProgress, [0.2, 0.45, 0.7, 0.85], [0, 1, 1, 0]);
  const fire = useTransform(scrollYProgress, [0.6, 0.9, 1], [0, 0.8, 1]);
  const emberShare = useTransform(scrollYProgress, (v) => Math.max(0, v * 1.1 - 0.15));

  return (
    <div aria-hidden className="dm-atmos">
      <motion.div className="dm-atmos-tint dm-atmos-tint--surface" style={{ opacity: surface }} />
      <motion.div className="dm-atmos-tint dm-atmos-tint--depths" style={{ opacity: depths }} />
      <motion.div className="dm-atmos-tint dm-atmos-tint--fire" style={{ opacity: fire }} />
      {/* Deeper → more embers: the share follows scroll depth. */}
      <PixelMotes ember={emberShare} max={90} min={28} />
      <Torch />
    </div>
  );
}

function Torch() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fine = window.matchMedia?.('(pointer: fine)').matches;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!fine || reduce) return;

    let raf = 0;
    let px = -9999;
    let py = -9999;
    const apply = () => {
      raf = 0;
      el.style.transform = `translate3d(${px}px, ${py}px, 0)`;
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      px = e.clientX;
      py = e.clientY;
      el.dataset.on = 'true';
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const onLeave = () => { delete el.dataset.on; };
    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return <div ref={ref} className="dm-atmos-torch" />;
}

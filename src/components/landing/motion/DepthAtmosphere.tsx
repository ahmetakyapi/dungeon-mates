'use client';

import { useEffect, useRef } from 'react';
import { motion, useScroll, useTransform, type MotionValue } from 'framer-motion';

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

/** Canvas pixels per mote pixel: motes read as chunky pixels, not dots. */
const PX = 3;
const MAX_MOTES = 90;

export function DepthAtmosphere() {
  const { scrollYProgress } = useScroll();
  const surface = useTransform(scrollYProgress, [0, 0.25, 0.45], [1, 0.6, 0]);
  const depths = useTransform(scrollYProgress, [0.2, 0.45, 0.7, 0.85], [0, 1, 1, 0]);
  const fire = useTransform(scrollYProgress, [0.6, 0.9, 1], [0, 0.8, 1]);

  return (
    <div aria-hidden className="dm-atmos">
      <motion.div className="dm-atmos-tint dm-atmos-tint--surface" style={{ opacity: surface }} />
      <motion.div className="dm-atmos-tint dm-atmos-tint--depths" style={{ opacity: depths }} />
      <motion.div className="dm-atmos-tint dm-atmos-tint--fire" style={{ opacity: fire }} />
      <Motes progress={scrollYProgress} />
      <Torch />
    </div>
  );
}

function Motes({ progress }: { progress: MotionValue<number> }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Pool: x, y, vx, vy, life, kind (0 dust, 1 ember), phase. Allocated once.
    const x = new Float32Array(MAX_MOTES);
    const y = new Float32Array(MAX_MOTES);
    const vy = new Float32Array(MAX_MOTES);
    const ph = new Float32Array(MAX_MOTES);
    const kind = new Uint8Array(MAX_MOTES);
    const alive = new Uint8Array(MAX_MOTES);
    let w = 0;
    let h = 0;

    const resize = () => {
      w = Math.ceil(window.innerWidth / PX);
      h = Math.ceil(window.innerHeight / PX);
      canvas.width = w;
      canvas.height = h;
    };
    resize();
    window.addEventListener('resize', resize);

    const spawn = (i: number, depth: number, anywhere: boolean) => {
      // Deeper → more embers, and they rise faster.
      const ember = Math.random() < depth * 1.1 - 0.15;
      kind[i] = ember ? 1 : 0;
      x[i] = Math.random() * w;
      y[i] = anywhere ? Math.random() * h : h + 2;
      vy[i] = ember ? -(0.25 + Math.random() * 0.55) : -(0.04 + Math.random() * 0.12);
      ph[i] = Math.random() * Math.PI * 2;
      alive[i] = 1;
    };

    let raf = 0;
    let last = 0;
    let seeded = false;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      // ~30 fps is plenty for drifting motes and halves the cost.
      if (now - last < 32) return;
      last = now;
      const depth = progress.get();
      const target = Math.round(28 + depth * (MAX_MOTES - 28));
      if (!seeded) { for (let i = 0; i < target; i++) spawn(i, depth, true); seeded = true; }

      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < MAX_MOTES; i++) {
        if (!alive[i]) { if (i < target && Math.random() < 0.08) spawn(i, depth, false); continue; }
        ph[i] += 0.05;
        y[i] += vy[i];
        x[i] += Math.sin(ph[i]) * (kind[i] ? 0.35 : 0.12);
        if (y[i] < -2 || x[i] < -2 || x[i] > w + 2) { alive[i] = 0; continue; }
        // Fade near the top so motes do not pop out at the edge.
        const fade = Math.min(1, y[i] / (h * 0.35));
        if (kind[i]) {
          const flick = 0.55 + 0.45 * Math.sin(ph[i] * 3.1);
          ctx.globalAlpha = 0.85 * fade * flick;
          ctx.fillStyle = flick > 0.8 ? '#ffd27a' : '#ff8a3d';
          ctx.fillRect(x[i] | 0, y[i] | 0, 1, 1);
        } else {
          ctx.globalAlpha = 0.28 * fade;
          ctx.fillStyle = '#b9b6d8';
          ctx.fillRect(x[i] | 0, y[i] | 0, 1, 1);
        }
      }
      ctx.globalAlpha = 1;
    };

    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [progress]);

  return <canvas ref={ref} className="dm-atmos-motes" />;
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

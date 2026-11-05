'use client';

import { useEffect, useRef } from 'react';
import type { MotionValue } from 'framer-motion';

/**
 * Drifting pixel motes on one low-resolution canvas.
 *
 * Shared by the landing's depth atmosphere and the in-game menu screens.
 * Each canvas pixel is `px` CSS pixels (sampled `pixelated`), so a mote is a
 * chunky square, never a soft dot. Two kinds: slow pale dust and quick
 * flickering embers; `ember` is the share of embers, a number or a live
 * motion value (the landing passes scroll depth, so it warms on the way down).
 *
 * Pool allocated once, ~30 fps, stops in a hidden tab, nothing under
 * reduced motion.
 */

export type MoteTone = 'ember' | 'arcane' | 'gold' | 'ash';

const TONES: Record<MoteTone, { hot: string; warm: string; dust: string }> = {
  ember: { hot: '#ffd27a', warm: '#ff8a3d', dust: '#b9b6d8' },
  arcane: { hot: '#e4dbff', warm: '#9b7bff', dust: '#8f93c4' },
  gold: { hot: '#fff1b8', warm: '#f5b942', dust: '#d9cfa8' },
  ash: { hot: '#c9c3bd', warm: '#8a7f78', dust: '#6b6670' },
};

export function PixelMotes({ ember = 0.5, max = 70, min = 24, px = 3, tone = 'ember', className }: {
  ember?: number | MotionValue<number>;
  max?: number;
  min?: number;
  px?: number;
  tone?: MoteTone;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const emberRef = useRef(ember);
  emberRef.current = ember;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const colors = TONES[tone];

    const x = new Float32Array(max);
    const y = new Float32Array(max);
    const vy = new Float32Array(max);
    const ph = new Float32Array(max);
    const kind = new Uint8Array(max);
    const alive = new Uint8Array(max);
    let w = 0;
    let h = 0;

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      w = Math.max(1, Math.ceil(r.width / px));
      h = Math.max(1, Math.ceil(r.height / px));
      canvas.width = w;
      canvas.height = h;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const share = () => {
      const e = emberRef.current;
      return typeof e === 'number' ? e : e.get();
    };

    const spawn = (i: number, e: number, anywhere: boolean) => {
      const hot = Math.random() < e;
      kind[i] = hot ? 1 : 0;
      x[i] = Math.random() * w;
      y[i] = anywhere ? Math.random() * h : h + 2;
      vy[i] = hot ? -(0.25 + Math.random() * 0.55) : -(0.04 + Math.random() * 0.12);
      ph[i] = Math.random() * Math.PI * 2;
      alive[i] = 1;
    };

    let raf = 0;
    let last = 0;
    let seeded = false;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (now - last < 32) return;
      last = now;
      const e = share();
      const target = Math.round(min + Math.min(1, e) * (max - min));
      if (!seeded) { for (let i = 0; i < target; i++) spawn(i, e, true); seeded = true; }

      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < max; i++) {
        if (!alive[i]) { if (i < target && Math.random() < 0.08) spawn(i, e, false); continue; }
        ph[i] += 0.05;
        y[i] += vy[i];
        x[i] += Math.sin(ph[i]) * (kind[i] ? 0.35 : 0.12);
        if (y[i] < -2 || x[i] < -2 || x[i] > w + 2) { alive[i] = 0; continue; }
        const fade = Math.min(1, y[i] / (h * 0.35));
        if (kind[i]) {
          const flick = 0.55 + 0.45 * Math.sin(ph[i] * 3.1);
          ctx.globalAlpha = 0.85 * fade * flick;
          ctx.fillStyle = flick > 0.8 ? colors.hot : colors.warm;
        } else {
          ctx.globalAlpha = 0.28 * fade;
          ctx.fillStyle = colors.dust;
        }
        ctx.fillRect(x[i] | 0, y[i] | 0, 1, 1);
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
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [max, min, px, tone]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={className}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', imageRendering: 'pixelated', pointerEvents: 'none' }}
    />
  );
}

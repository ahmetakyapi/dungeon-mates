'use client';

import { useEffect, useRef } from 'react';
import {
  drawPortrait, PORTRAIT_W, PORTRAIT_H, type PortraitClass,
} from '@/game/renderer/PortraitRenderer';

/**
 * A live class portrait.
 *
 * Replaces the PNG captures of the 16×16 dungeon sprite. Those were the game's
 * own art, which was the point, but at 190px a 16px sprite is mostly empty
 * upscaling — there was no face to read. This draws at 48×64 and animates:
 * breathing, cloth sway, a blade glint or drifting motes, and a blink.
 *
 * Paused while off screen, like the other canvases on this page.
 */
export function ClassPortrait({
  cls, className = '', height = 190,
}: {
  cls: PortraitClass;
  className?: string;
  height?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = PORTRAIT_W;
    canvas.height = PORTRAIT_H;
    ctx.imageSmoothingEnabled = false;

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    let visible = true;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { rootMargin: '120px' });
    io.observe(canvas);

    let raf = 0;
    let start = 0;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!visible) return;
      if (!start) start = now;
      // Reduced motion still gets a portrait, just a still one — held at a
      // moment where the eyes are open and the glint is off the blade.
      drawPortrait(ctx, cls, reduced ? 0.6 : (now - start) / 1000);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); io.disconnect(); };
  }, [cls]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={className}
      style={{
        height, width: 'auto', maxWidth: '100%',
        imageRendering: 'pixelated', display: 'block', margin: '0 auto',
      }}
    />
  );
}

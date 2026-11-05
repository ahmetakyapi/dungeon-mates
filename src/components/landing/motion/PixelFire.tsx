'use client';

import { useEffect, useRef } from 'react';

/**
 * Ateş-i Kadim, drawn the way 1993 drew fire.
 *
 * The classic cellular fire: a bottom row of full heat, and every frame each
 * cell passes its heat to a neighbour in the row above, a little cooler and a
 * little to one side. Thirty-seven heat steps map to a palette from nothing
 * through deep red and ember to a pale core; the cold end is transparent, so
 * the flames burn on the page itself rather than in a box.
 *
 * One small canvas (one cell = 6 CSS px, upscaled with pixelated sampling),
 * one ImageData written through a Uint32 view — no allocation per frame. It
 * runs only while on screen and stops in a hidden tab. `stoke` lets the page
 * feed it: hovering the call to play makes the fire climb.
 * Reduced motion: a few hundred steps are simulated once and left as a still.
 */

const CELL = 6;
const STEPS = 37;

/** Heat → colour. The cold end fades out instead of turning black. */
const STOPS: ReadonlyArray<readonly [number, number, number, number]> = [
  [7, 7, 7, 0], [31, 7, 7, 60], [47, 15, 7, 110], [71, 15, 7, 150], [87, 23, 7, 180], [103, 31, 7, 200],
  [119, 31, 7, 215], [143, 39, 7, 230], [159, 47, 7, 240], [175, 63, 7, 250], [191, 71, 7, 255], [199, 71, 7, 255],
  [223, 79, 7, 255], [223, 87, 7, 255], [223, 87, 7, 255], [215, 95, 7, 255], [215, 95, 7, 255], [215, 103, 15, 255],
  [207, 111, 15, 255], [207, 119, 15, 255], [207, 127, 15, 255], [207, 135, 23, 255], [199, 135, 23, 255], [199, 143, 23, 255],
  [199, 151, 31, 255], [191, 159, 31, 255], [191, 159, 31, 255], [191, 167, 39, 255], [191, 167, 39, 255], [191, 175, 47, 255],
  [183, 175, 47, 255], [183, 183, 47, 255], [183, 183, 55, 255], [207, 207, 111, 255], [223, 223, 159, 255], [239, 239, 199, 255],
  [255, 255, 255, 255],
];

function buildPalette(): Uint32Array {
  const p = new Uint32Array(STEPS);
  for (let i = 0; i < STEPS; i++) {
    const [r, g, b, a] = STOPS[i];
    // ImageData is RGBA in memory; a little-endian Uint32 reads it as ABGR.
    p[i] = ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
  }
  return p;
}

export function PixelFire({ className, stoke = false, height = 0.5 }: {
  className?: string;
  stoke?: boolean;
  /** How high the flames reach, 0–1 of the canvas. */
  height?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const stokeRef = useRef(stoke);
  stokeRef.current = stoke;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const palette = buildPalette();
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    let cols = 0;
    let rows = 0;
    let heat = new Uint8Array(0);
    let image: ImageData | null = null;
    let pixels = new Uint32Array(0);
    let flare = 0; // eased 0..1 follow of `stoke`

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const c = Math.max(8, Math.ceil(r.width / CELL));
      const h = Math.max(8, Math.ceil(r.height / CELL));
      if (c === cols && h === rows) return;
      cols = c; rows = h;
      canvas.width = cols; canvas.height = rows;
      heat = new Uint8Array(cols * rows);
      image = ctx.createImageData(cols, rows);
      pixels = new Uint32Array(image.data.buffer);
    };

    /** Cooling per row, tuned so the flames reach `height` of the canvas. */
    const step = () => {
      flare += ((stokeRef.current ? 1 : 0) - flare) * 0.06;
      const reach = Math.min(0.95, height + flare * 0.3);
      // Average decay per row that empties STEPS of heat over reach*rows rows.
      const decay = (STEPS / Math.max(4, reach * rows)) * 1.05;
      const last = (rows - 1) * cols;
      // Source row: full heat with slow gaps, so the base is tongues, not a wall.
      const t = performance.now() * 0.0012;
      for (let x = 0; x < cols; x++) {
        const gap = Math.sin(x * 0.21 + t) + Math.sin(x * 0.067 - t * 0.7);
        // Source tops out below white-hot: on a page the pale core read as glare.
        heat[last + x] = gap < -1.1 + flare * 0.6 ? 24 : STEPS - 5;
      }
      for (let y = 1; y < rows; y++) {
        const row = y * cols;
        for (let x = 0; x < cols; x++) {
          const src = row + x;
          const v = heat[src];
          // Cooling averages `decay` per row; the drift sends heat up-left,
          // up or up-right, which is what makes it lick instead of rise.
          const cool = (Math.random() * (decay * 2 + 1)) | 0;
          const dst = src - cols - ((Math.random() * 3) | 0) + 1;
          if (dst >= 0) heat[dst] = v - cool > 0 ? v - cool : 0;
        }
      }
    };

    const draw = () => {
      if (!image) return;
      for (let i = 0; i < heat.length; i++) pixels[i] = palette[heat[i]];
      ctx.putImageData(image, 0, 0);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    if (reduce) {
      for (let i = 0; i < rows * 3; i++) step();
      draw();
      return () => ro.disconnect();
    }

    let raf = 0;
    let lastT = 0;
    let visible = false;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (now - lastT < 40) return; // ~25 fps: the flicker of a real torch, half the cost
      lastT = now;
      step();
      draw();
    };
    const start = () => { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame); };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); else stop(); });
    io.observe(canvas);
    const onVis = () => { if (document.hidden) stop(); else start(); };
    document.addEventListener('visibilitychange', onVis);
    // Warm up so the first visible frame is already burning.
    for (let i = 0; i < rows; i++) step();

    return () => {
      stop();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [height]);

  return <canvas ref={ref} aria-hidden className={className} />;
}

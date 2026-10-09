'use client';

import { useEffect, useMemo, useState } from 'react';
import { hash01 } from '@/lib/motion';

export type ShutterMode = 'cover' | 'reveal';

type PixelShutterProps = {
  /** `cover` fills the screen block by block; `reveal` clears it the same way. */
  mode: ShutterMode;
  /** Colour the screen ends up (cover) or starts (reveal) as. */
  color?: string;
  /** Colour of the travelling wavefront — the blocks glow as they land. */
  edge?: string;
  /** Total time for the sweep, ms. */
  durationMs?: number;
  /** Fires once the last block has finished. */
  onDone?: () => void;
  /** Stacking order. */
  zIndex?: number;
  /**
   * Direction of travel. `down` sweeps top-left → bottom-right, which reads as a
   * descent; `up` is the reverse, for climbing out.
   */
  direction?: 'down' | 'up';
  /**
   * Whether a covering shutter swallows clicks. Route transitions want that;
   * in-game phase wipes must never block input, so they pass `false`.
   */
  interactive?: boolean;
};

/**
 * A screen-filling grid of square blocks that land (or lift) in a diagonal wave.
 *
 * Pixel art is the game's whole visual language, so the transition between
 * pages is built out of pixels too: the screen is quantised into blocks the way
 * the game quantises the world into tiles, and the wavefront glows like the
 * Fire the story is about. Each block is a plain div with a CSS animation — no
 * per-frame JS, so it costs nothing while the next route is compiling.
 */
export function PixelShutter({
  mode,
  color = '#07080f',
  edge = '#9184d9',
  durationMs = 720,
  onDone,
  zIndex = 200,
  direction = 'down',
  interactive = true,
}: PixelShutterProps) {
  const [grid, setGrid] = useState<{ cols: number; rows: number } | null>(null);

  useEffect(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    // Roughly 64px blocks on desktop, never fewer than 8 across on a phone.
    const cols = Math.max(8, Math.min(26, Math.round(w / 64)));
    const rows = Math.ceil(h / (w / cols));
    setGrid({ cols, rows });
  }, []);

  // Each block's share of the timeline. The sweep itself takes ~60% of the
  // duration; the remaining 40% is the block's own grow/shrink.
  const cellMs = durationMs * 0.4;
  const spreadMs = durationMs - cellMs;

  const cells = useMemo(() => {
    if (!grid) return [];
    const out: Array<{ key: number; delay: number }> = [];
    const maxD = grid.cols + grid.rows;
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        const i = r * grid.cols + c;
        // Diagonal distance plus a little noise so the front is ragged, like
        // torchlight eating into dark rather than a ruler-straight wipe.
        let d = (r + c + hash01(i) * 2.2) / (maxD + 2.2);
        if (direction === 'up') d = 1 - d;
        out.push({ key: i, delay: d * spreadMs });
      }
    }
    return out;
  }, [grid, spreadMs, direction]);

  useEffect(() => {
    if (!grid) return;
    const t = window.setTimeout(() => onDone?.(), durationMs + 30);
    return () => window.clearTimeout(t);
    // onDone is deliberately read once per run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid, mode, durationMs]);

  if (!grid) {
    // First paint before the grid is measured: a reveal must start opaque so the
    // page underneath never flashes through.
    return mode === 'reveal'
      ? <div aria-hidden className="pointer-events-none fixed inset-0" style={{ zIndex, background: color }} />
      : null;
  }

  return (
    <div
      aria-hidden
      className="fixed inset-0 grid"
      style={{
        zIndex,
        gridTemplateColumns: `repeat(${grid.cols}, 1fr)`,
        gridTemplateRows: `repeat(${grid.rows}, ${100 / grid.cols}vw)`,
        pointerEvents: interactive && mode === 'cover' ? 'auto' : 'none',
        ['--shutter-base' as string]: color,
        ['--shutter-edge' as string]: edge,
      }}
    >
      {cells.map(({ key, delay }) => (
        <span
          key={key}
          className={mode === 'cover' ? 'dm-shutter-in' : 'dm-shutter-out'}
          style={{ animationDuration: `${cellMs}ms`, animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  );
}

'use client';

import { useEffect, useRef } from 'react';
import { SpriteRenderer } from '@/game/renderer/SpriteRenderer';
import { TILE_SIZE, type TileType } from '../../../shared/types';

/**
 * A cross-section of a real dungeon floor, drawn with the game's own
 * SpriteRenderer at the game's own resolution.
 *
 * This is not a mockup or a screenshot: it calls the same drawTile() the game
 * calls, with the same per-floor palette and the same autotiling neighbour mask.
 * If the floor themes change, this changes with them.
 */
export function FloorStrip({ floor, className = '' }: { floor: number; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Sized so the canvas lands near 1:1 in its container — stretching a pixel-art
    // canvas to fit is exactly the thing that destroys pixel fidelity.
    const COLS = 48;
    const ROWS = 5;
    canvas.width = COLS * TILE_SIZE;
    canvas.height = ROWS * TILE_SIZE;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    // A chamber cross-section: one course of rock on top, walkable floor between,
    // rock below. That is the arrangement that shows off the autotiling — the lit
    // top cap, the dark base where wall meets floor, and the contact shadows.
    const tiles: TileType[][] = [];
    for (let y = 0; y < ROWS; y++) {
      const row: TileType[] = [];
      for (let x = 0; x < COLS; x++) {
        row.push(y === 0 || y === ROWS - 1 ? 'wall' : 'floor');
      }
      tiles.push(row);
    }

    // Doorways at both ends, plus pillars so corners and seams appear.
    tiles[2][0] = 'door';
    tiles[2][COLS - 1] = 'door';
    for (const px of [9, 22, 35]) {
      tiles[1][px] = 'wall';
      tiles[2][px] = 'wall';
    }
    if (floor >= 3) tiles[3][15] = 'chest';
    if (floor >= 6) tiles[3][29] = 'chest';
    if (floor === 10) tiles[2][41] = 'stairs';

    const sprites = new SpriteRenderer();
    sprites.setFloorTheme(floor);

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        sprites.drawTile(
          ctx,
          x * TILE_SIZE,
          y * TILE_SIZE,
          tiles[y][x],
          true,
          x,
          y,
          tiles,
          COLS,
          ROWS,
          0,
        );
      }
    }
  }, [floor]);

  return (
    // The canvas carries an intrinsic width of COLS * TILE_SIZE (768px). In flow,
    // that becomes a min-content contribution which grid tracks refuse to shrink
    // below — it pushed the whole page wider than a phone viewport. Absolutely
    // positioned elements contribute nothing to intrinsic sizing, so the wrapper
    // takes its width from the layout and the canvas simply fills it.
    <div className={`relative h-full w-full overflow-hidden ${className}`}>
      <canvas
        ref={canvasRef}
        // object-cover crops rather than stretching, so tiles keep their aspect
        // ratio and stay crisp at any container width.
        className="absolute inset-0 h-full w-full object-cover"
        style={{ imageRendering: 'pixelated' }}
        aria-hidden
      />
    </div>
  );
}

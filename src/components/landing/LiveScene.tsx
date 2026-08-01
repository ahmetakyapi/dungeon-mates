'use client';

import { useEffect, useRef } from 'react';
import { SpriteRenderer } from '@/game/renderer/SpriteRenderer';
import {
  TILE_SIZE,
  TICK_RATE,
  ATTACK_PROFILES,
  TELEGRAPH_CIRCLE,
  TELEGRAPH_CONE,
  type TileType,
  type MonsterType,
  type PlayerClass,
} from '../../../shared/types';

export type ScenePhase = 'windup' | 'active' | 'recovery' | 'idle';

/**
 * A live dungeon scene, drawn with the game's own renderer and driven by the
 * game's own attack timings.
 *
 * This is not a screenshot or a mock: tiles come from SpriteRenderer.drawTile
 * with the real per-floor palette and autotiling mask, the characters are the
 * real sprites, and the attack cycle reads its durations straight out of
 * ATTACK_PROFILES — the same table the server runs combat from. The telegraph is
 * drawn the way GameRenderer draws it, so what the page shows is what the game
 * does. If the combat tuning changes, this changes with it.
 */
export function LiveScene({
  floor = 7,
  monster = 'dark_knight',
  playerClass = 'warrior',
  cols = 30,
  rows = 17,
  onPhase,
  className = '',
  showLabel = true,
}: {
  floor?: number;
  monster?: MonsterType;
  playerClass?: PlayerClass;
  cols?: number;
  rows?: number;
  onPhase?: (phase: ScenePhase) => void;
  className?: string;
  showLabel?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Kept in a ref so the animation loop never re-subscribes on parent re-render.
  const onPhaseRef = useRef(onPhase);
  onPhaseRef.current = onPhase;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = cols * TILE_SIZE;
    canvas.height = rows * TILE_SIZE;
    ctx.imageSmoothingEnabled = false;

    const sprites = new SpriteRenderer();
    sprites.setFloorTheme(floor);

    // A walled chamber. Wall ring plus a couple of pillars so the autotiling has
    // corners and faces to resolve.
    const tiles: TileType[][] = [];
    for (let y = 0; y < rows; y++) {
      const row: TileType[] = [];
      for (let x = 0; x < cols; x++) {
        row.push(y === 0 || y === rows - 1 || x === 0 || x === cols - 1 ? 'wall' : 'floor');
      }
      tiles.push(row);
    }
    for (const [px, py] of [[5, 3], [5, 4], [cols - 6, rows - 5], [cols - 6, rows - 4]]) {
      if (tiles[py]?.[px]) tiles[py][px] = 'wall';
    }
    tiles[Math.floor(rows / 2)][0] = 'door';
    tiles[Math.floor(rows / 2)][cols - 1] = 'door';

    const profile = ATTACK_PROFILES[monster];
    const msPerTick = 1000 / TICK_RATE;
    const WINDUP = profile.windupTicks * msPerTick;
    const ACTIVE = profile.activeTicks * msPerTick;
    const RECOVER = profile.recoveryTicks * msPerTick;
    const IDLE = 900; // breathing room between demonstrations
    const CYCLE = WINDUP + ACTIVE + RECOVER + IDLE;

    // Attacker on the left, target on the right, inside the telegraph's reach.
    const mTile = { x: cols * 0.34, y: rows * 0.5 };
    // At range * 0.72 the two 1-tile sprites nearly touched and read as one blob.
    // Keep the target inside the telegraph but visibly separate.
    const pTile = { x: mTile.x + Math.max(2.2, profile.range * 0.95), y: rows * 0.5 };
    const dirX = 1;
    const dirY = 0;

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    let raf = 0;
    let start = 0;
    let lastPhase: ScenePhase | null = null;
    let animFrame = 0;
    let animAcc = 0;
    let prev = 0;

    const draw = (now: number) => {
      if (!start) { start = now; prev = now; }
      const dt = Math.min(64, now - prev);
      prev = now;

      // Reduced motion: hold the moment the telegraph is nearly full, which is the
      // frame that actually communicates the mechanic.
      const t = reduced ? WINDUP * 0.85 : (now - start) % CYCLE;

      // Sprite animation clock, same 8fps the game uses.
      animAcc += dt;
      while (animAcc >= 125) { animAcc -= 125; animFrame++; }

      let phase: ScenePhase;
      let progress = 0;
      if (t < WINDUP) { phase = 'windup'; progress = t / WINDUP; }
      else if (t < WINDUP + ACTIVE) { phase = 'active'; progress = 1; }
      else if (t < WINDUP + ACTIVE + RECOVER) { phase = 'recovery'; }
      else { phase = 'idle'; }

      if (phase !== lastPhase) {
        lastPhase = phase;
        onPhaseRef.current?.(phase);
      }

      // --- tiles ---
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          sprites.drawTile(ctx, x * TILE_SIZE, y * TILE_SIZE, tiles[y][x], true, x, y, tiles, cols, rows, animFrame);
        }
      }

      // --- telegraph, drawn the way GameRenderer draws it ---
      if (phase === 'windup' || phase === 'active') {
        const sx = Math.round(mTile.x * TILE_SIZE);
        const sy = Math.round(mTile.y * TILE_SIZE);
        const r = profile.range * TILE_SIZE;
        const imminent = progress > 0.8 || phase === 'active';
        const color = imminent ? '#fca5a5' : '#ef4444';

        ctx.save();
        ctx.globalAlpha = 0.10 + progress * 0.22;
        ctx.fillStyle = color;
        if (profile.telegraph === TELEGRAPH_CONE) {
          const a = Math.atan2(dirY, dirX);
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.arc(sx, sy, r, a - profile.arc, a + profile.arc);
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = imminent ? 0.95 : 0.45 + progress * 0.35;
          ctx.strokeStyle = color;
          ctx.lineWidth = 1;
          ctx.stroke();
        } else {
          ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha += 0.18;
          ctx.beginPath(); ctx.arc(sx, sy, r * progress, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = imminent ? 0.95 : 0.45 + progress * 0.35;
          ctx.strokeStyle = color;
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.restore();
        ctx.globalAlpha = 1;
      }

      // --- attacker: coils during the windup, snaps forward on the hit ---
      const mx = Math.round(mTile.x * TILE_SIZE - TILE_SIZE / 2);
      const my = Math.round(mTile.y * TILE_SIZE - TILE_SIZE / 2);
      ctx.save();
      if (phase === 'windup') {
        const k = progress;
        ctx.translate(mx + 8, my + 16);
        ctx.translate(-dirX * k * 2, 0);
        ctx.scale(1 + k * 0.14, 1 - k * 0.12);
        ctx.translate(-8, -16);
        sprites.drawMonster(ctx, 0, 0, monster, 'right', animFrame, false, false, false, false, false, false, 0, 0, 0);
      } else {
        ctx.translate(mx, my);
        sprites.drawMonster(ctx, 0, 0, monster, 'right', animFrame, false, phase === 'active', false, false, false, false, 0, 0, 0);
      }
      ctx.restore();

      // --- target: rolls clear right as the telegraph fills ---
      const dodging = phase === 'active' || (phase === 'windup' && progress > 0.82);
      const dodgeK = phase === 'active' ? 1 : Math.max(0, (progress - 0.82) / 0.18);
      const px = Math.round(pTile.x * TILE_SIZE - TILE_SIZE / 2 + dodgeK * TILE_SIZE * 2.1);
      const py = Math.round(pTile.y * TILE_SIZE - TILE_SIZE / 2 - dodgeK * TILE_SIZE * 0.5);
      ctx.save();
      ctx.globalAlpha = dodging ? 0.85 : 1;
      sprites.drawPlayer(ctx, px, py, playerClass, 'right', false, animFrame, false, false, false, false, false, 0);
      ctx.restore();
      ctx.globalAlpha = 1;

      if (!reduced) raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [floor, monster, playerClass, cols, rows]);

  return (
    // The canvas carries an intrinsic width; taking it out of flow keeps it from
    // setting a min-content floor that would push the layout wider than the
    // viewport on small screens.
    <div className={className} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        aria-hidden
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          objectFit: 'cover', imageRendering: 'pixelated', display: 'block',
        }}
      />
      {showLabel && (
        <span
          aria-hidden
          style={{
            position: 'absolute', left: 12, bottom: 10,
            fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
            color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
          }}
        >
          Gerçek zamanlı · oyunun kendi render&apos;ı
        </span>
      )}
    </div>
  );
}

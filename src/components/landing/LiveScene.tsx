'use client';

import { useEffect, useRef } from 'react';
import { SpriteRenderer } from '@/game/renderer/SpriteRenderer';
import {
  TILE_SIZE,
  TICK_RATE,
  ATTACK_PROFILES,
  TELEGRAPH_CONE,
  floorTheme,
  hazardForFloor,
  type TileType,
  type MonsterType,

  type LootType,
  type Direction,
} from '../../../shared/types';

export type ScenePhase = 'windup' | 'active' | 'recovery' | 'idle';

/**
 * A phase change, with how long the new phase will last.
 *
 * The page uses the duration to run its fill for exactly that long, so the bar
 * in the copy and the telegraph on the canvas are driven by one clock rather
 * than being two things that happen to look similar.
 */
export type PhaseEvent = { phase: ScenePhase; durationMs: number };

/**
 * A live dungeon scene, drawn with the game's own renderer.
 *
 * None of these are screenshots or mock-ups: tiles come from
 * SpriteRenderer.drawTile with the real per-floor palette and autotiling mask,
 * the characters and projectiles are the real sprites, and the telegraph scene
 * reads its durations straight out of ATTACK_PROFILES — the same table the
 * server runs combat from. If the combat tuning changes, the page changes with
 * it.
 *
 * Five scenes, because one repeated melee windup was the only thing the page
 * ever showed and it said the same sentence three times:
 *
 *   skirmish  — a warrior holding off three monsters; the hero moment
 *   telegraph — one attack, slowed down: windup → active → recovery
 *   volley    — a gargoyle trading shots with an archer across the room
 *   treasure  — a chest opening and its loot being collected
 *   descend   — reaching the stairs and the next floor's palette taking over
 */
export type SceneKind = 'skirmish' | 'telegraph' | 'volley' | 'treasure' | 'descend';

const MS_PER_TICK = 1000 / TICK_RATE;
const ANIM_MS = 125; // the game's 8fps sprite clock

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOut = (t: number) => 1 - (1 - t) * (1 - t) * (1 - t);
const easeIn = (t: number) => t * t;

/** Window [from,to) in ms mapped to 0..1; 0 before, 1 after. */
const span = (t: number, from: number, to: number) => clamp01((t - from) / (to - from));

type Stage = {
  ctx: CanvasRenderingContext2D;
  sprites: SpriteRenderer;
  tiles: TileType[][];
  cols: number;
  rows: number;
  animFrame: number;
  /** Scene-local time, ms, already wrapped into the scene's own duration. */
  t: number;
  floor: number;
};

/** Sprites are 16px and positioned by their top-left corner. */
const sx = (tileX: number) => Math.round(tileX * TILE_SIZE - TILE_SIZE / 2);
const sy = (tileY: number) => Math.round(tileY * TILE_SIZE - TILE_SIZE / 2);

/** A walled chamber with a couple of pillars, so autotiling has real corners. */
function buildChamber(cols: number, rows: number): TileType[][] {
  const tiles: TileType[][] = [];
  for (let y = 0; y < rows; y++) {
    const row: TileType[] = [];
    for (let x = 0; x < cols; x++) {
      row.push(y === 0 || y === rows - 1 || x === 0 || x === cols - 1 ? 'wall' : 'floor');
    }
    tiles.push(row);
  }
  const pillars = [[4, 3], [4, 4], [cols - 5, rows - 5], [cols - 5, rows - 4]];
  for (const [px, py] of pillars) {
    if (py > 0 && py < rows - 1 && px > 0 && px < cols - 1) tiles[py][px] = 'wall';
  }
  tiles[Math.floor(rows / 2)][0] = 'door';
  tiles[Math.floor(rows / 2)][cols - 1] = 'door';
  return tiles;
}

// ── shared bits of stagecraft ─────────────────────────────────────────────

/** A short-lived ring of sparks; used for impacts and pickups. */
function sparks(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, k: number, count: number, color: string, spread: number,
) {
  if (k <= 0 || k >= 1) return;
  ctx.save();
  ctx.globalAlpha = 1 - k;
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + i * 0.7;
    const d = easeOut(k) * spread;
    ctx.fillRect(Math.round(cx + Math.cos(a) * d), Math.round(cy + Math.sin(a) * d - k * 4), 1, 1);
  }
  ctx.restore();
}

/** The floor-level danger area, drawn the way GameRenderer draws it. */
function telegraphShape(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, radius: number, progress: number,
  cone: { dirX: number; dirY: number; arc: number } | null,
  imminent: boolean,
) {
  const color = imminent ? '#fca5a5' : '#ef4444';
  ctx.save();
  ctx.globalAlpha = 0.1 + progress * 0.22;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  if (cone) {
    const a = Math.atan2(cone.dirY, cone.dirX);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, a - cone.arc, a + cone.arc);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = imminent ? 0.95 : 0.45 + progress * 0.35;
    ctx.stroke();
  } else {
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha += 0.18;
    ctx.beginPath(); ctx.arc(cx, cy, radius * progress, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = imminent ? 0.95 : 0.45 + progress * 0.35;
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

/** A dying monster: tips over, fades, leaves a puff. */
function drawDeath(
  s: Stage, tileX: number, tileY: number, type: MonsterType, facing: Direction, k: number,
) {
  const { ctx, sprites } = s;
  ctx.save();
  ctx.globalAlpha = 1 - easeIn(k);
  ctx.translate(sx(tileX) + 8, sy(tileY) + 14);
  ctx.rotate((facing === 'left' ? -1 : 1) * k * 1.35);
  ctx.scale(1, 1 - k * 0.35);
  ctx.translate(-8, -14);
  sprites.drawMonster(ctx, 0, 0, type, facing, s.animFrame, k < 0.25);
  ctx.restore();
  ctx.globalAlpha = 1;
  sparks(ctx, sx(tileX) + 8, sy(tileY) + 8, k, 8, '#e9e9ed', 11);
}

/** Arc of a swung weapon, keyed to the attack's active frame. */
function drawSlash(ctx: CanvasRenderingContext2D, cx: number, cy: number, angle: number, k: number) {
  if (k <= 0 || k >= 1) return;
  ctx.save();
  ctx.globalAlpha = (1 - k) * 0.85;
  ctx.strokeStyle = '#f3f5fe';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 13 + k * 5, angle - 0.85 + k * 1.1, angle + 0.5 + k * 1.1);
  ctx.stroke();
  ctx.globalAlpha = (1 - k) * 0.4;
  ctx.strokeStyle = '#b5abfc';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, 10 + k * 5, angle - 0.85 + k * 1.1, angle + 0.5 + k * 1.1);
  ctx.stroke();
  ctx.restore();
  ctx.globalAlpha = 1;
}

// ── scene 1: skirmish — the hero moment ───────────────────────────────────

/** side: -1 enters from the left, +1 from the right. lane: 0..1 of room height. */
const SKIRMISH_FOES: { type: MonsterType; side: -1 | 1; lane: number; at: number }[] = [
  { type: 'skeleton', side: -1, lane: 0.30, at: 0 },
  { type: 'goblin', side: 1, lane: 0.70, at: 780 },
  { type: 'bat', side: -1, lane: 0.78, at: 1560 },
  { type: 'spider', side: 1, lane: 0.26, at: 2340 },
  { type: 'slime', side: -1, lane: 0.52, at: 3120 },
];
const FOE_TRAVEL = 1250;   // approach time
const FOE_STRIKE = 520;    // the warrior's swing, from contact
const FOE_FADE = 600;
// One foe's whole life, plus the last spawn, is the cycle. Anything longer left
// the frame empty for seconds at a time.
const SKIRMISH_DUR = 3120 + FOE_TRAVEL + FOE_STRIKE + FOE_FADE + 260;

function drawSkirmish(s: Stage) {
  const { ctx, sprites, cols, rows, t } = s;
  const heroX = cols * 0.5;
  const heroY = rows * 0.5;
  let heroFacing: Direction = 'right';
  let swingAngle = 0;
  let swingK = -1;

  for (const foe of SKIRMISH_FOES) {
    const local = t - foe.at;
    if (local < 0) continue;

    // Foes stop at arm's length, fanned out by lane so they never stack.
    const targetX = heroX + foe.side * 1.7;
    const targetY = lerp(rows * 0.5, rows * foe.lane, 0.55);
    const startX = foe.side < 0 ? 0.8 : cols - 1.8;
    const startY = rows * foe.lane;

    const approach = span(local, 0, FOE_TRAVEL);
    const x = lerp(startX, targetX, easeOut(approach));
    const y = lerp(startY, targetY, easeOut(approach));
    const facing: Direction = foe.side < 0 ? 'right' : 'left';

    const strike = span(local, FOE_TRAVEL, FOE_TRAVEL + FOE_STRIKE);
    const fade = span(local, FOE_TRAVEL + FOE_STRIKE, FOE_TRAVEL + FOE_STRIKE + FOE_FADE);

    // The warrior turns to whoever is currently being dealt with.
    if (approach > 0.55 && fade < 1) {
      heroFacing = foe.side < 0 ? 'left' : 'right';
      if (strike > 0 && strike < 1) {
        swingK = strike;
        swingAngle = foe.side < 0 ? Math.PI : 0;
      }
    }

    if (fade > 0) {
      if (fade < 1) drawDeath(s, x, y, foe.type, facing, fade);
      continue;
    }

    // Flinch on the hit frame.
    const hit = strike > 0.45 && strike < 0.7;
    ctx.save();
    if (hit) ctx.translate(foe.side * -2, 0);
    sprites.drawMonster(ctx, sx(x), sy(y), foe.type, facing, s.animFrame, hit);
    ctx.restore();
  }

  // Warrior, planted in the middle, swinging.
  const bob = Math.sin(t * 0.004) * 0.6;
  const hx = sx(heroX);
  const hy = sy(heroY) + Math.round(bob);
  const attacking = swingK > 0.2 && swingK < 0.6;
  sprites.drawPlayer(ctx, hx, hy, 'warrior', heroFacing, attacking, s.animFrame);
  if (swingK > 0) drawSlash(ctx, hx + 8, hy + 8, swingAngle, swingK);
}

// ── scene 2: telegraph — one attack, slowed down ──────────────────────────

function makeTelegraph(monster: MonsterType, cols: number, rows: number, timeScale = 1) {
  const profile = ATTACK_PROFILES[monster];
  // Slowed for the page.
  //
  // At real speed the active frame is 200ms — the hit is over before the eye
  // can find it, so the readout appeared to skip straight from wind-up to
  // recovery. The three phases keep their true proportions to each other; only
  // the clock is stretched, the way a replay is.
  const WINDUP = profile.windupTicks * MS_PER_TICK * timeScale;
  const ACTIVE = profile.activeTicks * MS_PER_TICK * timeScale;
  const RECOVER = profile.recoveryTicks * MS_PER_TICK * timeScale;
  // The pause between demonstrations is not part of the attack, so it does not
  // get stretched — that would just be dead air.
  const IDLE = 900;
  const duration = WINDUP + ACTIVE + RECOVER + IDLE;

  const mTile = { x: cols * 0.34, y: rows * 0.5 };
  // At range * 0.72 the two 1-tile sprites nearly touched and read as one blob.
  // Keep the target inside the telegraph but visibly separate.
  const pTile = { x: mTile.x + Math.max(2.2, profile.range * 0.95), y: rows * 0.5 };

  const draw = (s: Stage, onPhase?: (p: ScenePhase, durationMs: number) => void) => {
    const { ctx, sprites, t } = s;
    let phase: ScenePhase;
    let progress = 0;
    if (t < WINDUP) { phase = 'windup'; progress = t / WINDUP; }
    else if (t < WINDUP + ACTIVE) { phase = 'active'; progress = 1; }
    else if (t < WINDUP + ACTIVE + RECOVER) { phase = 'recovery'; }
    else { phase = 'idle'; }
    // The duration of the phase the scene is currently in.
    onPhase?.(phase, phase === 'windup' ? WINDUP : phase === 'active' ? ACTIVE : phase === 'recovery' ? RECOVER : IDLE);

    if (phase === 'windup' || phase === 'active') {
      telegraphShape(
        ctx,
        Math.round(mTile.x * TILE_SIZE), Math.round(mTile.y * TILE_SIZE),
        profile.range * TILE_SIZE, progress,
        profile.telegraph === TELEGRAPH_CONE ? { dirX: 1, dirY: 0, arc: profile.arc } : null,
        progress > 0.8 || phase === 'active',
      );
    }

    // Attacker: coils through the windup, snaps forward on the hit.
    const mx = sx(mTile.x);
    const my = sy(mTile.y);
    ctx.save();
    if (phase === 'windup') {
      const k = progress;
      ctx.translate(mx + 8, my + 16);
      ctx.translate(-k * 2, 0);
      ctx.scale(1 + k * 0.14, 1 - k * 0.12);
      ctx.translate(-8, -16);
      sprites.drawMonster(ctx, 0, 0, monster, 'right', s.animFrame);
    } else {
      sprites.drawMonster(ctx, mx, my, monster, 'right', s.animFrame, false, phase === 'active');
    }
    ctx.restore();

    // Target: rolls clear right as the telegraph fills.
    const dodging = phase === 'active' || (phase === 'windup' && progress > 0.82);
    const dodgeK = phase === 'active' ? 1 : Math.max(0, (progress - 0.82) / 0.18);
    const px = sx(pTile.x) + Math.round(dodgeK * TILE_SIZE * 2.1);
    const py = sy(pTile.y) - Math.round(dodgeK * TILE_SIZE * 0.5);
    ctx.save();
    ctx.globalAlpha = dodging ? 0.85 : 1;
    sprites.drawPlayer(ctx, px, py, 'warrior', 'right', false, s.animFrame);
    ctx.restore();
    ctx.globalAlpha = 1;
  };

  return { duration, draw, holdAt: WINDUP * 0.85 };
}

// ── scene 3: volley — ranged trade ────────────────────────────────────────

const VOLLEY_DUR = 5600;
/** Launch time, and which way it flies. */
const SHOTS: { at: number; dir: 1 | -1; type: 'stone_shard' | 'arrow' }[] = [
  { at: 700, dir: 1, type: 'stone_shard' },
  { at: 1050, dir: 1, type: 'stone_shard' },
  { at: 1400, dir: 1, type: 'stone_shard' },
  { at: 2500, dir: -1, type: 'arrow' },
  { at: 2850, dir: -1, type: 'arrow' },
  { at: 3200, dir: -1, type: 'arrow' },
];
const SHOT_FLIGHT = 900;

function drawVolley(s: Stage) {
  const { ctx, sprites, cols, rows, t } = s;
  const gx = cols * 0.22;
  const gy = rows * 0.5;
  const ax = cols * 0.78;

  // The archer sidesteps; it is what selling "you can move out of the way" needs.
  const strafe = Math.sin(t * 0.0021) * (rows * 0.22);
  const ay = rows * 0.5 + strafe;

  // Gargoyle winds up before its burst, and flinches when arrows land.
  const gWind = span(t, 260, 700);
  const gargoyleFiring = t > 260 && t < 1600;
  const hitFlash = (t > 3400 && t < 3520) || (t > 3750 && t < 3870) || (t > 4100 && t < 4220);

  for (const shot of SHOTS) {
    const k = span(t, shot.at, shot.at + SHOT_FLIGHT);
    if (k <= 0 || k >= 1) {
      // Impact burst at the far end.
      if (k >= 1 && t < shot.at + SHOT_FLIGHT + 260) {
        const ik = (t - shot.at - SHOT_FLIGHT) / 260;
        const ix = shot.dir > 0 ? ax : gx;
        const iy = shot.dir > 0 ? ay : gy;
        sparks(ctx, sx(ix) + 8, sy(iy) + 8, ik, 7,
          shot.dir > 0 ? '#cfd3e5' : '#b5abfc', 10);
      }
      continue;
    }
    const fromX = shot.dir > 0 ? gx : ax;
    const toX = shot.dir > 0 ? ax : gx;
    const fromY = shot.dir > 0 ? gy : ay;
    const toY = shot.dir > 0 ? ay : gy;
    const px = lerp(fromX, toX, k);
    const py = lerp(fromY, toY, k);
    const vx = (toX - fromX) * shot.dir;
    sprites.drawProjectile(
      ctx, sx(px) + 8, sy(py) + 8, shot.type, s.animFrame,
      vx, (toY - fromY) * 0.1, shot.dir, 0,
    );
  }

  // Charge glow before the gargoyle's burst.
  if (gWind > 0 && gWind < 1) {
    ctx.save();
    ctx.globalAlpha = gWind * 0.5;
    ctx.fillStyle = '#fca5a5';
    ctx.beginPath();
    ctx.arc(sx(gx) + 8, sy(gy) + 8, 4 + gWind * 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  sprites.drawMonster(ctx, sx(gx), sy(gy), 'gargoyle', 'right', s.animFrame, hitFlash, gargoyleFiring);

  const archerFiring = t > 2400 && t < 3400;
  sprites.drawPlayer(ctx, sx(ax), sy(ay), 'archer', 'left', archerFiring, s.animFrame);
}

// ── scene 4: treasure — a chest, and what comes out ───────────────────────

const TREASURE_DUR = 6400;
const CHEST_POPS: { type: LootType; angle: number }[] = [
  { type: 'gold', angle: -2.5 },
  { type: 'health_potion', angle: -1.9 },
  { type: 'mana_potion', angle: -1.2 },
  { type: 'gold', angle: -0.6 },
];
const WALK_END = 1700;
const OPEN_END = 2300;
const POP_END = 3500;
const GRAB_END = 5000;

function drawTreasure(s: Stage) {
  const { ctx, sprites, cols, rows, t } = s;
  const chestX = Math.floor(cols * 0.62);
  const chestY = Math.floor(rows / 2);

  const cx = chestX * TILE_SIZE + TILE_SIZE / 2;
  const cy = chestY * TILE_SIZE + TILE_SIZE / 2;

  const walk = span(t, 0, WALK_END);
  const px = lerp(cols * 0.2, chestX - 1.05, easeOut(walk));
  const py = rows * 0.5;

  const open = span(t, WALK_END, OPEN_END);

  // Light spilling out of the lid.
  if (open > 0) {
    const glow = t < POP_END ? open : Math.max(0.25, 1 - span(t, POP_END, GRAB_END));
    ctx.save();
    ctx.globalAlpha = glow * 0.55;
    const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, 26);
    g.addColorStop(0, '#fde68a');
    g.addColorStop(1, 'rgba(253, 230, 138, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - 26, cy - 26, 52, 52);
    ctx.restore();
    ctx.globalAlpha = 1;
    sparks(ctx, cx, cy, open, 10, '#fde68a', 14);
  }

  // Loot arcs out, rests, then flies to the player.
  for (let i = 0; i < CHEST_POPS.length; i++) {
    const pop = CHEST_POPS[i];
    const popStart = OPEN_END + i * 90;
    const k = span(t, popStart, popStart + 620);
    if (k <= 0) continue;

    const restX = cx + Math.cos(pop.angle) * 26;
    const restY = cy + Math.sin(pop.angle) * 15 + 8;

    const grabStart = GRAB_END - 900 + i * 110;
    const grab = span(t, grabStart, grabStart + 420);
    if (grab >= 1) continue;

    let lx: number;
    let ly: number;
    if (grab > 0) {
      // Collected: curves toward the player and shrinks out.
      lx = lerp(restX, px * TILE_SIZE, easeIn(grab));
      ly = lerp(restY, py * TILE_SIZE, easeIn(grab)) - Math.sin(grab * Math.PI) * 10;
    } else {
      // Tossed out on a parabola.
      lx = lerp(cx, restX, easeOut(k));
      ly = lerp(cy, restY, k) - Math.sin(k * Math.PI) * 14;
    }

    ctx.save();
    if (grab > 0) {
      ctx.globalAlpha = 1 - grab;
      ctx.translate(lx, ly);
      ctx.scale(1 - grab * 0.5, 1 - grab * 0.5);
      ctx.translate(-lx, -ly);
    }
    sprites.drawLoot(ctx, Math.round(lx - 8), Math.round(ly - 8), pop.type, s.animFrame);
    ctx.restore();
    ctx.globalAlpha = 1;

    if (grab > 0.75) sparks(ctx, px * TILE_SIZE, py * TILE_SIZE, (grab - 0.75) / 0.25, 6, '#fde68a', 9);
  }

  const walking = walk > 0 && walk < 1;
  sprites.drawPlayer(ctx, sx(px), sy(py), 'mage', 'right', false, walking ? s.animFrame : 0);
}

// ── scene 5: descend — the stairs and the next palette ────────────────────

const DESCEND_DUR = 6000;
const DESCEND_FLOORS = [6, 7, 8, 9];
const ARRIVE = 2600;
const FLASH_END = 3200;
const SETTLE = 4200;

function drawDescend(s: Stage, cycleIndex: number) {
  const { ctx, sprites, cols, rows, t } = s;
  const stairX = Math.floor(cols * 0.72);
  const stairY = Math.floor(rows / 2);

  const arriving = span(t, 0, ARRIVE);
  const flash = span(t, ARRIVE, FLASH_END);
  const settle = span(t, FLASH_END, SETTLE);

  // After the flash the hero is on the next floor, entering from the left.
  const onNextFloor = t >= FLASH_END;
  const px = onNextFloor
    ? lerp(1.2, cols * 0.3, easeOut(settle))
    : lerp(cols * 0.18, stairX, easeOut(arriving));
  const py = rows * 0.5;

  // A column of light over the stairs as the hero reaches them.
  if (arriving > 0.7 && !onNextFloor) {
    const k = (arriving - 0.7) / 0.3;
    ctx.save();
    ctx.globalAlpha = k * 0.45;
    const g = ctx.createLinearGradient(0, 0, 0, stairY * TILE_SIZE + TILE_SIZE);
    g.addColorStop(0, 'rgba(181, 171, 252, 0)');
    g.addColorStop(1, '#b5abfc');
    ctx.fillStyle = g;
    ctx.fillRect(stairX * TILE_SIZE - 4, 0, TILE_SIZE + 8, stairY * TILE_SIZE + TILE_SIZE);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  const sinking = onNextFloor ? 0 : Math.max(0, (arriving - 0.88) / 0.12);
  if (sinking < 1) {
    ctx.save();
    ctx.globalAlpha = 1 - sinking;
    ctx.beginPath();
    ctx.rect(0, 0, cols * TILE_SIZE, (stairY + 1) * TILE_SIZE - sinking * 10);
    ctx.clip();
    sprites.drawPlayer(ctx, sx(px), sy(py), 'warrior', 'right', false, s.animFrame);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // The transition itself: a wash of light that hands over to the new palette.
  if (flash > 0 && flash < 1) {
    ctx.save();
    ctx.globalAlpha = Math.sin(flash * Math.PI) * 0.92;
    ctx.fillStyle = '#e9e9ed';
    ctx.fillRect(0, 0, cols * TILE_SIZE, rows * TILE_SIZE);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // Floor name, in the page's own voice, riding the settle.
  if (onNextFloor && settle < 1) {
    const next = DESCEND_FLOORS[(cycleIndex + 1) % DESCEND_FLOORS.length];
    const theme = floorTheme(next);
    ctx.save();
    ctx.globalAlpha = Math.sin(clamp01(settle * 1.6) * Math.PI) * 0.9;
    ctx.fillStyle = '#e9e9ed';
    ctx.font = '600 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      `KAT ${next} — ${theme.name.toLocaleUpperCase('tr-TR')}`,
      Math.round(cols * TILE_SIZE * 0.5), Math.round(rows * TILE_SIZE * 0.28),
    );
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

/**
 * A fixed pool shape for the floors that carry one. Uses the same shared table
 * the dungeon generator does, so the page never advertises lava on a floor that
 * does not have it.
 */
function stampHazard(tiles: TileType[][], cols: number, rows: number, floor: number): void {
  const spec = hazardForFloor(floor);
  if (!spec) return;
  const cx = Math.floor(cols * 0.42);
  const cy = Math.floor(rows * 0.62);
  // A blob, widest through the middle, so the autotiler has real edges to find.
  const shape = [
    [0, -1], [1, -1],
    [-1, 0], [0, 0], [1, 0], [2, 0],
    [-1, 1], [0, 1], [1, 1], [2, 1], [3, 1],
    [0, 2], [1, 2], [2, 2],
  ];
  for (const [dx, dy] of shape) {
    const x = cx + dx;
    const y = cy + dy;
    if (x > 1 && y > 1 && x < cols - 2 && y < rows - 2 && tiles[y][x] === 'floor') {
      tiles[y][x] = spec.type;
    }
  }
}

// ── component ─────────────────────────────────────────────────────────────

export function LiveScene({
  scene = 'telegraph',
  floor = 7,
  monster = 'dark_knight',
  cols = 30,
  rows = 17,
  onPhase,
  className = '',
  showLabel = true,
  label,
  timeScale = 1,
}: {
  scene?: SceneKind;
  floor?: number;
  monster?: MonsterType;
  cols?: number;
  rows?: number;
  onPhase?: (e: PhaseEvent) => void;
  className?: string;
  showLabel?: boolean;
  label?: string;
  /** Stretches the telegraph scene's attack phases so they can be read. */
  timeScale?: number;
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
    const baseTiles = buildChamber(cols, rows);

    const telegraph = scene === 'telegraph' ? makeTelegraph(monster, cols, rows, timeScale) : null;
    const duration =
      scene === 'telegraph' ? telegraph!.duration
      : scene === 'skirmish' ? SKIRMISH_DUR
      : scene === 'volley' ? VOLLEY_DUR
      : scene === 'treasure' ? TREASURE_DUR
      : DESCEND_DUR;

    // Reduced motion holds the single frame that best explains the scene.
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const holdAt =
      scene === 'telegraph' ? telegraph!.holdAt
      : scene === 'skirmish' ? 1400
      : scene === 'volley' ? 1200
      : scene === 'treasure' ? 3000
      : 1800;

    // Only paint while the scene is actually on screen. Three canvases running
    // a full redraw each frame is a real cost on a laptop, and most of the time
    // at least two of them are scrolled out of view.
    let visible = true;
    const io = new IntersectionObserver(
      ([e]) => { visible = e.isIntersecting; },
      { rootMargin: '120px' },
    );
    io.observe(canvas);

    const stage: Stage = {
      ctx, sprites, tiles: baseTiles, cols, rows, animFrame: 0, t: 0, floor,
    };

    let raf = 0;
    let start = 0;
    let prev = 0;
    let animAcc = 0;
    let lastPhase: ScenePhase | null = null;
    let lastThemeFloor = -1;

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (!start) { start = now; prev = now; }
      const dt = Math.min(64, now - prev);
      prev = now;
      if (!visible) return;

      animAcc += dt;
      while (animAcc >= ANIM_MS) { animAcc -= ANIM_MS; stage.animFrame++; }

      const elapsed = now - start;
      const cycleIndex = Math.floor(elapsed / duration);
      stage.t = reduced ? holdAt : elapsed % duration;

      // Descend walks the palette forward a floor each cycle; everything else
      // stays on the floor it was given.
      const activeFloor = scene === 'descend'
        ? DESCEND_FLOORS[(cycleIndex + (stage.t >= FLASH_END ? 1 : 0)) % DESCEND_FLOORS.length]
        : floor;
      if (activeFloor !== lastThemeFloor) {
        sprites.setFloorTheme(activeFloor);
        lastThemeFloor = activeFloor;
        // The descend scene walks through floors; last floor's pool must not
        // survive into the next one's palette.
        for (let y = 1; y < rows - 1; y++) {
          for (let x = 1; x < cols - 1; x++) {
            if (baseTiles[y][x] === 'lava' || baseTiles[y][x] === 'water') baseTiles[y][x] = 'floor';
          }
        }
      }

      // Hazard pools, but only in the scene that tours the floors. The other
      // scenes each demonstrate one idea, and a pool through the middle of them
      // is clutter competing with the thing being shown.
      if (scene === 'descend') stampHazard(baseTiles, cols, rows, activeFloor);

      // Props are written into the grid before the tile pass so the chest and
      // the stairs are drawn as real tiles with the floor's own palette.
      if (scene === 'treasure') baseTiles[Math.floor(rows / 2)][Math.floor(cols * 0.62)] = 'chest';
      else if (scene === 'descend') baseTiles[Math.floor(rows / 2)][Math.floor(cols * 0.72)] = 'stairs';

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          sprites.drawTile(ctx, x * TILE_SIZE, y * TILE_SIZE, baseTiles[y][x], true, x, y, baseTiles, cols, rows, stage.animFrame);
        }
      }

      // Props were resolved before the tile pass so the grid is correct; the
      // actors are drawn after it so they sit on top.
      if (scene === 'skirmish') drawSkirmish(stage);
      else if (scene === 'volley') drawVolley(stage);
      else if (scene === 'treasure') drawTreasure(stage);
      else if (scene === 'descend') drawDescend(stage, cycleIndex);
      else if (telegraph) {
        telegraph.draw(stage, (p, d) => {
          if (p !== lastPhase) { lastPhase = p; onPhaseRef.current?.({ phase: p, durationMs: d }); }
        });
      }
    };

    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); io.disconnect(); };
  }, [scene, floor, monster, cols, rows, timeScale]);

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
          {label ?? 'Gerçek zamanlı · oyunun kendi render’ı'}
        </span>
      )}
    </div>
  );
}

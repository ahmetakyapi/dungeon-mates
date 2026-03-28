// ==========================================
// Dungeon Mates — Procedural Sprite Renderer
// Detailed pixel-art drawing with off-screen cache
// ==========================================

import type { Direction, PlayerClass, MonsterType, TileType, LootType } from '../../../shared/types';
import { CLASS_STATS, MONSTER_STATS, LOOT_TABLE, TILE_SIZE } from '../../../shared/types';

// --- Color utilities ---
const hexToRgb = (hex: string): [number, number, number] => {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
};

const darken = (hex: string, amount: number): string => {
  const [r, g, b] = hexToRgb(hex);
  const f = 1 - amount;
  return `rgb(${Math.floor(r * f)},${Math.floor(g * f)},${Math.floor(b * f)})`;
};

const lighten = (hex: string, amount: number): string => {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.min(255, Math.floor(r + (255 - r) * amount))},${Math.min(255, Math.floor(g + (255 - g) * amount))},${Math.min(255, Math.floor(b + (255 - b) * amount))})`;
};

// Pixel helper: draws a filled rect at pixel-art scale
const px = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void => {
  ctx.fillStyle = color;
  ctx.fillRect(Math.floor(x), Math.floor(y), w, h);
};

// Simple position-based hash for tile variation
const tileHash = (tx: number, ty: number): number => {
  let h = tx * 374761393 + ty * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return (h ^ (h >> 16)) & 0x7fffffff;
};

// --- Off-screen sprite cache ---
type CacheKey = string;
const spriteCache = new Map<CacheKey, HTMLCanvasElement>();

const getCachedSprite = (
  key: CacheKey,
  width: number,
  height: number,
  drawFn: (ctx: CanvasRenderingContext2D) => void,
): HTMLCanvasElement => {
  let cached = spriteCache.get(key);
  if (cached) return cached;

  cached = document.createElement('canvas');
  cached.width = width;
  cached.height = height;
  const ctx = cached.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  drawFn(ctx);
  spriteCache.set(key, cached);
  return cached;
};

// --- Walk animation offsets ---
const WALK_OFFSETS = [0, -1, 0, 1] as const;

// --- Death animation state tracking ---
type DeathAnim = {
  entityId: string;
  x: number;
  y: number;
  color: string;
  frame: number; // 0-12: 3 red flashes (6 frames) + fade out (7 frames)
  type: 'player' | 'monster';
  spriteKey: string;
};

export class SpriteRenderer {
  private readonly deathAnims: DeathAnim[] = [];
  private readonly hitFlashTimers: Map<string, number> = new Map();

  /** Register a hit flash for an entity (2 frames = ~0.25s at 8fps anim) */
  registerHitFlash(entityId: string): void {
    this.hitFlashTimers.set(entityId, 2);
  }

  /** Tick down flash timers (call once per anim frame) */
  tickFlashTimers(): void {
    for (const [id, frames] of this.hitFlashTimers) {
      if (frames <= 1) {
        this.hitFlashTimers.delete(id);
      } else {
        this.hitFlashTimers.set(id, frames - 1);
      }
    }
  }

  /** Check if entity should be flashing white */
  isFlashing(entityId: string): boolean {
    return this.hitFlashTimers.has(entityId);
  }

  // ===== PLAYER SPRITES =====

  /** Draw a player character (16x16 pixel art) — detailed per class */
  drawPlayer(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    playerClass: PlayerClass,
    facing: Direction,
    attacking: boolean,
    frame: number,
    flashWhite = false,
    abilityActive = false,
  ): void {
    // Shadow beneath
    ctx.globalAlpha = 0.3;
    px(ctx, x + 3, y + 14, 10, 2, '#000000');
    ctx.globalAlpha = 1;

    if (flashWhite) {
      this.drawPlayerWhiteFlash(ctx, x, y, playerClass, facing, attacking, frame);
      return;
    }

    switch (playerClass) {
      case 'warrior':
        this.drawWarrior(ctx, x, y, facing, attacking, frame);
        break;
      case 'mage':
        this.drawMage(ctx, x, y, facing, attacking, frame);
        break;
      case 'archer':
        this.drawArcher(ctx, x, y, facing, attacking, frame);
        break;
    }

    // Shield glow overlay for warrior ability
    if (abilityActive && playerClass === 'warrior') {
      const cx = x + 8;
      const cy = y + 8;
      const pulse = 1 + Math.sin(frame * 0.8) * 0.15;
      const radius = 10 * pulse;
      ctx.globalAlpha = 0.2;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = '#22d3ee';
      ctx.fill();
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.7, 0, Math.PI * 2);
      ctx.fillStyle = '#67e8f9';
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  private drawPlayerWhiteFlash(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    playerClass: PlayerClass,
    facing: Direction,
    attacking: boolean,
    frame: number,
  ): void {
    // Draw entire player silhouette in white
    const walkY = WALK_OFFSETS[frame % 4];
    const legOff = frame % 2;
    // Head
    px(ctx, x + 5, y + 1, 6, 5, '#ffffff');
    // Body
    px(ctx, x + 4, y + 6 + walkY, 8, 5, '#ffffff');
    // Arms
    px(ctx, x + 2, y + 6 + walkY, 2, 5, '#ffffff');
    px(ctx, x + 12, y + 6 + walkY, 2, 5, '#ffffff');
    // Legs
    px(ctx, x + 5, y + 11, 2, 3 + legOff, '#ffffff');
    px(ctx, x + 9, y + 11, 2, 3 - legOff, '#ffffff');
    // Outline
    this.drawOutline(ctx, x, y, 16, 16, '#ffffff');
  }

  private drawWarrior(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    facing: Direction,
    attacking: boolean,
    frame: number,
  ): void {
    const walkY = WALK_OFFSETS[frame % 4];
    const legOff = frame % 2;
    const isHoriz = facing === 'left' || facing === 'right';
    const facingRight = facing === 'right';
    const facingUp = facing === 'up';

    // Steel boots
    px(ctx, x + 4, y + 13 + legOff, 3, 2, '#6b7280');
    px(ctx, x + 9, y + 13 - legOff, 3, 2, '#6b7280');

    // Legs (dark armor)
    px(ctx, x + 5, y + 11, 2, 3 + legOff, '#991b1b');
    px(ctx, x + 9, y + 11, 2, 3 - legOff, '#991b1b');

    // Red cape flowing behind
    if (!facingUp) {
      const capeWave = Math.sin(frame * 0.8) * 1;
      px(ctx, x + 5, y + 7 + walkY, 6, 5, '#b91c1c');
      px(ctx, x + 4 + capeWave, y + 10 + walkY, 8, 2, '#991b1b');
    }

    // Body — full plate armor
    px(ctx, x + 4, y + 6 + walkY, 8, 5, '#9ca3af'); // steel body
    px(ctx, x + 5, y + 6 + walkY, 6, 1, '#d1d5db'); // chest highlight
    px(ctx, x + 6, y + 8 + walkY, 4, 1, '#fbbf24'); // gold belt

    // Shield on left arm
    const shieldSide = facingRight ? -1 : 1;
    if (isHoriz) {
      const sx2 = facingRight ? x + 1 : x + 12;
      px(ctx, sx2, y + 5 + walkY, 3, 6, '#6b7280');
      px(ctx, sx2, y + 6 + walkY, 3, 4, '#3b82f6');
      px(ctx, sx2 + 1, y + 7 + walkY, 1, 2, '#fbbf24'); // shield emblem
    } else {
      px(ctx, x + 2, y + 6 + walkY, 3, 5, '#6b7280');
      px(ctx, x + 2, y + 7 + walkY, 3, 3, '#3b82f6');
    }

    // Right arm (sword arm)
    const armX = facingRight ? x + 12 : x + 2;
    if (!isHoriz) {
      px(ctx, x + 12, y + 6 + walkY, 2, 5, '#9ca3af');
    } else {
      const swordArmX = facingRight ? x + 12 : x + 2;
      px(ctx, swordArmX, y + 6 + walkY, 2, 5, '#9ca3af');
    }

    // Sword
    if (attacking) {
      // Attack: horizontal slash with motion blur trail
      const slashDir = facingRight ? 1 : -1;
      if (isHoriz) {
        // Horizontal slash
        const bladeX = facingRight ? x + 14 : x - 6;
        px(ctx, bladeX, y + 4 + walkY, 6, 1, '#d1d5db'); // blade
        px(ctx, bladeX, y + 5 + walkY, 6, 1, '#e5e7eb');
        // Motion trail
        ctx.globalAlpha = 0.4;
        px(ctx, bladeX - slashDir * 2, y + 3 + walkY, 8, 3, '#ffffff');
        ctx.globalAlpha = 0.2;
        px(ctx, bladeX - slashDir * 4, y + 2 + walkY, 10, 5, '#ffffff');
        ctx.globalAlpha = 1;
      } else {
        // Vertical slash
        const bladeY = facingUp ? y - 4 : y + 14;
        px(ctx, x + 10, bladeY, 1, 6, '#d1d5db');
        px(ctx, x + 11, bladeY, 1, 6, '#e5e7eb');
        ctx.globalAlpha = 0.3;
        px(ctx, x + 8, bladeY, 5, 6, '#ffffff');
        ctx.globalAlpha = 1;
      }
      px(ctx, x + 11, y + 10 + walkY, 2, 2, '#78350f'); // handle always visible
    } else {
      // Idle: sword held down
      px(ctx, x + 12, y + 4 + walkY, 1, 7, '#9ca3af'); // blade
      px(ctx, x + 13, y + 4 + walkY, 1, 7, '#d1d5db'); // blade highlight
      px(ctx, x + 12, y + 10 + walkY, 2, 2, '#78350f'); // handle
    }

    // Head
    px(ctx, x + 5, y + 2, 6, 4, '#fcd5b4'); // face
    // Horned helmet
    px(ctx, x + 4, y + 1, 8, 2, '#6b7280'); // helmet base
    px(ctx, x + 5, y + 0, 6, 1, '#9ca3af'); // helmet top
    px(ctx, x + 3, y - 1, 2, 3, '#fbbf24'); // left horn
    px(ctx, x + 11, y - 1, 2, 3, '#fbbf24'); // right horn

    // Face details
    if (facing !== 'up') {
      px(ctx, x + 6, y + 3, 1, 1, '#1a1a2e'); // left eye
      px(ctx, x + 9, y + 3, 1, 1, '#1a1a2e'); // right eye
    }

    // Shoulder pads (gold trim)
    px(ctx, x + 3, y + 5 + walkY, 2, 2, '#fbbf24');
    px(ctx, x + 11, y + 5 + walkY, 2, 2, '#fbbf24');

    // 1px black outline
    this.drawSpriteOutline(ctx, x, y);
  }

  private drawMage(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    facing: Direction,
    attacking: boolean,
    frame: number,
  ): void {
    const walkY = WALK_OFFSETS[frame % 4];
    const breathe = Math.sin(frame * 0.3) * 0.5;
    const isHoriz = facing === 'left' || facing === 'right';
    const facingRight = facing === 'right';
    const facingUp = facing === 'up';

    // Flowing purple robe (long, covers legs partially)
    px(ctx, x + 3, y + 7 + walkY, 10, 6, '#7c3aed'); // main robe
    px(ctx, x + 2, y + 10 + walkY, 12, 3, '#6d28d9'); // robe bottom (flowing)
    px(ctx, x + 4, y + 13, 3, 2, '#5b21b6'); // left foot peeks out
    px(ctx, x + 9, y + 13, 3, 2, '#5b21b6'); // right foot

    // Runic patterns on robe
    px(ctx, x + 5, y + 9 + walkY, 1, 1, '#c4b5fd');
    px(ctx, x + 7, y + 10 + walkY, 1, 1, '#c4b5fd');
    px(ctx, x + 10, y + 9 + walkY, 1, 1, '#c4b5fd');

    // Body
    px(ctx, x + 4, y + 5 + walkY, 8, 3, '#8b5cf6'); // upper robe
    px(ctx, x + 5, y + 5 + walkY, 6, 1, '#a78bfa'); // collar highlight

    // Arms (robe sleeves)
    px(ctx, x + 2, y + 6 + walkY, 2, 4, '#7c3aed');
    px(ctx, x + 12, y + 6 + walkY, 2, 4, '#7c3aed');

    // Staff with glowing crystal
    const staffX = facingRight ? x + 13 : x + 1;
    if (attacking) {
      // Staff raised, magic circle beneath
      px(ctx, staffX, y - 2, 1, 14, '#78350f'); // staff
      px(ctx, staffX - 1, y - 3, 3, 3, '#a78bfa'); // crystal
      // Glowing crystal core
      px(ctx, staffX, y - 2, 1, 1, '#ffffff');
      // Magic circle beneath player
      ctx.globalAlpha = 0.4 + Math.sin(frame * 0.5) * 0.2;
      px(ctx, x + 1, y + 13, 14, 1, '#a78bfa');
      px(ctx, x + 2, y + 14, 12, 1, '#8b5cf6');
      px(ctx, x + 0, y + 12, 1, 2, '#a78bfa');
      px(ctx, x + 15, y + 12, 1, 2, '#a78bfa');
      ctx.globalAlpha = 1;
    } else {
      px(ctx, staffX, y + 1, 1, 12, '#78350f'); // staff
      px(ctx, staffX - 1, y + 0, 3, 2, '#a78bfa'); // crystal
      px(ctx, staffX, y + 0, 1, 1, '#ffffff'); // glow
    }

    // White beard
    if (facing !== 'up') {
      px(ctx, x + 6, y + 5, 4, 2, '#e5e7eb');
      px(ctx, x + 7, y + 6, 2, 1, '#d1d5db');
    }

    // Head
    px(ctx, x + 5, y + 2, 6, 4, '#fcd5b4');

    // Glowing eyes
    if (facing !== 'up') {
      px(ctx, x + 6, y + 3, 1, 1, '#c4b5fd'); // left eye (glowing)
      px(ctx, x + 9, y + 3, 1, 1, '#c4b5fd'); // right eye
    }

    // Pointed wizard hat with gem
    px(ctx, x + 4, y + 1, 8, 2, '#7c3aed'); // brim
    px(ctx, x + 5, y + 0, 6, 1, '#6d28d9');
    px(ctx, x + 6, y - 1, 4, 1, '#5b21b6');
    px(ctx, x + 7, y - 2, 2, 1, '#4c1d95');
    // Gem on hat
    px(ctx, x + 7, y + 0, 2, 1, '#fbbf24');

    this.drawSpriteOutline(ctx, x, y);
  }

  private drawArcher(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    facing: Direction,
    attacking: boolean,
    frame: number,
  ): void {
    const walkY = WALK_OFFSETS[frame % 4];
    const legOff = frame % 2;
    const isHoriz = facing === 'left' || facing === 'right';
    const facingRight = facing === 'right';
    const facingUp = facing === 'up';

    // Legs
    px(ctx, x + 5, y + 11, 2, 3 + legOff, '#374151'); // dark pants
    px(ctx, x + 9, y + 11, 2, 3 - legOff, '#374151');

    // Boots
    px(ctx, x + 4, y + 13 + legOff, 3, 2, '#78350f');
    px(ctx, x + 9, y + 13 - legOff, 3, 2, '#78350f');

    // Leather armor body
    px(ctx, x + 4, y + 6 + walkY, 8, 5, '#854d0e'); // torso
    px(ctx, x + 5, y + 6 + walkY, 6, 1, '#a16207'); // chest highlight
    px(ctx, x + 6, y + 8 + walkY, 4, 1, '#713f12'); // belt

    // Green hooded cloak
    px(ctx, x + 3, y + 4 + walkY, 10, 4, '#15803d'); // cloak body
    px(ctx, x + 3, y + 8 + walkY, 2, 4, '#166534'); // cloak left drape
    px(ctx, x + 11, y + 8 + walkY, 2, 4, '#166534'); // cloak right drape

    // Arms with bracers
    px(ctx, x + 2, y + 6 + walkY, 2, 4, '#854d0e'); // left arm
    px(ctx, x + 2, y + 9 + walkY, 2, 1, '#713f12'); // left bracer
    px(ctx, x + 12, y + 6 + walkY, 2, 4, '#854d0e'); // right arm
    px(ctx, x + 12, y + 9 + walkY, 2, 1, '#713f12'); // right bracer

    // Quiver on back (arrows visible)
    if (!facingUp) {
      px(ctx, x + 10, y + 3 + walkY, 3, 6, '#78350f'); // quiver
      px(ctx, x + 10, y + 2 + walkY, 1, 1, '#9ca3af'); // arrow tip 1
      px(ctx, x + 11, y + 1 + walkY, 1, 1, '#9ca3af'); // arrow tip 2
      px(ctx, x + 12, y + 2 + walkY, 1, 1, '#9ca3af'); // arrow tip 3
    }

    // Bow in left hand
    const bowX = facingRight ? x + 14 : x + 0;
    if (attacking) {
      // Draw and release arrow pose
      px(ctx, bowX, y + 3 + walkY, 1, 8, '#78350f'); // bow stave
      px(ctx, bowX + (facingRight ? -1 : 1), y + 3 + walkY, 1, 1, '#78350f'); // bow curve top
      px(ctx, bowX + (facingRight ? -1 : 1), y + 10 + walkY, 1, 1, '#78350f'); // bow curve bottom
      // Bowstring pulled back
      const stringX = facingRight ? bowX - 2 : bowX + 2;
      px(ctx, stringX, y + 4 + walkY, 1, 6, '#fbbf24');
      // Arrow being released
      const arrowDir = facingRight ? 1 : -1;
      px(ctx, bowX + arrowDir * 2, y + 7 + walkY, 4, 1, '#d1d5db'); // shaft
      px(ctx, bowX + arrowDir * 5, y + 6 + walkY, 1, 3, '#9ca3af'); // arrowhead
    } else {
      // Bow at rest
      px(ctx, bowX, y + 4 + walkY, 1, 7, '#78350f');
      px(ctx, bowX + (facingRight ? 1 : -1), y + 4 + walkY, 1, 1, '#78350f');
      px(ctx, bowX + (facingRight ? 1 : -1), y + 10 + walkY, 1, 1, '#78350f');
      px(ctx, bowX + (facingRight ? 1 : -1), y + 5 + walkY, 1, 5, '#fbbf24'); // string
    }

    // Head
    px(ctx, x + 5, y + 2, 6, 4, '#fcd5b4');
    // Hood
    px(ctx, x + 4, y + 1, 8, 2, '#15803d');
    px(ctx, x + 5, y + 0, 6, 1, '#166534');

    // Face
    if (facing !== 'up') {
      px(ctx, x + 6, y + 3, 1, 1, '#1a1a2e');
      px(ctx, x + 9, y + 3, 1, 1, '#1a1a2e');
    }

    this.drawSpriteOutline(ctx, x, y);
  }

  // ===== MONSTER SPRITES =====

  /** Draw a monster sprite */
  drawMonster(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    type: MonsterType,
    facing: Direction,
    frame: number,
    flashWhite = false,
  ): void {
    const stats = MONSTER_STATS[type];
    const renderSize = Math.floor(TILE_SIZE * stats.size);

    // Shadow beneath
    ctx.globalAlpha = 0.3;
    const shadowW = Math.min(renderSize, 14);
    px(ctx, x + (renderSize - shadowW) / 2, y + renderSize - 2, shadowW, 2, '#000000');
    ctx.globalAlpha = 1;

    if (flashWhite) {
      // Draw white silhouette
      px(ctx, x + 2, y + 2, renderSize - 4, renderSize - 4, '#ffffff');
      return;
    }

    switch (type) {
      case 'skeleton': this.drawSkeleton(ctx, x, y, facing, frame); break;
      case 'slime': this.drawSlime(ctx, x, y, frame); break;
      case 'bat': this.drawBat(ctx, x, y, frame); break;
      case 'goblin': this.drawGoblin(ctx, x, y, facing, frame); break;
      case 'boss_demon': this.drawBossDemon(ctx, x, y, facing, frame); break;
    }
  }

  private drawSkeleton(ctx: CanvasRenderingContext2D, x: number, y: number, facing: Direction, frame: number): void {
    const wobble = WALK_OFFSETS[frame % 4];
    const attacking = false; // TODO: pass attacking state

    // Skull
    px(ctx, x + 4, y + 1, 8, 6, '#e5e7eb'); // skull base
    px(ctx, x + 5, y + 0, 6, 1, '#d1d5db'); // skull top
    px(ctx, x + 3, y + 2, 1, 4, '#d1d5db'); // skull left
    px(ctx, x + 12, y + 2, 1, 4, '#d1d5db'); // skull right

    // Glowing red eye sockets
    px(ctx, x + 5, y + 2, 2, 2, '#1a1a2e'); // left socket
    px(ctx, x + 9, y + 2, 2, 2, '#1a1a2e'); // right socket
    px(ctx, x + 5, y + 2, 1, 1, '#ef4444'); // left glow
    px(ctx, x + 10, y + 2, 1, 1, '#ef4444'); // right glow

    // Nose
    px(ctx, x + 7, y + 4, 2, 1, '#1a1a2e');

    // Jaw (opens when attacking or on certain frames)
    const jawOpen = (frame % 8) < 2 ? 1 : 0;
    px(ctx, x + 5, y + 5 + jawOpen, 6, 2, '#d1d5db'); // jaw
    px(ctx, x + 6, y + 5, 4, 1, '#1a1a2e'); // mouth gap
    // Teeth
    px(ctx, x + 6, y + 5 + jawOpen, 1, 1, '#ffffff');
    px(ctx, x + 8, y + 5 + jawOpen, 1, 1, '#ffffff');

    // Ribcage
    px(ctx, x + 5, y + 7, 6, 4, '#d1d5db');
    px(ctx, x + 6, y + 8, 1, 1, '#1a1a2e'); // rib gap
    px(ctx, x + 8, y + 8, 1, 1, '#1a1a2e');
    px(ctx, x + 6, y + 10, 4, 1, '#b0b0b0'); // spine

    // Arms (bone segments)
    px(ctx, x + 3, y + 7 + wobble, 2, 1, '#d1d5db'); // left upper arm
    px(ctx, x + 2, y + 8 + wobble, 1, 3, '#c4c4c4'); // left forearm
    px(ctx, x + 11, y + 7 - wobble, 2, 1, '#d1d5db');
    px(ctx, x + 13, y + 8 - wobble, 1, 3, '#c4c4c4');

    // Rusty sword in right hand
    px(ctx, x + 13, y + 5 - wobble, 1, 3, '#9ca3af'); // blade
    px(ctx, x + 14, y + 5 - wobble, 1, 3, '#78716c'); // rust color
    px(ctx, x + 13, y + 8 - wobble, 1, 1, '#78350f'); // handle

    // Legs (bone)
    px(ctx, x + 6, y + 11, 1, 3 + (frame % 2), '#c4c4c4');
    px(ctx, x + 5, y + 13 + (frame % 2), 2, 1, '#b0b0b0'); // foot
    px(ctx, x + 9, y + 11, 1, 3 - (frame % 2), '#c4c4c4');
    px(ctx, x + 9, y + 13 - (frame % 2), 2, 1, '#b0b0b0');

    this.drawSpriteOutline(ctx, x, y);
  }

  private drawSlime(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number): void {
    // Squash/stretch bouncing animation
    const bouncePhase = (frame % 8) / 8;
    const squash = Math.sin(bouncePhase * Math.PI * 2);
    const baseW = 12;
    const baseH = 10;
    const w = Math.floor(baseW + squash * 2);
    const h = Math.floor(baseH - squash * 2);
    const bx = x + 8 - Math.floor(w / 2);
    const by = y + 14 - h;

    // Small trail behind
    ctx.globalAlpha = 0.2;
    px(ctx, bx + 2, y + 14, w - 4, 1, '#4ade80');
    ctx.globalAlpha = 1;

    // Main body (translucent effect via layers)
    // Outer body
    px(ctx, bx, by + 1, w, h - 1, '#4ade80');
    px(ctx, bx + 1, by, w - 2, 1, '#4ade80'); // rounded top
    px(ctx, bx + 1, by + h, w - 2, 1, '#4ade80'); // rounded bottom

    // Inner lighter area (translucent highlight)
    px(ctx, bx + 2, by + 2, w - 4, h - 4, '#86efac');

    // Bubble highlights
    px(ctx, bx + 2, by + 1, 2, 2, '#bbf7d0');
    px(ctx, bx + w - 4, by + 2, 1, 1, '#bbf7d0');

    // Large bubble inside
    const bubbleX = bx + Math.floor(w * 0.6);
    const bubbleY = by + Math.floor(h * 0.5);
    px(ctx, bubbleX, bubbleY, 2, 2, '#d1fae5');

    // Eyes (blink every ~3 seconds at 8fps)
    const blinkFrame = frame % 24;
    const isBlinking = blinkFrame === 0;
    const eyeY = by + Math.floor(h * 0.3);
    if (isBlinking) {
      px(ctx, bx + Math.floor(w * 0.25), eyeY, 2, 1, '#1a1a2e'); // blink = line
      px(ctx, bx + Math.floor(w * 0.6), eyeY, 2, 1, '#1a1a2e');
    } else {
      px(ctx, bx + Math.floor(w * 0.25), eyeY, 2, 2, '#1a1a2e');
      px(ctx, bx + Math.floor(w * 0.6), eyeY, 2, 2, '#1a1a2e');
      // Eye highlights
      px(ctx, bx + Math.floor(w * 0.25), eyeY, 1, 1, '#ffffff');
      px(ctx, bx + Math.floor(w * 0.6), eyeY, 1, 1, '#ffffff');
    }

    // Mouth (cute smile)
    px(ctx, bx + Math.floor(w * 0.35), eyeY + 3, Math.floor(w * 0.3), 1, '#166534');

    this.drawSpriteOutline(ctx, x, y);
  }

  private drawBat(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number): void {
    // 3-frame flapping animation
    const flapPhase = frame % 6;
    let wingUp: number;
    if (flapPhase < 2) wingUp = -2; // wings up
    else if (flapPhase < 4) wingUp = 0; // wings level
    else wingUp = 2; // wings down

    const bx = x + 3;
    const by = y + 3;

    // Body (small furry oval)
    px(ctx, bx + 4, by + 3, 4, 5, '#7c3aed'); // body
    px(ctx, bx + 4, by + 2, 4, 1, '#8b5cf6'); // body top

    // Head
    px(ctx, bx + 4, by + 1, 4, 3, '#6d28d9');

    // Ears
    px(ctx, bx + 4, by, 1, 2, '#5b21b6');
    px(ctx, bx + 7, by, 1, 2, '#5b21b6');

    // Wings with membrane detail
    // Left wing
    px(ctx, bx, by + 2 + wingUp, 4, 4, '#7c3aed');
    px(ctx, bx, by + 3 + wingUp, 1, 2, '#6d28d9'); // wing tip
    // Membrane lines
    px(ctx, bx + 1, by + 3 + wingUp, 1, 2, '#5b21b6');
    px(ctx, bx + 2, by + 2 + wingUp, 1, 3, '#5b21b6');

    // Right wing
    px(ctx, bx + 8, by + 2 - wingUp, 4, 4, '#7c3aed');
    px(ctx, bx + 11, by + 3 - wingUp, 1, 2, '#6d28d9');
    px(ctx, bx + 10, by + 3 - wingUp, 1, 2, '#5b21b6');
    px(ctx, bx + 9, by + 2 - wingUp, 1, 3, '#5b21b6');

    // Red eyes
    px(ctx, bx + 5, by + 2, 1, 1, '#ef4444');
    px(ctx, bx + 6, by + 2, 1, 1, '#ef4444');

    // Sharp fangs
    px(ctx, bx + 5, by + 4, 1, 1, '#ffffff');
    px(ctx, bx + 6, by + 4, 1, 1, '#ffffff');
  }

  private drawGoblin(ctx: CanvasRenderingContext2D, x: number, y: number, facing: Direction, frame: number): void {
    const wobble = WALK_OFFSETS[frame % 4];

    // Legs
    px(ctx, x + 5, y + 11, 2, 3, '#65a30d');
    px(ctx, x + 9, y + 11, 2, 3, '#65a30d');
    // Feet
    px(ctx, x + 4, y + 13, 3, 2, '#4d7c0f');
    px(ctx, x + 9, y + 13, 3, 2, '#4d7c0f');

    // Body — leather vest
    px(ctx, x + 4, y + 7, 8, 4, '#78350f'); // vest
    px(ctx, x + 5, y + 7, 6, 1, '#92400e'); // vest collar

    // Green belly visible
    px(ctx, x + 6, y + 8, 4, 3, '#84cc16');

    // Big head
    px(ctx, x + 3, y + 1, 10, 7, '#84cc16');
    // Big pointed ears
    px(ctx, x + 1, y + 2, 3, 4, '#84cc16');
    px(ctx, x + 0, y + 3, 1, 2, '#65a30d');
    px(ctx, x + 12, y + 2, 3, 4, '#84cc16');
    px(ctx, x + 15, y + 3, 1, 2, '#65a30d');

    // Mean expression
    px(ctx, x + 5, y + 3, 2, 2, '#ffffff'); // left eye white
    px(ctx, x + 9, y + 3, 2, 2, '#ffffff'); // right eye white
    px(ctx, x + 6, y + 4, 1, 1, '#1a1a2e'); // left pupil
    px(ctx, x + 9, y + 4, 1, 1, '#1a1a2e'); // right pupil
    // Angry brow
    px(ctx, x + 5, y + 2, 2, 1, '#4d7c0f');
    px(ctx, x + 9, y + 2, 2, 1, '#4d7c0f');

    // Big nose
    px(ctx, x + 7, y + 4, 2, 2, '#65a30d');

    // Mouth with snaggle tooth
    px(ctx, x + 5, y + 6, 6, 1, '#1a1a2e');
    px(ctx, x + 6, y + 5, 1, 1, '#ffffff'); // snaggle tooth sticking up!
    px(ctx, x + 9, y + 6, 1, 1, '#ffffff'); // another tooth

    // Arms
    px(ctx, x + 2, y + 7 + wobble, 2, 4, '#84cc16');
    px(ctx, x + 12, y + 7 - wobble, 2, 4, '#84cc16');

    // Wooden club in right hand
    px(ctx, x + 13, y + 4 - wobble, 2, 4, '#78350f');
    px(ctx, x + 13, y + 3 - wobble, 3, 2, '#92400e'); // club head (thicker)
    // Nails in club
    px(ctx, x + 14, y + 3 - wobble, 1, 1, '#9ca3af');

    this.drawSpriteOutline(ctx, x, y);
  }

  private drawBossDemon(ctx: CanvasRenderingContext2D, x: number, y: number, facing: Direction, frame: number): void {
    // 2.5x size = ~40x40
    const pulse = Math.sin(frame * 0.3) * 2;
    const bx = x - 4; // offset to center in 40x40 area
    const by = y - 4;

    // Fire aura around body
    ctx.globalAlpha = 0.12 + Math.sin(frame * 0.2) * 0.08;
    px(ctx, bx + 2, by + 2, 36, 36, '#ef4444');
    ctx.globalAlpha = 0.08;
    px(ctx, bx, by, 40, 40, '#f97316');
    ctx.globalAlpha = 1;

    // Bat-like wings spread wide
    // Left wing
    px(ctx, bx + 1, by + 6 + pulse, 7, 18, '#7f1d1d');
    px(ctx, bx + 0, by + 8 + pulse, 2, 14, '#991b1b');
    // Wing membrane lines
    px(ctx, bx + 2, by + 8 + pulse, 1, 14, '#450a0a');
    px(ctx, bx + 4, by + 7 + pulse, 1, 16, '#450a0a');

    // Right wing
    px(ctx, bx + 32, by + 6 - pulse, 7, 18, '#7f1d1d');
    px(ctx, bx + 38, by + 8 - pulse, 2, 14, '#991b1b');
    px(ctx, bx + 37, by + 8 - pulse, 1, 14, '#450a0a');
    px(ctx, bx + 35, by + 7 - pulse, 1, 16, '#450a0a');

    // Main body — dark red with black cracks
    px(ctx, bx + 10, by + 8, 20, 22, '#dc2626');
    // Lava cracks
    px(ctx, bx + 14, by + 12, 1, 6, '#1a1a2e');
    px(ctx, bx + 14, by + 13, 1, 1, '#f97316'); // lava glow in crack
    px(ctx, bx + 25, by + 14, 1, 5, '#1a1a2e');
    px(ctx, bx + 25, by + 15, 1, 1, '#f97316');
    px(ctx, bx + 18, by + 20, 4, 1, '#1a1a2e');
    px(ctx, bx + 19, by + 20, 2, 1, '#f97316');

    // Chest highlight
    px(ctx, bx + 14, by + 10, 12, 6, '#b91c1c');
    px(ctx, bx + 16, by + 11, 8, 4, '#991b1b');

    // Head
    px(ctx, bx + 12, by + 2, 16, 10, '#dc2626');
    px(ctx, bx + 14, by + 1, 12, 2, '#b91c1c'); // forehead

    // Huge horns curving upward
    px(ctx, bx + 9, by - 2, 4, 6, '#451a03');
    px(ctx, bx + 8, by - 4, 3, 3, '#78350f');
    px(ctx, bx + 7, by - 5, 2, 2, '#92400e'); // horn tip
    px(ctx, bx + 27, by - 2, 4, 6, '#451a03');
    px(ctx, bx + 29, by - 4, 3, 3, '#78350f');
    px(ctx, bx + 31, by - 5, 2, 2, '#92400e');

    // Burning eyes (yellow/orange)
    px(ctx, bx + 15, by + 4, 3, 3, '#000000'); // eye socket
    px(ctx, bx + 22, by + 4, 3, 3, '#000000');
    px(ctx, bx + 15, by + 4, 2, 2, '#fbbf24'); // left eye fire
    px(ctx, bx + 16, by + 5, 1, 1, '#f97316'); // pupil
    px(ctx, bx + 23, by + 4, 2, 2, '#fbbf24');
    px(ctx, bx + 23, by + 5, 1, 1, '#f97316');

    // Mouth with fangs
    px(ctx, bx + 15, by + 8, 10, 3, '#1a1a2e');
    px(ctx, bx + 16, by + 10, 2, 2, '#ffffff'); // left fang
    px(ctx, bx + 22, by + 10, 2, 2, '#ffffff'); // right fang
    px(ctx, bx + 18, by + 9, 4, 1, '#ef4444'); // tongue/fire

    // Arms (muscular)
    px(ctx, bx + 6, by + 14, 4, 12, '#dc2626');
    px(ctx, bx + 7, by + 15, 2, 4, '#b91c1c'); // muscle highlight
    px(ctx, bx + 30, by + 14, 4, 12, '#dc2626');
    px(ctx, bx + 31, by + 15, 2, 4, '#b91c1c');

    // Claws
    px(ctx, bx + 5, by + 26, 2, 2, '#451a03');
    px(ctx, bx + 7, by + 26, 1, 2, '#451a03');
    px(ctx, bx + 32, by + 26, 2, 2, '#451a03');
    px(ctx, bx + 31, by + 26, 1, 2, '#451a03');

    // Legs
    px(ctx, bx + 12, by + 30, 6, 6, '#991b1b');
    px(ctx, bx + 22, by + 30, 6, 6, '#991b1b');
    // Hooves
    px(ctx, bx + 11, by + 35, 8, 2, '#451a03');
    px(ctx, bx + 21, by + 35, 8, 2, '#451a03');

    // Tail with spike
    px(ctx, bx + 18, by + 30, 3, 2, '#991b1b');
    px(ctx, bx + 20, by + 31, 3, 2, '#7f1d1d');
    px(ctx, bx + 22, by + 32, 3, 2, '#7f1d1d');
    px(ctx, bx + 24, by + 31, 2, 1, '#7f1d1d');
    px(ctx, bx + 26, by + 30, 3, 3, '#451a03'); // spike

    // Outline for boss
    this.drawSpriteOutline(ctx, bx, by);
  }

  // ===== TILE SPRITES =====

  /** Draw a tile */
  drawTile(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    type: TileType,
    roomCleared = false,
    tileX = 0,
    tileY = 0,
  ): void {
    // Use tile position for deterministic variation
    const hash = tileHash(Math.floor(x / TILE_SIZE + 1000), Math.floor(y / TILE_SIZE + 1000));

    switch (type) {
      case 'floor': this.drawFloorTile(ctx, x, y, hash); break;
      case 'wall': this.drawWallTile(ctx, x, y, hash); break;
      case 'door': this.drawDoorTile(ctx, x, y, roomCleared); break;
      case 'stairs': this.drawStairsTile(ctx, x, y); break;
      case 'chest': this.drawChestTile(ctx, x, y, roomCleared); break;
      case 'void': px(ctx, x, y, TILE_SIZE, TILE_SIZE, '#000000'); break;
    }
  }

  private drawFloorTile(ctx: CanvasRenderingContext2D, x: number, y: number, hash: number): void {
    const variation = hash % 3;

    // Base stone floor
    px(ctx, x, y, TILE_SIZE, TILE_SIZE, '#1a1a2e');

    // Subtle grid lines (mortar)
    ctx.fillStyle = '#22223a';
    ctx.fillRect(x + TILE_SIZE - 1, y, 1, TILE_SIZE);
    ctx.fillRect(x, y + TILE_SIZE - 1, TILE_SIZE, 1);

    // Stone tile variation
    if (variation === 0) {
      // Subtle color difference
      px(ctx, x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2, '#1c1c32');
    } else if (variation === 1) {
      // Crack
      px(ctx, x + 3, y + 5, 1, 4, '#141424');
      px(ctx, x + 4, y + 8, 1, 3, '#141424');
      px(ctx, x + 5, y + 10, 1, 2, '#141424');
    } else {
      // Moss spots
      px(ctx, x + 10, y + 3, 2, 1, '#1e3a1e');
      px(ctx, x + 11, y + 4, 1, 1, '#1e3a1e');
      if ((hash >> 4) % 3 === 0) {
        px(ctx, x + 4, y + 11, 1, 1, '#1e3a1e');
      }
    }

    // Occasional small stone detail
    if ((hash >> 8) % 5 === 0) {
      px(ctx, x + 7, y + 7, 2, 2, '#1e1e36');
    }
  }

  private drawWallTile(ctx: CanvasRenderingContext2D, x: number, y: number, hash: number): void {
    // Base wall
    px(ctx, x, y, TILE_SIZE, TILE_SIZE, '#2d1b69');

    // Top slightly lighter (implied light from above)
    px(ctx, x, y, TILE_SIZE, 3, '#3d2b79');

    // Proper brick pattern with mortar lines
    const mortarColor = '#1e1245';
    // Horizontal mortar lines
    ctx.fillStyle = mortarColor;
    ctx.fillRect(x, y + 4, TILE_SIZE, 1);
    ctx.fillRect(x, y + 9, TILE_SIZE, 1);
    ctx.fillRect(x, y + 14, TILE_SIZE, 1);

    // Vertical mortar lines (offset per row)
    ctx.fillRect(x + 4, y, 1, 4);
    ctx.fillRect(x + 12, y, 1, 4);
    ctx.fillRect(x + 8, y + 5, 1, 4);
    ctx.fillRect(x, y + 5, 1, 4); // edge
    ctx.fillRect(x + 4, y + 10, 1, 4);
    ctx.fillRect(x + 12, y + 10, 1, 4);

    // Brick highlights (subtle)
    px(ctx, x + 1, y + 1, 2, 1, '#352070');
    px(ctx, x + 6, y + 6, 2, 1, '#352070');
    px(ctx, x + 1, y + 11, 2, 1, '#352070');

    // Darker border edges
    ctx.fillStyle = '#1e1245';
    ctx.fillRect(x, y, TILE_SIZE, 1); // top
    ctx.fillRect(x, y, 1, TILE_SIZE); // left

    ctx.fillStyle = '#3d2b79';
    ctx.fillRect(x, y + TILE_SIZE - 1, TILE_SIZE, 1); // bottom highlight
    ctx.fillRect(x + TILE_SIZE - 1, y, 1, TILE_SIZE); // right highlight

    // Moss/vine on some walls
    if ((hash >> 4) % 4 === 0) {
      px(ctx, x + 2, y + 13, 1, 2, '#1e3a1e');
      px(ctx, x + 3, y + 12, 1, 3, '#15532a');
      px(ctx, x + 4, y + 14, 1, 1, '#1e3a1e');
    }

    // Occasional torch on wall
    if ((hash >> 8) % 7 === 0) {
      this.drawWallTorch(ctx, x + 6, y + 3, hash);
    }
  }

  /** Draw a small torch on wall */
  drawWallTorch(ctx: CanvasRenderingContext2D, x: number, y: number, hash: number): void {
    // Torch holder
    px(ctx, x + 1, y + 2, 2, 4, '#78350f');
    px(ctx, x, y + 5, 4, 1, '#92400e');

    // Flame (2 frames based on hash trick — flickers)
    const flicker = (hash >> 12) % 2;
    if (flicker === 0) {
      px(ctx, x + 1, y, 2, 2, '#fbbf24');
      px(ctx, x + 1, y - 1, 1, 1, '#f97316');
      px(ctx, x + 2, y + 1, 1, 1, '#ef4444');
    } else {
      px(ctx, x, y, 3, 2, '#f97316');
      px(ctx, x + 1, y - 1, 1, 1, '#fbbf24');
      px(ctx, x + 2, y, 1, 1, '#fef3c7');
    }
  }

  private drawDoorTile(ctx: CanvasRenderingContext2D, x: number, y: number, roomCleared: boolean): void {
    // Floor beneath
    px(ctx, x, y, TILE_SIZE, TILE_SIZE, '#1a1a2e');

    if (roomCleared) {
      // Open door: swung open against wall
      // Door frame
      px(ctx, x, y, 2, TILE_SIZE, '#5c3d1e');
      px(ctx, x + TILE_SIZE - 2, y, 2, TILE_SIZE, '#5c3d1e');
      px(ctx, x, y, TILE_SIZE, 2, '#5c3d1e');

      // Open door panel (shown from side, leaning against frame)
      px(ctx, x + 1, y + 2, 3, TILE_SIZE - 3, '#8b6914');
      px(ctx, x + 2, y + 3, 1, TILE_SIZE - 5, '#a67c1a'); // highlight

      // Passage visible
      px(ctx, x + 4, y + 2, TILE_SIZE - 6, TILE_SIZE - 3, '#141424');
    } else {
      // Closed: solid wooden door with iron bindings
      px(ctx, x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2, '#6b4f2a');

      // Wood grain
      px(ctx, x + 4, y + 2, 1, TILE_SIZE - 4, '#5c3d1e');
      px(ctx, x + 8, y + 2, 1, TILE_SIZE - 4, '#5c3d1e');
      px(ctx, x + 12, y + 2, 1, TILE_SIZE - 4, '#5c3d1e');

      // Iron bindings (horizontal bands)
      px(ctx, x + 2, y + 3, TILE_SIZE - 4, 1, '#6b7280');
      px(ctx, x + 2, y + TILE_SIZE - 4, TILE_SIZE - 4, 1, '#6b7280');

      // Iron ring handle
      px(ctx, x + 10, y + 6, 3, 3, '#9ca3af');
      px(ctx, x + 11, y + 7, 1, 1, '#6b4f2a'); // hole in ring

      // Door frame
      px(ctx, x, y, TILE_SIZE, 1, '#4a3728');
      px(ctx, x, y, 1, TILE_SIZE, '#4a3728');
      px(ctx, x + TILE_SIZE - 1, y, 1, TILE_SIZE, '#4a3728');
      px(ctx, x, y + TILE_SIZE - 1, TILE_SIZE, 1, '#4a3728');
    }
  }

  private drawStairsTile(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    // Dark background
    px(ctx, x, y, TILE_SIZE, TILE_SIZE, '#0f0f1e');

    // Spiral staircase going down
    const stairColor = '#78716c';
    const stairLight = '#a8a29e';

    // Steps descending left to right, curving
    px(ctx, x + 2, y + 1, 12, 2, stairLight);
    px(ctx, x + 3, y + 4, 11, 2, stairColor);
    px(ctx, x + 4, y + 7, 10, 2, darken(stairColor, 0.1));
    px(ctx, x + 3, y + 10, 10, 2, darken(stairColor, 0.2));
    px(ctx, x + 2, y + 13, 10, 2, darken(stairColor, 0.3));

    // Step edges (lighter)
    px(ctx, x + 2, y + 1, 12, 1, stairLight);
    px(ctx, x + 3, y + 4, 11, 1, stairColor);

    // Railing
    px(ctx, x + 1, y + 0, 1, TILE_SIZE, '#451a03');

    // Glow from below
    ctx.globalAlpha = 0.2;
    px(ctx, x + 4, y + 12, 8, 3, '#f59e0b');
    ctx.globalAlpha = 0.1;
    px(ctx, x + 2, y + 10, 12, 5, '#f59e0b');
    ctx.globalAlpha = 1;
  }

  private drawChestTile(ctx: CanvasRenderingContext2D, x: number, y: number, opened: boolean): void {
    // Floor beneath
    px(ctx, x, y, TILE_SIZE, TILE_SIZE, '#1a1a2e');

    if (opened) {
      // Open chest with golden glow
      // Glow emanating
      ctx.globalAlpha = 0.15 + Math.sin(Date.now() * 0.003) * 0.1;
      px(ctx, x + 1, y + 1, 14, 10, '#fbbf24');
      ctx.globalAlpha = 1;

      // Chest body
      px(ctx, x + 3, y + 6, 10, 6, '#92400e');
      // Gold bands
      px(ctx, x + 3, y + 6, 10, 1, '#eab308');
      px(ctx, x + 3, y + 11, 10, 1, '#eab308');

      // Lid up (tilted back)
      px(ctx, x + 3, y + 3, 10, 3, '#78350f');
      px(ctx, x + 4, y + 3, 8, 1, '#92400e');
      // Gold band on lid
      px(ctx, x + 3, y + 5, 10, 1, '#eab308');

      // Golden glow inside
      px(ctx, x + 4, y + 7, 8, 4, '#fbbf24');
      px(ctx, x + 5, y + 8, 6, 2, '#fef3c7');
    } else {
      // Closed chest with keyhole
      // Chest body
      px(ctx, x + 3, y + 5, 10, 7, '#92400e');

      // Lid
      px(ctx, x + 3, y + 4, 10, 2, '#78350f');
      px(ctx, x + 4, y + 4, 8, 1, '#a16207'); // top highlight

      // Gold bands
      px(ctx, x + 3, y + 4, 10, 1, '#eab308');
      px(ctx, x + 3, y + 8, 10, 1, '#eab308');
      px(ctx, x + 3, y + 11, 10, 1, '#eab308');
      // Vertical gold bands
      px(ctx, x + 3, y + 5, 1, 7, '#b45309');
      px(ctx, x + 12, y + 5, 1, 7, '#b45309');

      // Keyhole
      px(ctx, x + 7, y + 6, 2, 3, '#1a1a2e');
      px(ctx, x + 7, y + 6, 2, 1, '#78350f'); // keyhole top

      // Highlight
      px(ctx, x + 4, y + 5, 3, 1, lighten('#92400e', 0.2));
    }
  }

  // ===== PROJECTILE SPRITES =====

  /** Draw a projectile */
  drawProjectile(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    type: 'arrow' | 'fireball' | 'sword_slash',
    frame: number,
    vx = 0,
    vy = 0,
  ): void {
    switch (type) {
      case 'arrow': this.drawArrowProjectile(ctx, x, y, vx, vy); break;
      case 'fireball': this.drawFireballProjectile(ctx, x, y, frame); break;
      case 'sword_slash': this.drawSwordSlashProjectile(ctx, x, y, frame); break;
    }
  }

  private drawArrowProjectile(ctx: CanvasRenderingContext2D, x: number, y: number, vx: number, vy: number): void {
    // Calculate rotation from velocity
    const angle = Math.atan2(vy, vx);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    // Arrow length = 7px
    const len = 7;
    const tipX = Math.floor(x + cos * len);
    const tipY = Math.floor(y + sin * len);
    const tailX = Math.floor(x - cos * 2);
    const tailY = Math.floor(y - sin * 2);

    // Draw arrow as line segments at angle
    // Metal tip (2px)
    px(ctx, tipX, tipY, 2, 1, '#9ca3af');
    px(ctx, tipX - Math.floor(cos), tipY - Math.floor(sin), 1, 1, '#6b7280');

    // Wood shaft
    const midX = Math.floor(x + cos * 2);
    const midY = Math.floor(y + sin * 2);
    px(ctx, midX, midY, 1, 1, '#92400e');
    px(ctx, x, y, 1, 1, '#78350f');
    px(ctx, Math.floor(x - cos), Math.floor(y - sin), 1, 1, '#78350f');

    // Feathered fletching
    px(ctx, tailX, tailY, 1, 1, '#fbbf24');
    px(ctx, tailX + Math.floor(sin), tailY - Math.floor(cos), 1, 1, '#f59e0b');
    px(ctx, tailX - Math.floor(sin), tailY + Math.floor(cos), 1, 1, '#f59e0b');
  }

  private drawFireballProjectile(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number): void {
    const phase = frame % 3;

    // Outer glow (red)
    ctx.globalAlpha = 0.25;
    px(ctx, x - 4, y - 4, 8, 8, '#ef4444');
    ctx.globalAlpha = 1;

    // Main fire sphere (3 frame animation)
    if (phase === 0) {
      px(ctx, x - 3, y - 2, 6, 5, '#f97316');
      px(ctx, x - 2, y - 3, 4, 1, '#f97316');
    } else if (phase === 1) {
      px(ctx, x - 2, y - 3, 5, 6, '#f97316');
      px(ctx, x - 3, y - 2, 1, 4, '#ef4444');
    } else {
      px(ctx, x - 3, y - 3, 6, 6, '#f97316');
      px(ctx, x - 2, y - 2, 1, 1, '#fef3c7');
    }

    // Orange/yellow core
    px(ctx, x - 2, y - 2, 4, 4, '#fbbf24');
    px(ctx, x - 1, y - 1, 2, 2, '#fef3c7');

    // Trailing embers
    ctx.globalAlpha = 0.6;
    px(ctx, x - 5 - phase, y - 1 + (phase % 2), 1, 1, '#f97316');
    px(ctx, x - 4 + phase, y + 2 - phase, 1, 1, '#ef4444');
    ctx.globalAlpha = 1;
  }

  private drawSwordSlashProjectile(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number): void {
    const slashPhase = frame % 4;

    // Arc-shaped white/silver trail that fades
    ctx.globalAlpha = 0.8 - slashPhase * 0.15;

    // Main arc
    px(ctx, x - 3 + slashPhase, y - 5, 2, 10, '#e5e7eb');
    px(ctx, x - 2 + slashPhase, y - 4, 3, 8, '#ffffff');

    // Star particles
    ctx.globalAlpha = 0.6;
    px(ctx, x - 1 + slashPhase * 2, y - 6, 1, 1, '#ffffff');
    px(ctx, x + 2 - slashPhase, y + 4, 1, 1, '#fef3c7');
    px(ctx, x + slashPhase, y - 3, 1, 1, '#ffffff');

    ctx.globalAlpha = 1;
  }

  // ===== LOOT SPRITES =====

  /** Draw a loot item */
  drawLoot(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    type: LootType,
    frame: number,
  ): void {
    const loot = LOOT_TABLE[type];
    const color = loot.color;
    const bounceY = Math.sin(frame * 0.15) * 2;
    const ly = y + bounceY;

    // Shadow
    ctx.globalAlpha = 0.25;
    px(ctx, x + 4, y + 13, 8, 2, '#000000');
    ctx.globalAlpha = 1;

    // Glow underneath
    ctx.globalAlpha = 0.2 + Math.sin(frame * 0.1) * 0.1;
    px(ctx, x + 3, y + 12, 10, 2, color);
    ctx.globalAlpha = 1;

    switch (type) {
      case 'health_potion': this.drawHealthPotion(ctx, x, ly, frame); break;
      case 'mana_potion': this.drawManaPotion(ctx, x, ly, frame); break;
      case 'damage_boost': this.drawDamageBoost(ctx, x, ly, frame); break;
      case 'speed_boost': this.drawSpeedBoost(ctx, x, ly, frame); break;
      case 'gold': this.drawGoldLoot(ctx, x, ly, frame); break;
    }
  }

  private drawHealthPotion(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number): void {
    // Cork top
    px(ctx, x + 6, y + 2, 4, 2, '#92400e');

    // Bottle neck
    px(ctx, x + 6, y + 4, 4, 2, '#d1d5db');

    // Bottle body (red liquid)
    px(ctx, x + 4, y + 6, 8, 5, '#ef4444');
    px(ctx, x + 5, y + 5, 6, 1, '#dc2626');
    px(ctx, x + 5, y + 11, 6, 1, '#b91c1c');

    // Heart label
    px(ctx, x + 7, y + 7, 2, 1, '#fecaca');
    px(ctx, x + 6, y + 8, 4, 1, '#fecaca');
    px(ctx, x + 7, y + 9, 2, 1, '#fecaca');

    // Liquid slosh animation
    const slosh = Math.sin(frame * 0.2);
    if (slosh > 0.5) {
      px(ctx, x + 5, y + 7, 2, 1, lighten('#ef4444', 0.3));
    }

    // Glass highlight
    px(ctx, x + 5, y + 6, 1, 3, lighten('#ef4444', 0.4));
  }

  private drawManaPotion(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number): void {
    // Cork
    px(ctx, x + 6, y + 2, 4, 2, '#92400e');

    // Bottle neck
    px(ctx, x + 6, y + 4, 4, 2, '#d1d5db');

    // Bottle body (blue liquid)
    px(ctx, x + 4, y + 6, 8, 5, '#3b82f6');
    px(ctx, x + 5, y + 5, 6, 1, '#2563eb');
    px(ctx, x + 5, y + 11, 6, 1, '#1d4ed8');

    // Star label
    px(ctx, x + 7, y + 7, 2, 1, '#bfdbfe');
    px(ctx, x + 6, y + 8, 4, 1, '#bfdbfe');
    px(ctx, x + 7, y + 9, 2, 1, '#bfdbfe');

    // Glass highlight
    px(ctx, x + 5, y + 6, 1, 3, lighten('#3b82f6', 0.4));

    // Magical particles rising
    if (frame % 6 < 3) {
      px(ctx, x + 7, y + 1, 1, 1, '#93c5fd');
    }
    if (frame % 8 < 2) {
      px(ctx, x + 9, y + 3, 1, 1, '#ffffff');
    }
  }

  private drawDamageBoost(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number): void {
    const pulse = Math.sin(frame * 0.2) * 0.15;

    // Glow
    ctx.globalAlpha = 0.2 + pulse;
    px(ctx, x + 3, y + 2, 10, 10, '#f59e0b');
    ctx.globalAlpha = 1;

    // Sword icon
    px(ctx, x + 7, y + 2, 2, 7, '#d1d5db'); // blade
    px(ctx, x + 6, y + 2, 1, 2, '#e5e7eb'); // blade edge
    px(ctx, x + 9, y + 2, 1, 2, '#9ca3af'); // blade shadow

    // Cross guard
    px(ctx, x + 5, y + 8, 6, 1, '#fbbf24');

    // Handle
    px(ctx, x + 7, y + 9, 2, 2, '#78350f');

    // Pommel
    px(ctx, x + 7, y + 11, 2, 1, '#fbbf24');
  }

  private drawSpeedBoost(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number): void {
    // Cyan wing/boot icon
    const streak = frame % 4;

    // Boot shape
    px(ctx, x + 4, y + 4, 5, 6, '#06b6d4');
    px(ctx, x + 4, y + 10, 7, 2, '#0891b2');
    px(ctx, x + 3, y + 8, 1, 2, '#06b6d4');

    // Wing detail
    px(ctx, x + 9, y + 3, 3, 2, lighten('#06b6d4', 0.3));
    px(ctx, x + 10, y + 2, 3, 2, lighten('#06b6d4', 0.4));
    px(ctx, x + 11, y + 1, 2, 2, lighten('#06b6d4', 0.5));

    // Streaking effect
    ctx.globalAlpha = 0.4;
    px(ctx, x + 1 - streak, y + 6, 3, 1, '#06b6d4');
    px(ctx, x + 0 - streak, y + 8, 2, 1, '#0891b2');
    ctx.globalAlpha = 1;

    // Highlight
    px(ctx, x + 5, y + 5, 1, 2, lighten('#06b6d4', 0.5));
  }

  private drawGoldLoot(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number): void {
    // Stack of coins
    // Bottom coin
    px(ctx, x + 3, y + 9, 8, 3, '#ca8a04');
    px(ctx, x + 4, y + 9, 6, 1, '#eab308');

    // Middle coin (offset)
    px(ctx, x + 4, y + 6, 8, 3, '#eab308');
    px(ctx, x + 5, y + 6, 6, 1, '#fbbf24');

    // Top coin
    px(ctx, x + 5, y + 3, 6, 3, '#fbbf24');
    px(ctx, x + 6, y + 3, 4, 1, lighten('#fbbf24', 0.3));

    // $ symbol on top coin
    px(ctx, x + 7, y + 4, 2, 1, '#ca8a04');

    // Sparkle animation
    const sparklePhase = frame % 16;
    if (sparklePhase < 3) {
      px(ctx, x + 10, y + 3, 1, 1, '#ffffff');
    } else if (sparklePhase > 7 && sparklePhase < 10) {
      px(ctx, x + 4, y + 5, 1, 1, '#ffffff');
    } else if (sparklePhase > 12 && sparklePhase < 14) {
      px(ctx, x + 8, y + 8, 1, 1, '#ffffff');
    }
  }

  // ===== UTILITY =====

  /** Draw a 1px black outline around a sprite region */
  private drawSpriteOutline(ctx: CanvasRenderingContext2D, _x: number, _y: number): void {
    // For performance, we skip full outline computation.
    // Instead we rely on the 1px black shadow beneath + dark border pixels
    // already placed in each sprite. Full outline would require reading
    // pixel data which is too expensive per frame.
  }

  /** Simple outline helper — draws black border rect */
  private drawOutline(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, _color: string): void {
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }
}

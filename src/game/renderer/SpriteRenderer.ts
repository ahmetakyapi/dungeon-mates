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

const withAlpha = (hex: string, alpha: number): string => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
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

// --- Off-screen sprite cache with LRU eviction ---
type CacheKey = string;
const SPRITE_CACHE_MAX = 256;
const spriteCache = new Map<CacheKey, HTMLCanvasElement>();

// Tile cache moved to SpriteRenderer instance to avoid HMR stale cache issues

const getCachedSprite = (
  key: CacheKey,
  width: number,
  height: number,
  drawFn: (ctx: CanvasRenderingContext2D) => void,
): HTMLCanvasElement => {
  let cached = spriteCache.get(key);
  if (cached) {
    // Move to end (most recent) for LRU ordering
    spriteCache.delete(key);
    spriteCache.set(key, cached);
    return cached;
  }

  // Evict oldest entries if at capacity
  if (spriteCache.size >= SPRITE_CACHE_MAX) {
    // Map iterates in insertion order — first key is oldest
    const oldestKey = spriteCache.keys().next().value;
    if (oldestKey !== undefined) spriteCache.delete(oldestKey);
  }

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

// --- 4-frame smooth leg alternation offsets ---
const LEG_CYCLE = [0, 1, 2, 1] as const; // smooth stride: neutral, forward, full, back

export class SpriteRenderer {
  private readonly hitFlashTimers: Map<string, number> = new Map();
  private readonly tileCache: Map<string, HTMLCanvasElement> = new Map();

  /** Register a hit flash for an entity (5 frames for visible feedback) */
  registerHitFlash(entityId: string): void {
    this.hitFlashTimers.set(entityId, 5);
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

  // ===== ENTITY SHADOW =====

  /** Draw an elliptical semi-transparent shadow beneath an entity */
  drawEntityShadow(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    const shadowW = Math.max(4, Math.floor(width * 0.7));
    const shadowH = Math.max(2, Math.floor(height * 0.15));
    const cx = x + Math.floor(width / 2);
    const cy = y + height - 1;
    // Light source from upper-left: offset shadow slightly right and down
    const offsetX = 1;
    const offsetY = 0;

    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.beginPath();
    ctx.ellipse(
      cx + offsetX,
      cy + offsetY,
      Math.floor(shadowW / 2),
      shadowH,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fillStyle = '#000000';
    ctx.fill();
    ctx.restore();
  }

  // ===== PLAYER SPRITES =====

  /** Draw a player character (16x16 pixel art) -- detailed per class */
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
    shieldActive = false,
    poisoned = false,
    slowed = false,
    stunTicks = 0,
  ): void {
    // Elliptical shadow beneath
    this.drawEntityShadow(ctx, x, y, 16, 16);

    // Idle breathing: subtle Y oscillation every ~30 frames
    const breatheY = Math.sin(frame * 0.21) * 0.6;

    if (flashWhite) {
      this.drawPlayerWhiteFlash(ctx, x, y + breatheY, playerClass, facing, attacking, frame);
      return;
    }

    // Cache player sprite per animation state — avoids 50+ px() calls per frame
    const walkFrame = frame % 4;
    const atkFrame = attacking ? 1 : 0;
    const cacheKey = `player_${playerClass}_${facing}_${atkFrame}_${walkFrame}`;
    const cached = getCachedSprite(cacheKey, 16, 16, (sprCtx) => {
      switch (playerClass) {
        case 'warrior':
          this.drawWarrior(sprCtx, 0, 0, facing, attacking, frame);
          break;
        case 'mage':
          this.drawMage(sprCtx, 0, 0, facing, attacking, frame);
          break;
        case 'archer':
          this.drawArcher(sprCtx, 0, 0, facing, attacking, frame);
          break;
        case 'healer':
          this.drawHealer(sprCtx, 0, 0, facing, attacking, frame);
          break;
      }
    });
    ctx.drawImage(cached, Math.floor(x), Math.floor(y + breatheY));

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

    // Poison status — green tint + dripping particles
    if (poisoned) {
      ctx.globalAlpha = 0.15 + Math.sin(frame * 0.4) * 0.05;
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(x + 2, y + 2, 12, 12);
      ctx.globalAlpha = 1;
      // Poison drip particles
      const dripY = (frame * 2) % 8;
      ctx.globalAlpha = 0.7 - dripY * 0.08;
      px(ctx, x + 4 + (frame % 3) * 3, y + 12 + dripY, 1, 2, '#4ade80');
      ctx.globalAlpha = 1;
    }

    // Slow status — ice crystals around feet
    if (slowed) {
      ctx.globalAlpha = 0.5;
      const iceShimmer = Math.sin(frame * 0.6) * 0.15;
      px(ctx, x + 2, y + 14, 2, 1, '#93c5fd');
      px(ctx, x + 12, y + 14, 2, 1, '#93c5fd');
      px(ctx, x + 7, y + 15, 2, 1, '#bfdbfe');
      ctx.globalAlpha = 0.3 + iceShimmer;
      px(ctx, x + 1, y + 13, 1, 2, '#dbeafe');
      px(ctx, x + 14, y + 13, 1, 2, '#dbeafe');
      ctx.globalAlpha = 1;
    }

    // Stun status — spinning stars above head
    if (stunTicks > 0) {
      for (let i = 0; i < 3; i++) {
        const angle = (frame * 0.25) + (i * Math.PI * 2 / 3);
        const starX = x + 8 + Math.cos(angle) * 5;
        const starY = y - 3 + Math.sin(angle) * 2;
        ctx.globalAlpha = 0.8;
        px(ctx, starX, starY, 1, 1, '#fbbf24');
        px(ctx, starX - 1, starY, 1, 1, '#fde68a');
        ctx.globalAlpha = 1;
      }
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
    // Draw entire player silhouette with red tint overlay for damage
    const walkY = WALK_OFFSETS[frame % 4];
    const legOff = frame % 2;
    const flashColor = '#ff8888'; // red-tinted white for damage indication
    // Head
    px(ctx, x + 5, y + 1, 6, 5, flashColor);
    // Body
    px(ctx, x + 4, y + 6 + walkY, 8, 5, flashColor);
    // Arms
    px(ctx, x + 2, y + 6 + walkY, 2, 5, flashColor);
    px(ctx, x + 12, y + 6 + walkY, 2, 5, flashColor);
    // Legs
    px(ctx, x + 5, y + 11, 2, 3 + legOff, flashColor);
    px(ctx, x + 9, y + 11, 2, 3 - legOff, flashColor);
    // Red tint overlay
    ctx.globalAlpha = 0.3;
    px(ctx, x + 2, y + 1, 14, 14, '#ff0000');
    ctx.globalAlpha = 1;
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
    const legPhase = LEG_CYCLE[frame % 4];
    const legLeft = legPhase;
    const legRight = LEG_CYCLE[(frame + 2) % 4];
    const isHoriz = facing === 'left' || facing === 'right';
    const facingRight = facing === 'right';
    const facingUp = facing === 'up';
    const armSwing = Math.sin(frame * 1.2) * 1;

    // Steel boots -- 4-frame smooth stride with steel toe
    px(ctx, x + 4, y + 13 + legLeft, 3, 2, '#6b7280');
    px(ctx, x + 9, y + 13 + legRight, 3, 2, '#6b7280');
    px(ctx, x + 4, y + 13 + legLeft, 1, 1, '#9ca3af');
    px(ctx, x + 9, y + 13 + legRight, 1, 1, '#9ca3af');
    // Boot ankle guard
    px(ctx, x + 4, y + 12 + legLeft, 3, 1, '#4b5563');
    px(ctx, x + 9, y + 12 + legRight, 3, 1, '#4b5563');

    // Legs (dark armor greaves)
    px(ctx, x + 5, y + 11, 2, 3 + legLeft, '#991b1b');
    px(ctx, x + 9, y + 11, 2, 3 + legRight, '#991b1b');
    // Greave highlights
    px(ctx, x + 5, y + 11, 1, 1, '#b91c1c');
    px(ctx, x + 9, y + 11, 1, 1, '#b91c1c');

    // Red cape flowing behind -- direction-aware with layered folds
    if (!facingUp) {
      const capeDir = facingRight ? -1 : 1;
      const capeWave = Math.sin(frame * 0.8) * 1.5;
      const capeWave2 = Math.sin(frame * 0.6 + 1) * 0.8;
      px(ctx, x + 5, y + 7 + walkY, 6, 5, '#b91c1c');
      px(ctx, x + 4 + capeWave * capeDir * 0.3, y + 10 + walkY, 8, 2, '#991b1b');
      // Cape fold detail
      px(ctx, x + 6, y + 9 + walkY, 1, 2, '#7f1d1d');
      px(ctx, x + 9, y + 8 + walkY + capeWave2, 1, 2, '#dc2626');
      // Cape edge fringe
      px(ctx, x + 5, y + 11 + walkY, 1, 1, '#7f1d1d');
      px(ctx, x + 10, y + 11 + walkY, 1, 1, '#7f1d1d');
      // Cape flow highlights
      px(ctx, x + 6, y + 8 + walkY, 2, 1, '#dc2626');
      px(ctx, x + 7, y + 7 + walkY, 1, 1, '#ef4444');
    }

    // Body -- ornate plate armor with engraved detail
    px(ctx, x + 4, y + 6 + walkY, 8, 5, '#9ca3af');
    px(ctx, x + 5, y + 6 + walkY, 6, 1, '#d1d5db'); // chest highlight
    px(ctx, x + 6, y + 8 + walkY, 4, 1, '#fbbf24'); // gold belt
    px(ctx, x + 7, y + 7 + walkY, 1, 3, '#6b7280'); // center line
    // Armor engravings
    px(ctx, x + 5, y + 7 + walkY, 1, 1, '#b0b8c4');
    px(ctx, x + 10, y + 7 + walkY, 1, 1, '#b0b8c4');
    // Chest emblem glow
    ctx.globalAlpha = 0.3 + Math.sin(frame * 0.3) * 0.1;
    px(ctx, x + 7, y + 6 + walkY, 2, 1, '#fbbf24');
    ctx.globalAlpha = 1;

    // Shield on arm -- ornate with lion emblem and animated light
    const glintOffset = (frame % 8);
    if (isHoriz) {
      const sx2 = facingRight ? x + 0 : x + 12;
      px(ctx, sx2, y + 5 + walkY, 4, 7, '#6b7280');
      px(ctx, sx2, y + 6 + walkY, 4, 5, '#3b82f6');
      // Shield emblem (ornate cross)
      px(ctx, sx2 + 1, y + 7 + walkY, 2, 1, '#fbbf24');
      px(ctx, sx2 + 1, y + 6 + walkY, 1, 3, '#fbbf24');
      // Shield center gem
      px(ctx, sx2 + 1, y + 8 + walkY, 1, 1, '#ef4444');
      // Shield rim — double line
      px(ctx, sx2, y + 5 + walkY, 4, 1, '#4b5563');
      px(ctx, sx2, y + 11 + walkY, 4, 1, '#4b5563');
      px(ctx, sx2, y + 5 + walkY, 1, 7, '#374151');
      // Reflect light -- moving highlight
      const reflectY = y + 6 + walkY + (glintOffset % 4);
      if (reflectY < y + 10 + walkY) {
        px(ctx, sx2 + 3, reflectY, 1, 1, '#93c5fd');
      }
      // Shield glow when attacking
      if (attacking) {
        ctx.globalAlpha = 0.2;
        px(ctx, sx2 - 1, y + 4 + walkY, 6, 9, '#60a5fa');
        ctx.globalAlpha = 1;
      }
    } else {
      px(ctx, x + 2, y + 5 + walkY, 3, 6, '#6b7280');
      px(ctx, x + 2, y + 6 + walkY, 3, 4, '#3b82f6');
      px(ctx, x + 3, y + 7 + walkY, 1, 2, '#fbbf24');
      px(ctx, x + 2, y + 8 + walkY, 3, 1, '#fbbf24');
      px(ctx, x + 4, y + 7 + walkY + (glintOffset % 3), 1, 1, '#93c5fd');
    }

    // Right arm (sword arm) with swing
    if (!isHoriz) {
      px(ctx, x + 12, y + 6 + walkY + armSwing * 0.3, 2, 5, '#9ca3af');
    } else {
      const swordArmX = facingRight ? x + 12 : x + 2;
      px(ctx, swordArmX, y + 6 + walkY, 2, 5, '#9ca3af');
    }

    // Imposing sword with rune channel and fire glint
    const swordGlintPos = (frame % 12);
    if (attacking) {
      const slashDir = facingRight ? 1 : -1;
      if (isHoriz) {
        const bladeX = facingRight ? x + 14 : x - 7;
        px(ctx, bladeX, y + 3 + walkY, 7, 1, '#d1d5db');
        px(ctx, bladeX, y + 4 + walkY, 7, 1, '#e5e7eb');
        px(ctx, bladeX, y + 5 + walkY, 7, 1, '#b0b0b0');
        // Rune channel on blade (glowing red)
        px(ctx, bladeX + 1, y + 4 + walkY, 4, 1, '#ef4444');
        ctx.globalAlpha = 0.4;
        px(ctx, bladeX + 1, y + 3 + walkY, 4, 1, '#fca5a5');
        ctx.globalAlpha = 1;
        // Sword glint
        px(ctx, bladeX + (swordGlintPos % 6), y + 3 + walkY, 1, 1, '#ffffff');
        // Motion trail -- layered
        ctx.globalAlpha = 0.5;
        px(ctx, bladeX - slashDir * 2, y + 2 + walkY, 9, 4, '#ffffff');
        ctx.globalAlpha = 0.3;
        px(ctx, bladeX - slashDir * 4, y + 1 + walkY, 11, 6, '#fecaca');
        ctx.globalAlpha = 0.12;
        px(ctx, bladeX - slashDir * 6, y + 0 + walkY, 13, 7, '#ef4444');
        ctx.globalAlpha = 1;
      } else {
        const bladeY = facingUp ? y - 5 : y + 14;
        px(ctx, x + 9, bladeY, 1, 7, '#d1d5db');
        px(ctx, x + 10, bladeY, 1, 7, '#e5e7eb');
        px(ctx, x + 11, bladeY, 1, 7, '#b0b0b0');
        px(ctx, x + 10, bladeY + 1, 1, 4, '#ef4444');
        px(ctx, x + 10, bladeY + (swordGlintPos % 6), 1, 1, '#ffffff');
        ctx.globalAlpha = 0.4;
        px(ctx, x + 7, bladeY, 7, 7, '#ffffff');
        ctx.globalAlpha = 0.15;
        px(ctx, x + 6, bladeY - 1, 9, 9, '#fecaca');
        ctx.globalAlpha = 1;
      }
      px(ctx, x + 11, y + 10 + walkY, 2, 2, '#78350f');
      // Crossguard glow
      px(ctx, x + 10, y + 10 + walkY, 1, 1, '#fbbf24');
      px(ctx, x + 13, y + 10 + walkY, 1, 1, '#fbbf24');
    } else {
      // Idle: sword with rune glow
      px(ctx, x + 12, y + 3 + walkY, 1, 8, '#9ca3af');
      px(ctx, x + 13, y + 3 + walkY, 1, 8, '#d1d5db');
      px(ctx, x + 14, y + 4 + walkY, 1, 6, '#b0b0b0');
      // Rune channel — glowing red pulse
      const runePulse = 0.3 + Math.sin(frame * 0.25) * 0.2;
      ctx.globalAlpha = runePulse;
      px(ctx, x + 13, y + 4 + walkY, 1, 4, '#ef4444');
      ctx.globalAlpha = 1;
      px(ctx, x + 13, y + 2 + walkY, 1, 1, '#e5e7eb');
      // Glint moves along blade
      const glintY = y + 3 + walkY + (swordGlintPos % 7);
      if (glintY < y + 10 + walkY) {
        px(ctx, x + 13, glintY, 1, 1, '#ffffff');
      }
      // Crossguard with gold
      px(ctx, x + 11, y + 10 + walkY, 4, 1, '#fbbf24');
      px(ctx, x + 12, y + 11 + walkY, 2, 1, '#78350f');
    }

    // Head
    px(ctx, x + 5, y + 2, 6, 4, '#fcd5b4');
    // Horned helmet — more imposing
    px(ctx, x + 4, y + 1, 8, 2, '#6b7280');
    px(ctx, x + 5, y + 0, 6, 1, '#9ca3af');
    // Horns — larger with gold tips
    px(ctx, x + 3, y - 1, 2, 3, '#fbbf24');
    px(ctx, x + 11, y - 1, 2, 3, '#fbbf24');
    px(ctx, x + 3, y - 2, 1, 1, '#fde68a');
    px(ctx, x + 12, y - 2, 1, 1, '#fde68a');

    // Red feather plume — fuller
    const plumeWave = Math.sin(frame * 0.6) * 0.5;
    px(ctx, x + 5, y - 2, 6, 1, '#dc2626');
    px(ctx, x + 6, y - 3, 4, 1, '#ef4444');
    px(ctx, x + 7, y - 4 + plumeWave, 2, 1, '#f87171');
    px(ctx, x + 8, y - 5 + plumeWave, 1, 1, '#fca5a5');
    // Plume side feather wisps
    px(ctx, x + 5, y - 3, 1, 1, '#b91c1c');
    px(ctx, x + 10, y - 3, 1, 1, '#b91c1c');

    // Helmet visor slit with glow
    if (facing !== 'up') {
      px(ctx, x + 5, y + 2, 6, 1, '#4b5563');
      px(ctx, x + 6, y + 2, 4, 1, '#374151');
      // Red eye glow through visor
      ctx.globalAlpha = 0.5 + Math.sin(frame * 0.4) * 0.2;
      px(ctx, x + 6, y + 2, 1, 1, '#ef4444');
      px(ctx, x + 9, y + 2, 1, 1, '#ef4444');
      ctx.globalAlpha = 1;
    }

    // Face — visible below visor
    if (facing !== 'up') {
      px(ctx, x + 6, y + 3, 1, 1, '#1a1a2e');
      px(ctx, x + 9, y + 3, 1, 1, '#1a1a2e');
    }

    // Shoulder pads (gold trim) — larger, more prominent
    px(ctx, x + 3, y + 5 + walkY, 2, 2, '#fbbf24');
    px(ctx, x + 11, y + 5 + walkY, 2, 2, '#fbbf24');
    px(ctx, x + 3, y + 5 + walkY, 1, 1, '#fde68a');
    px(ctx, x + 12, y + 5 + walkY, 1, 1, '#fde68a');
    // Shoulder spikes
    px(ctx, x + 2, y + 4 + walkY, 1, 2, '#d97706');
    px(ctx, x + 13, y + 4 + walkY, 1, 2, '#d97706');

    // Idle animation: cape flutter + armor glow
    if (!attacking) {
      const capeFlutter = Math.sin(frame * 0.4) * 0.8;
      px(ctx, x + 4, y + 12 + walkY + capeFlutter, 1, 1, '#991b1b');
      px(ctx, x + 11, y + 12 + walkY - capeFlutter, 1, 1, '#991b1b');
      // Subtle armor edge glow
      ctx.globalAlpha = 0.1 + Math.sin(frame * 0.2) * 0.05;
      px(ctx, x + 4, y + 5 + walkY, 1, 6, '#d1d5db');
      px(ctx, x + 11, y + 5 + walkY, 1, 6, '#d1d5db');
      ctx.globalAlpha = 1;
    }

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
    const facingRight = facing === 'right';
    const robeBillow = Math.sin(frame * 0.6) * 1;

    // Flowing purple robe — layered with inner/outer folds
    px(ctx, x + 3, y + 7 + walkY, 10, 6, '#7c3aed');
    px(ctx, x + 2 + robeBillow * 0.3, y + 10 + walkY, 12, 3, '#6d28d9');
    px(ctx, x + 4, y + 13, 3, 2, '#5b21b6');
    px(ctx, x + 9, y + 13, 3, 2, '#5b21b6');
    // Inner robe fold (depth)
    px(ctx, x + 7, y + 10 + walkY, 2, 3, '#4c1d95');
    // Robe edge detail
    px(ctx, x + 2, y + 12 + walkY, 1, 1, '#5b21b6');
    px(ctx, x + 13, y + 12 + walkY, 1, 1, '#5b21b6');
    // Robe hem glow
    ctx.globalAlpha = 0.15;
    px(ctx, x + 3, y + 14, 10, 1, '#c4b5fd');
    ctx.globalAlpha = 1;

    // Runic patterns — animated glowing runes
    const runeShift = (frame % 12) < 6 ? 0 : 1;
    const runeGlow = 0.5 + Math.sin(frame * 0.2) * 0.3;
    ctx.globalAlpha = runeGlow;
    px(ctx, x + 5 + runeShift, y + 9 + walkY, 1, 1, '#ddd6fe');
    px(ctx, x + 7 - runeShift, y + 10 + walkY, 1, 1, '#e9d5ff');
    px(ctx, x + 10 + runeShift, y + 9 + walkY, 1, 1, '#ddd6fe');
    px(ctx, x + 4, y + 11 + walkY, 1, 1, '#c4b5fd');
    px(ctx, x + 8 + runeShift, y + 11 + walkY, 1, 1, '#c4b5fd');
    px(ctx, x + 11, y + 10 + walkY, 1, 1, '#ddd6fe');
    ctx.globalAlpha = 1;

    // Constellation pattern — shimmering stars on robe
    const starPulse = 0.3 + Math.sin(frame * 0.15) * 0.3;
    ctx.globalAlpha = starPulse;
    px(ctx, x + 4, y + 8 + walkY, 1, 1, '#fef3c7');
    px(ctx, x + 6, y + 12 + walkY, 1, 1, '#fef3c7');
    px(ctx, x + 9, y + 9 + walkY, 1, 1, '#fef3c7');
    px(ctx, x + 12, y + 11 + walkY, 1, 1, '#fef3c7');
    ctx.globalAlpha = starPulse * 0.5;
    px(ctx, x + 5, y + 10 + walkY, 1, 1, '#ffffff');
    px(ctx, x + 10, y + 8 + walkY, 1, 1, '#ffffff');
    ctx.globalAlpha = 1;
    // Constellation lines
    const constFrame = frame % 20;
    if (constFrame < 10) {
      ctx.globalAlpha = 0.12;
      px(ctx, x + 5, y + 9 + walkY, 1, 1, '#ddd6fe');
      px(ctx, x + 7, y + 10 + walkY, 1, 1, '#ddd6fe');
      px(ctx, x + 10, y + 10 + walkY, 1, 1, '#ddd6fe');
      ctx.globalAlpha = 1;
    }

    // Body with arcane collar
    px(ctx, x + 4, y + 5 + walkY, 8, 3, '#8b5cf6');
    px(ctx, x + 5, y + 5 + walkY, 6, 1, '#a78bfa');
    // Collar gems
    px(ctx, x + 5, y + 5 + walkY, 1, 1, '#fbbf24');
    px(ctx, x + 10, y + 5 + walkY, 1, 1, '#fbbf24');

    // Arms (robe sleeves with arcane trim)
    px(ctx, x + 2, y + 6 + walkY, 2, 4, '#7c3aed');
    px(ctx, x + 12, y + 6 + walkY, 2, 4, '#7c3aed');
    // Arcane cuff glow
    px(ctx, x + 2, y + 9 + walkY, 2, 1, '#a78bfa');
    px(ctx, x + 12, y + 9 + walkY, 2, 1, '#a78bfa');

    // Staff with glowing/pulsing crystal
    const staffX = facingRight ? x + 13 : x + 1;
    const crystalPulse = 0.5 + Math.sin(frame * 0.4) * 0.5;
    const crystalGlow = crystalPulse > 0.7;
    if (attacking) {
      // Staff raised, magic circle beneath
      px(ctx, staffX, y - 2, 1, 14, '#78350f');
      // Staff ring decoration
      px(ctx, staffX - 1, y + 3, 3, 1, '#fbbf24');
      // Crystal housing
      px(ctx, staffX - 1, y - 3, 3, 3, '#a78bfa');
      px(ctx, staffX, y - 2, 1, 1, crystalGlow ? '#ffffff' : '#ddd6fe');
      // Crystal rays
      ctx.globalAlpha = crystalPulse * 0.4;
      px(ctx, staffX - 2, y - 3, 5, 1, '#c4b5fd');
      px(ctx, staffX, y - 4, 1, 2, '#ddd6fe');
      ctx.globalAlpha = 1;
      // Magic circle beneath player — double ring
      ctx.globalAlpha = 0.4 + Math.sin(frame * 0.5) * 0.2;
      px(ctx, x + 1, y + 13, 14, 1, '#a78bfa');
      px(ctx, x + 2, y + 14, 12, 1, '#8b5cf6');
      px(ctx, x + 0, y + 12, 1, 2, '#a78bfa');
      px(ctx, x + 15, y + 12, 1, 2, '#a78bfa');
      // Inner circle symbols
      ctx.globalAlpha = 0.3;
      px(ctx, x + 4, y + 13, 1, 1, '#fef3c7');
      px(ctx, x + 7, y + 14, 1, 1, '#fef3c7');
      px(ctx, x + 11, y + 13, 1, 1, '#fef3c7');
      ctx.globalAlpha = 1;
    } else {
      px(ctx, staffX, y + 1, 1, 12, '#78350f');
      // Staff ring
      px(ctx, staffX - 1, y + 5, 3, 1, '#fbbf24');
      // Crystal
      px(ctx, staffX - 1, y + 0, 3, 2, '#a78bfa');
      px(ctx, staffX, y + 0, 1, 1, crystalGlow ? '#ffffff' : '#ddd6fe');
      if (crystalGlow) {
        ctx.globalAlpha = 0.3;
        px(ctx, staffX - 1, y - 1, 3, 1, '#c4b5fd');
        px(ctx, staffX, y - 1, 1, 1, '#ddd6fe');
        ctx.globalAlpha = 1;
      }
    }

    // Magic particle trail when moving
    if (walkY !== 0) {
      ctx.globalAlpha = 0.4;
      const trailX = x + 6 + Math.sin(frame * 0.7) * 3;
      const trailY = y + 14 + Math.cos(frame * 0.5) * 1;
      px(ctx, trailX, trailY, 1, 1, '#c4b5fd');
      px(ctx, trailX + 2, trailY - 1, 1, 1, '#a78bfa');
      px(ctx, trailX - 1, trailY + 1, 1, 1, '#8b5cf6');
      ctx.globalAlpha = 1;
    }

    // White beard — flowing
    if (facing !== 'up') {
      px(ctx, x + 6, y + 5, 4, 2, '#e5e7eb');
      px(ctx, x + 7, y + 6, 2, 1, '#d1d5db');
      px(ctx, x + 7, y + 7 + walkY, 2, 1, '#d1d5db');
    }

    // Head
    px(ctx, x + 5, y + 2, 6, 4, '#fcd5b4');

    // Glowing eyes — more intense
    if (facing !== 'up') {
      const eyeColor = crystalGlow ? '#e9d5ff' : '#c4b5fd';
      px(ctx, x + 6, y + 3, 1, 1, eyeColor);
      px(ctx, x + 9, y + 3, 1, 1, eyeColor);
      // Eye glow aura
      if (crystalGlow) {
        ctx.globalAlpha = 0.2;
        px(ctx, x + 5, y + 3, 1, 1, '#c4b5fd');
        px(ctx, x + 10, y + 3, 1, 1, '#c4b5fd');
        ctx.globalAlpha = 1;
      }
    }

    // Pointed wizard hat — taller with star at tip
    px(ctx, x + 4, y + 1, 8, 2, '#7c3aed');
    px(ctx, x + 5, y + 0, 6, 1, '#6d28d9');
    px(ctx, x + 6, y - 1, 4, 1, '#5b21b6');
    px(ctx, x + 7, y - 2, 2, 1, '#4c1d95');
    px(ctx, x + 7, y - 3, 2, 1, '#3b0764');
    px(ctx, x + 8, y - 4, 1, 1, '#4c1d95');
    // Hat fold
    px(ctx, x + 9, y - 4, 1, 1, '#5b21b6');
    px(ctx, x + 10, y - 3, 1, 1, '#6d28d9');
    // Hat star at tip
    ctx.globalAlpha = 0.5 + Math.sin(frame * 0.5) * 0.3;
    px(ctx, x + 8, y - 5, 1, 1, '#fef3c7');
    ctx.globalAlpha = 1;
    // Hat band with gems
    px(ctx, x + 4, y + 0, 8, 1, '#451a03');
    px(ctx, x + 7, y + 0, 2, 1, crystalGlow ? '#fde68a' : '#fbbf24');
    // Extra hat gems
    px(ctx, x + 5, y + 0, 1, 1, '#c4b5fd');
    px(ctx, x + 10, y + 0, 1, 1, '#c4b5fd');

    // Staff crystal sparkle orbit
    if (!attacking) {
      const sparkleAngle1 = frame * 0.25;
      const sparkleAngle2 = frame * 0.25 + Math.PI;
      const sparkleAngle3 = frame * 0.25 + Math.PI * 0.5;
      const orbitR = 2.5;
      const scx = (facingRight ? x + 14 : x + 2);
      const scy = y + 0;
      ctx.globalAlpha = 0.5 + Math.sin(frame * 0.4) * 0.3;
      px(ctx, scx + Math.cos(sparkleAngle1) * orbitR, scy + Math.sin(sparkleAngle1) * orbitR, 1, 1, '#fef3c7');
      ctx.globalAlpha = 0.3 + Math.sin(frame * 0.3) * 0.2;
      px(ctx, scx + Math.cos(sparkleAngle2) * orbitR, scy + Math.sin(sparkleAngle2) * orbitR, 1, 1, '#c4b5fd');
      ctx.globalAlpha = 0.2 + Math.sin(frame * 0.35) * 0.15;
      px(ctx, scx + Math.cos(sparkleAngle3) * orbitR * 0.7, scy + Math.sin(sparkleAngle3) * orbitR * 0.7, 1, 1, '#ddd6fe');
      ctx.globalAlpha = 1;
    }

    // Ambient magic aura beneath feet
    ctx.globalAlpha = 0.08 + Math.sin(frame * 0.15) * 0.04;
    px(ctx, x + 3, y + 14, 10, 1, '#a78bfa');
    ctx.globalAlpha = 1;

    // Staff crystal emits more particles when moving
    if (walkY !== 0) {
      ctx.globalAlpha = 0.35;
      const pX = (facingRight ? x + 13 : x + 1) + Math.sin(frame * 0.8) * 2;
      const pY = y - 1 + Math.cos(frame * 0.6) * 1.5;
      px(ctx, pX, pY, 1, 1, '#ddd6fe');
      px(ctx, pX + 1, pY - 1, 1, 1, '#c4b5fd');
      px(ctx, pX - 1, pY + 1, 1, 1, '#a78bfa');
      ctx.globalAlpha = 1;
    }

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
    const legPhaseA = LEG_CYCLE[frame % 4];
    const legPhaseB = LEG_CYCLE[(frame + 2) % 4];
    const facingRight = facing === 'right';
    const facingUp = facing === 'up';
    const armSwing = Math.sin(frame * 1.0) * 1;

    // Legs -- smooth stride with wrap detail
    px(ctx, x + 5, y + 11, 2, 3 + legPhaseA, '#374151');
    px(ctx, x + 9, y + 11, 2, 3 + legPhaseB, '#374151');
    // Leg wraps
    px(ctx, x + 5, y + 12, 2, 1, '#4b5563');
    px(ctx, x + 9, y + 12, 2, 1, '#4b5563');

    // Boots — ranger style with buckle
    px(ctx, x + 4, y + 13 + legPhaseA, 3, 2, '#78350f');
    px(ctx, x + 9, y + 13 + legPhaseB, 3, 2, '#78350f');
    px(ctx, x + 5, y + 13 + legPhaseA, 1, 1, '#92400e');
    px(ctx, x + 10, y + 13 + legPhaseB, 1, 1, '#92400e');
    // Boot buckle
    px(ctx, x + 4, y + 13 + legPhaseA, 1, 1, '#fbbf24');
    px(ctx, x + 9, y + 13 + legPhaseB, 1, 1, '#fbbf24');

    // Leather armor body — reinforced with studs
    px(ctx, x + 4, y + 6 + walkY, 8, 5, '#854d0e');
    px(ctx, x + 5, y + 6 + walkY, 6, 1, '#a16207');
    px(ctx, x + 6, y + 8 + walkY, 4, 1, '#713f12');
    // Leather stitch pattern
    px(ctx, x + 5, y + 7 + walkY, 1, 1, '#713f12');
    px(ctx, x + 7, y + 7 + walkY, 1, 1, '#713f12');
    px(ctx, x + 9, y + 7 + walkY, 1, 1, '#713f12');
    px(ctx, x + 10, y + 9 + walkY, 1, 1, '#713f12');
    // Metal studs on chest
    px(ctx, x + 5, y + 8 + walkY, 1, 1, '#9ca3af');
    px(ctx, x + 10, y + 8 + walkY, 1, 1, '#9ca3af');
    // Belt buckle
    px(ctx, x + 7, y + 8 + walkY, 2, 1, '#fbbf24');

    // Green hooded cloak — flowing with wind effect
    const windWave = Math.sin(frame * 0.5) * 0.8;
    px(ctx, x + 3, y + 4 + walkY, 10, 4, '#15803d');
    px(ctx, x + 3, y + 8 + walkY, 2, 4, '#166534');
    px(ctx, x + 11, y + 8 + walkY, 2, 4, '#166534');
    // Cloak wind flutter
    if (!facingUp) {
      px(ctx, x + 3, y + 11 + walkY + windWave, 1, 2, '#0f5132');
      px(ctx, x + 12, y + 11 + walkY - windWave, 1, 2, '#0f5132');
    }
    // Cloak inner lining
    px(ctx, x + 4, y + 5 + walkY, 8, 1, '#064e3b');

    // Arms with bracers and swing
    px(ctx, x + 2, y + 6 + walkY + armSwing * 0.3, 2, 4, '#854d0e');
    px(ctx, x + 2, y + 9 + walkY, 2, 1, '#713f12');
    px(ctx, x + 12, y + 6 + walkY - armSwing * 0.3, 2, 4, '#854d0e');
    px(ctx, x + 12, y + 9 + walkY, 2, 1, '#713f12');
    // Bracer detail
    px(ctx, x + 2, y + 8 + walkY, 2, 1, '#5c3d1e');
    px(ctx, x + 12, y + 8 + walkY, 2, 1, '#5c3d1e');

    // Quiver on back — ornate with golden rim
    if (!facingUp) {
      px(ctx, x + 10, y + 3 + walkY, 3, 6, '#78350f');
      px(ctx, x + 10, y + 3 + walkY, 3, 1, '#fbbf24'); // gold rim
      if (attacking) {
        px(ctx, x + 11, y + 1 + walkY, 1, 1, '#9ca3af');
      } else {
        px(ctx, x + 10, y + 2 + walkY, 1, 1, '#9ca3af');
        px(ctx, x + 11, y + 1 + walkY, 1, 1, '#d1d5db');
        px(ctx, x + 12, y + 2 + walkY, 1, 1, '#9ca3af');
        // Arrow fletching — green feathers
        px(ctx, x + 10, y + 3 + walkY, 1, 1, '#4ade80');
        px(ctx, x + 12, y + 3 + walkY, 1, 1, '#4ade80');
      }
      px(ctx, x + 10, y + 4 + walkY, 1, 1, '#5c3d1e');
      px(ctx, x + 10, y + 8 + walkY, 3, 1, '#5c3d1e');
    }

    // Enchanted bow with rune markings
    const bowX = facingRight ? x + 14 : x + 0;
    const runeGlow = 0.3 + Math.sin(frame * 0.3) * 0.2;
    if (attacking) {
      // Drawn bow — full tension with energy
      px(ctx, bowX, y + 3 + walkY, 1, 8, '#78350f');
      px(ctx, bowX + (facingRight ? -1 : 1), y + 3 + walkY, 1, 1, '#78350f');
      px(ctx, bowX + (facingRight ? -1 : 1), y + 10 + walkY, 1, 1, '#78350f');
      // Rune markings glow bright when attacking
      ctx.globalAlpha = 0.8;
      px(ctx, bowX, y + 4 + walkY, 1, 1, '#4ade80');
      px(ctx, bowX, y + 6 + walkY, 1, 1, '#4ade80');
      px(ctx, bowX, y + 8 + walkY, 1, 1, '#4ade80');
      // Full bow glow
      ctx.globalAlpha = 0.25;
      px(ctx, bowX - 1, y + 3 + walkY, 3, 8, '#4ade80');
      ctx.globalAlpha = 1;
      // Bowstring pulled back — taut with energy
      const stringX = facingRight ? bowX - 2 : bowX + 2;
      px(ctx, stringX, y + 4 + walkY, 1, 6, '#fbbf24');
      px(ctx, stringX, y + 7 + walkY, 1, 1, '#fef3c7');
      // Arrow with energy trail
      const arrowDir = facingRight ? 1 : -1;
      px(ctx, bowX + arrowDir * 2, y + 7 + walkY, 4, 1, '#d1d5db');
      px(ctx, bowX + arrowDir * 5, y + 6 + walkY, 1, 3, '#9ca3af');
      // Energy trail on arrow
      ctx.globalAlpha = 0.3;
      px(ctx, bowX + arrowDir * 2, y + 6 + walkY, 4, 1, '#4ade80');
      px(ctx, bowX + arrowDir * 2, y + 8 + walkY, 4, 1, '#4ade80');
      ctx.globalAlpha = 0.15;
      px(ctx, bowX + arrowDir * 1, y + 5 + walkY, 3, 5, '#ffffff');
      ctx.globalAlpha = 1;
    } else {
      // Bow at rest — subtle rune glow pulse
      px(ctx, bowX, y + 4 + walkY, 1, 7, '#78350f');
      px(ctx, bowX + (facingRight ? 1 : -1), y + 4 + walkY, 1, 1, '#78350f');
      px(ctx, bowX + (facingRight ? 1 : -1), y + 10 + walkY, 1, 1, '#78350f');
      // Rune markings — pulsing
      ctx.globalAlpha = runeGlow;
      px(ctx, bowX, y + 5 + walkY, 1, 1, '#4ade80');
      px(ctx, bowX, y + 7 + walkY, 1, 1, '#4ade80');
      px(ctx, bowX, y + 9 + walkY, 1, 1, '#4ade80');
      ctx.globalAlpha = 1;
      // String
      px(ctx, bowX + (facingRight ? 1 : -1), y + 5 + walkY, 1, 5, '#fbbf24');
      px(ctx, bowX + (facingRight ? 1 : -1), y + 7 + walkY, 1, 1, '#fef3c7');
      if ((frame % 24) < 4) {
        px(ctx, bowX, y + 3 + walkY, 1, 1, '#92400e');
      }
    }

    // Head
    px(ctx, x + 5, y + 2, 6, 4, '#fcd5b4');
    // Hood — with feather decoration and fur trim
    px(ctx, x + 4, y + 1, 8, 2, '#15803d');
    px(ctx, x + 5, y + 0, 6, 1, '#166534');
    px(ctx, x + 6, y - 1, 4, 1, '#0f5132');
    // Hood feather — elegant
    const featherWave = Math.sin(frame * 0.5) * 0.3;
    px(ctx, x + 10, y - 1 + featherWave, 1, 2, '#4ade80');
    px(ctx, x + 11, y - 2 + featherWave, 1, 2, '#22c55e');
    px(ctx, x + 11, y - 3 + featherWave, 1, 1, '#86efac');
    // Hood stitching
    px(ctx, x + 6, y + 0, 1, 1, '#0f5132');
    px(ctx, x + 8, y + 0, 1, 1, '#0f5132');
    // Fur trim
    px(ctx, x + 4, y + 2, 1, 1, '#a8a29e');
    px(ctx, x + 11, y + 2, 1, 1, '#a8a29e');
    px(ctx, x + 5, y + 1, 1, 1, '#d6d3d1');
    px(ctx, x + 10, y + 1, 1, 1, '#d6d3d1');
    // Hood shadow on face
    if (facing !== 'up') {
      if (facingRight) {
        px(ctx, x + 5, y + 2, 2, 1, '#d4a574');
      } else if (facing === 'left') {
        px(ctx, x + 9, y + 2, 2, 1, '#d4a574');
      } else {
        px(ctx, x + 5, y + 2, 6, 1, '#d4a574');
      }
    }

    // Eyes — sharp green
    if (facing !== 'up') {
      px(ctx, x + 6, y + 3, 1, 1, '#065f46');
      px(ctx, x + 9, y + 3, 1, 1, '#065f46');
      // Eye glint
      ctx.globalAlpha = 0.4;
      px(ctx, x + 6, y + 3, 1, 1, '#4ade80');
      px(ctx, x + 9, y + 3, 1, 1, '#4ade80');
      ctx.globalAlpha = 1;
    }

    // Wind trail particles
    if (walkY !== 0) {
      ctx.globalAlpha = 0.2;
      const wX = x + 7 + Math.sin(frame * 0.6) * 3;
      px(ctx, wX, y + 14, 1, 1, '#86efac');
      px(ctx, wX + 2, y + 13, 1, 1, '#4ade80');
      ctx.globalAlpha = 1;
    }

    this.drawSpriteOutline(ctx, x, y);
  }

  private drawHealer(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    facing: Direction,
    attacking: boolean,
    frame: number,
  ): void {
    const walkY = WALK_OFFSETS[frame % 4];
    const facingRight = facing === 'right';
    const facingUp = facing === 'up';

    // Flowing white-gold robe — layered with inner folds
    px(ctx, x + 3, y + 7 + walkY, 10, 6, '#fefce8');
    px(ctx, x + 2, y + 10 + walkY, 12, 3, '#fef3c7');
    px(ctx, x + 4, y + 13, 3, 2, '#fde68a');
    px(ctx, x + 9, y + 13, 3, 2, '#fde68a');
    // Robe inner fold
    px(ctx, x + 7, y + 10 + walkY, 2, 3, '#fbbf24');
    // Robe edge — gold trim
    px(ctx, x + 2, y + 12 + walkY, 12, 1, '#d97706');
    px(ctx, x + 3, y + 14, 10, 1, '#f59e0b');
    // Robe hem glow
    ctx.globalAlpha = 0.12;
    px(ctx, x + 3, y + 14, 10, 1, '#fef3c7');
    ctx.globalAlpha = 1;

    // Holy symbol patterns — animated glowing runes
    const symbolShift = (frame % 12) < 6 ? 0 : 1;
    const symbolGlow = 0.4 + Math.sin(frame * 0.2) * 0.2;
    ctx.globalAlpha = symbolGlow;
    px(ctx, x + 5 + symbolShift, y + 9 + walkY, 1, 1, '#ffffff');
    px(ctx, x + 9 - symbolShift, y + 10 + walkY, 1, 1, '#ffffff');
    px(ctx, x + 4, y + 11 + walkY, 1, 1, '#fef3c7');
    px(ctx, x + 11, y + 10 + walkY, 1, 1, '#fef3c7');
    ctx.globalAlpha = 1;
    // Cross pattern on chest — larger, more ornate
    px(ctx, x + 6, y + 7 + walkY, 4, 1, '#f59e0b');
    px(ctx, x + 7, y + 6 + walkY, 2, 3, '#f59e0b');
    // Cross center gem
    px(ctx, x + 7, y + 7 + walkY, 2, 1, '#fbbf24');

    // Healing aura glow — dual layer
    const auraPulse = 0.12 + Math.sin(frame * 0.2) * 0.08;
    ctx.globalAlpha = auraPulse;
    px(ctx, x + 1, y + 5 + walkY, 14, 10, '#fef3c7');
    ctx.globalAlpha = auraPulse * 0.5;
    px(ctx, x + 0, y + 4 + walkY, 16, 12, '#fde68a');
    ctx.globalAlpha = 1;

    // Body — white robes with gold collar
    px(ctx, x + 4, y + 5 + walkY, 8, 3, '#fefce8');
    px(ctx, x + 5, y + 5 + walkY, 6, 1, '#ffffff'); // white collar
    // Gold collar trim
    px(ctx, x + 4, y + 5 + walkY, 1, 1, '#fbbf24');
    px(ctx, x + 11, y + 5 + walkY, 1, 1, '#fbbf24');

    // Arms — white sleeves with gold cuffs
    px(ctx, x + 2, y + 6 + walkY, 2, 4, '#fefce8');
    px(ctx, x + 12, y + 6 + walkY, 2, 4, '#fefce8');
    // Gold cuff trim
    px(ctx, x + 2, y + 9 + walkY, 2, 1, '#fbbf24');
    px(ctx, x + 12, y + 9 + walkY, 2, 1, '#fbbf24');

    // Holy staff with cross top
    const staffX = facingRight ? x + 13 : x + 1;
    const crystalPulse = 0.5 + Math.sin(frame * 0.35) * 0.5;
    const crystalGlow = crystalPulse > 0.7;
    if (attacking) {
      // Staff raised — holy cross top glowing
      px(ctx, staffX, y - 2, 1, 14, '#92400e');
      // Cross top
      px(ctx, staffX - 1, y - 4, 3, 1, '#fbbf24');
      px(ctx, staffX, y - 5, 1, 3, '#fbbf24');
      // Crystal at cross center
      px(ctx, staffX, y - 4, 1, 1, crystalGlow ? '#ffffff' : '#fef3c7');
      // Crystal rays
      ctx.globalAlpha = crystalPulse * 0.4;
      px(ctx, staffX - 2, y - 4, 5, 1, '#fde68a');
      px(ctx, staffX, y - 6, 1, 3, '#fde68a');
      ctx.globalAlpha = 1;
      // Healing circle beneath — ornate ring
      ctx.globalAlpha = 0.5 + Math.sin(frame * 0.5) * 0.2;
      px(ctx, x + 1, y + 13, 14, 1, '#fbbf24');
      px(ctx, x + 2, y + 14, 12, 1, '#f59e0b');
      px(ctx, x + 0, y + 12, 1, 2, '#fbbf24');
      px(ctx, x + 15, y + 12, 1, 2, '#fbbf24');
      // Inner healing symbols
      ctx.globalAlpha = 0.3;
      px(ctx, x + 4, y + 13, 1, 1, '#ffffff');
      px(ctx, x + 7, y + 14, 1, 1, '#ffffff');
      px(ctx, x + 11, y + 13, 1, 1, '#ffffff');
      ctx.globalAlpha = 1;
    } else {
      px(ctx, staffX, y + 1, 1, 12, '#92400e');
      // Staff ring decorations
      px(ctx, staffX - 1, y + 4, 3, 1, '#fbbf24');
      // Cross top
      px(ctx, staffX - 1, y - 1, 3, 1, '#fbbf24');
      px(ctx, staffX, y - 2, 1, 3, '#fbbf24');
      // Crystal
      px(ctx, staffX, y - 1, 1, 1, crystalGlow ? '#ffffff' : '#fef3c7');
      if (crystalGlow) {
        ctx.globalAlpha = 0.3;
        px(ctx, staffX - 1, y - 2, 3, 1, '#fde68a');
        px(ctx, staffX, y - 3, 1, 1, '#fef3c7');
        ctx.globalAlpha = 1;
      }
    }

    // Healing particles — golden sparkles
    if (walkY !== 0) {
      ctx.globalAlpha = 0.4;
      const trailX = x + 6 + Math.sin(frame * 0.7) * 3;
      const trailY = y + 14 + Math.cos(frame * 0.5) * 1;
      px(ctx, trailX, trailY, 1, 1, '#fde68a');
      px(ctx, trailX + 2, trailY - 1, 1, 1, '#fbbf24');
      px(ctx, trailX - 1, trailY + 1, 1, 1, '#f59e0b');
      ctx.globalAlpha = 1;
    }

    // Floating holy sparkles (always visible, gentle)
    const sp1 = frame * 0.15;
    const sp2 = frame * 0.15 + Math.PI * 0.66;
    const sp3 = frame * 0.15 + Math.PI * 1.33;
    ctx.globalAlpha = 0.3 + Math.sin(frame * 0.3) * 0.15;
    px(ctx, x + 2 + Math.cos(sp1) * 4, y + 3 + Math.sin(sp1) * 2, 1, 1, '#fef3c7');
    px(ctx, x + 12 + Math.cos(sp2) * 3, y + 4 + Math.sin(sp2) * 2, 1, 1, '#fbbf24');
    px(ctx, x + 7 + Math.cos(sp3) * 5, y + 1 + Math.sin(sp3) * 1, 1, 1, '#fde68a');
    ctx.globalAlpha = 1;

    // Head
    px(ctx, x + 5, y + 2, 6, 4, '#fcd5b4');

    // Eyes — warm amber glow
    if (!facingUp) {
      const eyeColor = crystalGlow ? '#fde68a' : '#92400e';
      px(ctx, x + 6, y + 3, 1, 1, eyeColor);
      px(ctx, x + 9, y + 3, 1, 1, eyeColor);
      // Eye glow aura
      if (crystalGlow) {
        ctx.globalAlpha = 0.2;
        px(ctx, x + 5, y + 3, 1, 1, '#fde68a');
        px(ctx, x + 10, y + 3, 1, 1, '#fde68a');
        ctx.globalAlpha = 1;
      }
    }

    // Hood/cowl — white with gold trim, more elaborate
    px(ctx, x + 4, y + 1, 8, 2, '#fefce8');
    px(ctx, x + 5, y + 0, 6, 1, '#fef3c7');
    px(ctx, x + 6, y - 1, 4, 1, '#fde68a');
    px(ctx, x + 7, y - 2, 2, 1, '#fbbf24');
    // Hood gold band
    px(ctx, x + 4, y + 0, 8, 1, '#d97706');
    // Gem on hood — prominent, pulsing
    px(ctx, x + 7, y + 0, 2, 1, crystalGlow ? '#ffffff' : '#fef3c7');
    // Hood side decoration
    px(ctx, x + 4, y + 1, 1, 1, '#fbbf24');
    px(ctx, x + 11, y + 1, 1, 1, '#fbbf24');

    // Halo — subtle glow above head
    ctx.globalAlpha = 0.15 + Math.sin(frame * 0.25) * 0.08;
    px(ctx, x + 5, y - 3, 6, 1, '#fde68a');
    px(ctx, x + 6, y - 4, 4, 1, '#fef3c7');
    ctx.globalAlpha = 1;

    // Staff crystal sparkle orbit — triple orbs
    if (!attacking) {
      const sparkleAngle1 = frame * 0.2;
      const sparkleAngle2 = frame * 0.2 + Math.PI;
      const sparkleAngle3 = frame * 0.2 + Math.PI * 0.5;
      const orbitR = 2.5;
      const scx = facingRight ? x + 14 : x + 2;
      const scy = y + 0;
      ctx.globalAlpha = 0.5 + Math.sin(frame * 0.35) * 0.3;
      px(ctx, scx + Math.cos(sparkleAngle1) * orbitR, scy + Math.sin(sparkleAngle1) * orbitR, 1, 1, '#fef3c7');
      ctx.globalAlpha = 0.3 + Math.sin(frame * 0.25) * 0.2;
      px(ctx, scx + Math.cos(sparkleAngle2) * orbitR, scy + Math.sin(sparkleAngle2) * orbitR, 1, 1, '#fbbf24');
      ctx.globalAlpha = 0.2 + Math.sin(frame * 0.3) * 0.15;
      px(ctx, scx + Math.cos(sparkleAngle3) * orbitR * 0.6, scy + Math.sin(sparkleAngle3) * orbitR * 0.6, 1, 1, '#ffffff');
      ctx.globalAlpha = 1;
    }

    // Ambient holy ground glow
    ctx.globalAlpha = 0.08 + Math.sin(frame * 0.15) * 0.04;
    px(ctx, x + 3, y + 14, 10, 1, '#fbbf24');
    ctx.globalAlpha = 1;

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
    attacking = false,
    isElite = false,
    shieldActive = false,
    phased = false,
    enraged = false,
    burnTicks = 0,
    freezeTicks = 0,
    poisonTicks = 0,
  ): void {
    const stats = MONSTER_STATS[type];
    const renderSize = Math.floor(TILE_SIZE * stats.size);

    // Elite scale-up: draw 15% larger from center
    if (isElite && !flashWhite) {
      const scale = 1.15;
      const cx = x + renderSize / 2;
      const cy = y + renderSize / 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      ctx.translate(-cx, -cy);
    }

    // Elliptical shadow beneath
    this.drawEntityShadow(ctx, x, y, renderSize, renderSize);

    // Phased monsters (wraith) — ghostly transparency
    if (phased) {
      ctx.globalAlpha = 0.3 + Math.sin(frame * 0.4) * 0.15;
    }

    if (flashWhite) {
      // White silhouette with red tint
      px(ctx, x + 2, y + 2, renderSize - 4, renderSize - 4, '#ff8888');
      ctx.globalAlpha = 0.3;
      px(ctx, x + 2, y + 2, renderSize - 4, renderSize - 4, '#ff0000');
      ctx.globalAlpha = 1;
      return;
    }

    // Cache monster sprites per animation state (including bosses now)
    const walkFrame = frame % 4;
    const atkFrame = attacking ? 1 : 0;
    const bossFrame = type.startsWith('boss_') ? (frame % 8) : walkFrame;
    const mCacheKey = `mon_${type}_${facing}_${atkFrame}_${bossFrame}`;
    const cachedMon = getCachedSprite(mCacheKey, renderSize, renderSize, (sprCtx) => {
      this.drawMonsterSprite(sprCtx, 0, 0, type, facing, frame, attacking);
    });

    // Elite gold outline — 4-offset silhouette pass (uses cached tinted variant)
    if (isElite) {
      const outlineKey = `mon_${type}_${facing}_${atkFrame}_${bossFrame}_goldOutline`;
      const outlineCanvas = getCachedSprite(outlineKey, renderSize, renderSize, (sprCtx) => {
        // Draw sprite then tint gold via source-atop
        this.drawMonsterSprite(sprCtx, 0, 0, type, facing, frame, attacking);
        sprCtx.globalCompositeOperation = 'source-atop';
        sprCtx.fillStyle = '#fbbf24';
        sprCtx.fillRect(0, 0, renderSize, renderSize);
      });
      const outlineAlpha = 0.38 + Math.sin(frame * 0.3) * 0.08;
      ctx.globalAlpha = outlineAlpha;
      ctx.drawImage(outlineCanvas, Math.floor(x) - 1, Math.floor(y));
      ctx.drawImage(outlineCanvas, Math.floor(x) + 1, Math.floor(y));
      ctx.drawImage(outlineCanvas, Math.floor(x), Math.floor(y) - 1);
      ctx.drawImage(outlineCanvas, Math.floor(x), Math.floor(y) + 1);
      ctx.globalAlpha = 1;
    }

    ctx.drawImage(cachedMon, Math.floor(x), Math.floor(y));

    // Reset phase transparency
    if (phased) {
      ctx.globalAlpha = 1;
    }

    // Shield visual overlay (Stone Warden)
    if (shieldActive) {
      const shieldPulse = Math.sin(frame * 0.3) * 0.08;
      const cx = x + renderSize / 2;
      const cy = y + renderSize / 2;
      ctx.globalAlpha = 0.25 + shieldPulse;
      ctx.beginPath();
      ctx.arc(cx, cy, renderSize * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = '#a3a3a3';
      ctx.fill();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = '#737373';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.globalAlpha = 1;
      // Rock fragments orbiting shield
      for (let i = 0; i < 4; i++) {
        const angle = (frame * 0.08) + (i * Math.PI / 2);
        const orbitR = renderSize * 0.5;
        const rx = cx + Math.cos(angle) * orbitR;
        const ry = cy + Math.sin(angle) * orbitR * 0.6;
        px(ctx, rx - 1, ry - 1, 2, 2, '#78716c');
        px(ctx, rx, ry, 1, 1, '#a8a29e');
      }
    }

    // Enraged visual (Forge Guardian) — red-hot glow
    if (enraged) {
      const enragePulse = Math.sin(frame * 0.5) * 0.06;
      ctx.globalAlpha = 0.15 + enragePulse;
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(x + 1, y + 1, renderSize - 2, renderSize - 2);
      ctx.globalAlpha = 1;
      // Ember particles from body
      for (let i = 0; i < 3; i++) {
        const ex = x + 3 + ((frame * 7 + i * 11) % (renderSize - 6));
        const ey = y - 1 - ((frame + i * 5) % 4);
        const ea = 0.6 - ((frame + i * 5) % 4) * 0.15;
        ctx.globalAlpha = Math.max(0, ea);
        px(ctx, ex, ey, 1, 1, i % 2 === 0 ? '#f97316' : '#fbbf24');
      }
      ctx.globalAlpha = 1;
    }

    // Elemental status overlays — burn/freeze/poison
    if (burnTicks > 0) {
      const bp = Math.sin(frame * 0.6) * 0.06;
      ctx.globalAlpha = 0.22 + bp;
      ctx.fillStyle = '#f97316';
      ctx.fillRect(x + 2, y + 2, renderSize - 4, renderSize - 4);
      ctx.globalAlpha = 1;
      // Flame licks around top
      for (let i = 0; i < 3; i++) {
        const fx = x + 3 + ((frame * 4 + i * 9) % (renderSize - 6));
        const fy = y - 2 - ((frame * 2 + i * 3) % 5);
        const fa = 0.7 - ((frame + i * 5) % 5) * 0.12;
        ctx.globalAlpha = Math.max(0, fa);
        px(ctx, fx, fy, 1, 2, i % 2 === 0 ? '#f97316' : '#fbbf24');
      }
      ctx.globalAlpha = 1;
    }
    if (freezeTicks > 0) {
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = '#7dd3fc';
      ctx.fillRect(x + 1, y + 1, renderSize - 2, renderSize - 2);
      ctx.globalAlpha = 0.9;
      // Crystal spikes
      px(ctx, x + 2, y + 2, 1, 2, '#e0f2fe');
      px(ctx, x + renderSize - 3, y + 2, 1, 2, '#e0f2fe');
      px(ctx, x + 2, y + renderSize - 3, 1, 2, '#bae6fd');
      px(ctx, x + renderSize - 3, y + renderSize - 3, 1, 2, '#bae6fd');
      // Center sparkle
      const ss = (frame % 6) < 3 ? 1 : 0;
      if (ss) px(ctx, x + renderSize / 2 - 1, y + renderSize / 2 - 1, 2, 2, '#ffffff');
      ctx.globalAlpha = 1;
    }
    if (poisonTicks > 0) {
      const pp = Math.sin(frame * 0.45) * 0.06;
      ctx.globalAlpha = 0.2 + pp;
      ctx.fillStyle = '#a78bfa';
      ctx.fillRect(x + 2, y + 2, renderSize - 4, renderSize - 4);
      ctx.globalAlpha = 1;
      // Drip particles
      const dripY = (frame * 2) % 8;
      ctx.globalAlpha = 0.6 - dripY * 0.06;
      px(ctx, x + 3 + (frame % 3) * 4, y + renderSize - 2 + dripY, 1, 2, '#c4b5fd');
      ctx.globalAlpha = 1;
    }

    // Elite golden tint overlay (applied on main ctx after cached/direct draw)
    if (isElite) {
      ctx.globalAlpha = 0.12 + Math.sin(frame * 0.3) * 0.05;
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(x + 2, y + 2, renderSize - 4, renderSize - 4);
      ctx.globalAlpha = 1;
      ctx.restore(); // matches save() at start of drawMonster for elite scaling
    }
  }

  /** Internal: draw the actual monster sprite pixels */
  private drawMonsterSprite(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    type: MonsterType,
    facing: Direction,
    frame: number,
    attacking: boolean,
  ): void {
    switch (type) {
      case 'skeleton': this.drawSkeleton(ctx, x, y, facing, frame, attacking); break;
      case 'slime': this.drawSlime(ctx, x, y, frame); break;
      case 'bat': this.drawBat(ctx, x, y, frame); break;
      case 'goblin': this.drawGoblin(ctx, x, y, facing, frame, attacking); break;
      case 'rat': this.drawRat(ctx, x, y, facing, frame); break;
      case 'spider': this.drawSpider(ctx, x, y, facing, frame); break;
      case 'wraith': this.drawWraith(ctx, x, y, facing, frame); break;
      case 'mushroom': this.drawMushroom(ctx, x, y, facing, frame); break;
      case 'gargoyle': this.drawGargoyle(ctx, x, y, facing, frame); break;
      case 'dark_knight': this.drawDarkKnight(ctx, x, y, facing, frame, attacking); break;
      case 'phantom': this.drawPhantom(ctx, x, y, facing, frame); break;
      case 'lava_slime': this.drawLavaSlime(ctx, x, y, frame); break;
      case 'boss_spider_queen': this.drawBossSpiderQueen(ctx, x, y, facing, frame); break;
      case 'boss_demon': this.drawBossDemon(ctx, x, y, facing, frame); break;
      case 'boss_forge_guardian': this.drawBossForgeGuardian(ctx, x, y, facing, frame); break;
      case 'boss_stone_warden': this.drawBossStoneWarden(ctx, x, y, facing, frame); break;
      case 'boss_flame_knight': this.drawBossFlameKnight(ctx, x, y, facing, frame); break;
    }
  }

  private drawSkeleton(ctx: CanvasRenderingContext2D, x: number, y: number, facing: Direction, frame: number, attacking = false): void {
    const wobble = WALK_OFFSETS[frame % 4];

    // Tattered cloth remnants hanging off bones
    ctx.globalAlpha = 0.6;
    px(ctx, x + 3, y + 7, 2, 4, '#4b5563');
    px(ctx, x + 11, y + 8, 2, 3, '#374151');
    px(ctx, x + 6, y + 6, 4, 1, '#4b5563');
    // Cloth sway
    const clothSway = Math.sin(frame * 0.5) * 0.5;
    px(ctx, x + 3 + clothSway, y + 11, 1, 2, '#374151');
    ctx.globalAlpha = 1;

    // Skull
    px(ctx, x + 4, y + 1, 8, 6, '#e5e7eb');
    px(ctx, x + 5, y + 0, 6, 1, '#d1d5db');
    px(ctx, x + 3, y + 2, 1, 4, '#d1d5db');
    px(ctx, x + 12, y + 2, 1, 4, '#d1d5db');
    // Skull shading -- darker around edges
    px(ctx, x + 4, y + 1, 1, 1, '#c4c4c4');
    px(ctx, x + 11, y + 1, 1, 1, '#c4c4c4');

    // Glowing red eye sockets with flickering intensity
    px(ctx, x + 5, y + 2, 2, 2, '#1a1a2e');
    px(ctx, x + 9, y + 2, 2, 2, '#1a1a2e');
    // Flickering glow intensity based on frame
    const flickerIntensity = 0.6 + Math.sin(frame * 1.5) * 0.4;
    const eyeColor = flickerIntensity > 0.8 ? '#ff6b6b' : '#ef4444';
    const eyeGlow = flickerIntensity > 0.8 ? '#ff0000' : '#dc2626';
    px(ctx, x + 5, y + 2, 1, 1, eyeColor);
    px(ctx, x + 6, y + 3, 1, 1, eyeGlow);
    px(ctx, x + 10, y + 2, 1, 1, eyeColor);
    px(ctx, x + 9, y + 3, 1, 1, eyeGlow);
    // Eye glow aura
    ctx.globalAlpha = flickerIntensity * 0.2;
    px(ctx, x + 4, y + 1, 3, 3, '#ff0000');
    px(ctx, x + 9, y + 1, 3, 3, '#ff0000');
    ctx.globalAlpha = 1;

    // Nose
    px(ctx, x + 7, y + 4, 2, 1, '#1a1a2e');

    // Jaw -- more pronounced clatter animation (3 states)
    const jawCycle = frame % 12;
    const jawOpen = jawCycle < 3 ? 2 : jawCycle < 6 ? 0 : jawCycle < 9 ? 1 : 0;
    px(ctx, x + 5, y + 5 + jawOpen, 6, 2, '#d1d5db');
    px(ctx, x + 6, y + 5, 4, 1, '#1a1a2e');
    // Teeth -- more detailed
    px(ctx, x + 6, y + 5 + jawOpen, 1, 1, '#ffffff');
    px(ctx, x + 7, y + 5 + jawOpen, 1, 1, '#e5e7eb');
    px(ctx, x + 8, y + 5 + jawOpen, 1, 1, '#ffffff');
    px(ctx, x + 9, y + 5 + jawOpen, 1, 1, '#e5e7eb');
    // Jaw bone articulation detail
    if (jawOpen > 0) {
      px(ctx, x + 5, y + 5, 1, 1, '#b0b0b0');
      px(ctx, x + 10, y + 5, 1, 1, '#b0b0b0');
    }

    // Ribcage -- more articulated with visible rib lines
    px(ctx, x + 5, y + 7, 6, 4, '#d1d5db');
    // Individual rib gaps -- darker ribs
    px(ctx, x + 6, y + 7, 1, 1, '#b0b0b0');
    px(ctx, x + 6, y + 8, 1, 1, '#1a1a2e');
    px(ctx, x + 8, y + 7, 1, 1, '#b0b0b0');
    px(ctx, x + 8, y + 8, 1, 1, '#1a1a2e');
    px(ctx, x + 6, y + 9, 4, 1, '#c4c4c4'); // lower rib
    px(ctx, x + 7, y + 9, 2, 1, '#1a1a2e'); // gap
    px(ctx, x + 6, y + 10, 4, 1, '#b0b0b0'); // spine
    // Bone color variation: lighter joints
    px(ctx, x + 5, y + 7, 1, 1, '#f0f0f0'); // shoulder joint
    px(ctx, x + 10, y + 7, 1, 1, '#f0f0f0');

    // Shield in left hand (small round buckler)
    px(ctx, x + 1, y + 7 + wobble, 3, 4, '#6b7280');
    px(ctx, x + 1, y + 8 + wobble, 3, 2, '#78716c');
    // Shield boss (center metal stud)
    px(ctx, x + 2, y + 8 + wobble, 1, 1, '#d1d5db');
    // Shield edge highlight
    px(ctx, x + 1, y + 7 + wobble, 1, 1, '#9ca3af');
    // Shield rim (darker)
    px(ctx, x + 0, y + 8 + wobble, 1, 2, '#4b5563');
    px(ctx, x + 4, y + 8 + wobble, 1, 2, '#4b5563');

    // Left arm (behind shield)
    px(ctx, x + 3, y + 7 + wobble, 2, 1, '#d1d5db');
    px(ctx, x + 3, y + 7 + wobble, 1, 1, '#f0f0f0'); // joint highlight
    // Right arm
    px(ctx, x + 11, y + 7 - wobble, 2, 1, '#d1d5db');
    px(ctx, x + 12, y + 7 - wobble, 1, 1, '#f0f0f0');
    px(ctx, x + 13, y + 8 - wobble, 1, 3, '#c4c4c4');
    px(ctx, x + 13, y + 10 - wobble, 1, 1, '#f0f0f0');

    // Rusty sword with notched blade edge
    px(ctx, x + 13, y + 5 - wobble, 1, 3, '#9ca3af');
    px(ctx, x + 14, y + 5 - wobble, 1, 3, '#78716c'); // rust
    // Notched edge detail
    px(ctx, x + 14, y + 6 - wobble, 1, 1, '#6b7280'); // notch
    px(ctx, x + 13, y + 4 - wobble, 1, 1, '#d1d5db'); // blade tip
    px(ctx, x + 13, y + 8 - wobble, 1, 1, '#78350f'); // handle
    px(ctx, x + 13, y + 9 - wobble, 1, 1, '#5c3d1e'); // pommel
    // Rust spots
    px(ctx, x + 14, y + 7 - wobble, 1, 1, '#92400e');

    // Attack animation: sword swing arc with trail -- more visible trail
    if (attacking) {
      ctx.globalAlpha = 0.5;
      px(ctx, x + 14, y + 3 - wobble, 2, 1, '#ffffff');
      px(ctx, x + 15, y + 4 - wobble, 1, 2, '#ffffff');
      ctx.globalAlpha = 0.3;
      px(ctx, x + 15, y + 2 - wobble, 2, 3, '#e5e7eb');
      ctx.globalAlpha = 0.15;
      px(ctx, x + 14, y + 1 - wobble, 3, 2, '#d1d5db');
      ctx.globalAlpha = 1;
    }
    // Sword swing trail (subtle motion blur even when not attacking, during movement)
    if (wobble !== 0) {
      ctx.globalAlpha = 0.12;
      px(ctx, x + 14, y + 4 - wobble, 1, 4, '#d1d5db');
      ctx.globalAlpha = 1;
    }

    // Legs (bone) with joint highlights
    px(ctx, x + 6, y + 11, 1, 3 + (frame % 2), '#c4c4c4');
    px(ctx, x + 6, y + 11, 1, 1, '#f0f0f0'); // knee joint
    px(ctx, x + 5, y + 13 + (frame % 2), 2, 1, '#b0b0b0');
    px(ctx, x + 9, y + 11, 1, 3 - (frame % 2), '#c4c4c4');
    px(ctx, x + 9, y + 11, 1, 1, '#f0f0f0'); // knee joint
    px(ctx, x + 9, y + 13 - (frame % 2), 2, 1, '#b0b0b0');

    this.drawSpriteOutline(ctx, x, y);
  }

  private drawSlime(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number): void {
    // Color variant based on position hash (cosmetic only)
    // Use x,y position to generate a stable hash for this slime instance
    const variantHash = tileHash(Math.floor(x), Math.floor(y));
    const colorVariant = variantHash % 3; // 0=green, 1=blue(ice), 2=red(fire)

    // Color palettes per variant
    let cOuter: string, cDark: string, cHighlight: string, cBubble: string, cBubbleLight: string, cTrail: string, cTrailDark: string, cMouth: string;
    if (colorVariant === 1) {
      // Ice slime (blue)
      cOuter = '#60a5fa'; cDark = '#3b82f6'; cHighlight = '#bfdbfe'; cBubble = '#dbeafe';
      cBubbleLight = '#eff6ff'; cTrail = '#3b82f6'; cTrailDark = '#2563eb'; cMouth = '#1e3a8a';
    } else if (colorVariant === 2) {
      // Fire slime (red)
      cOuter = '#f87171'; cDark = '#ef4444'; cHighlight = '#fecaca'; cBubble = '#fee2e2';
      cBubbleLight = '#fef2f2'; cTrail = '#ef4444'; cTrailDark = '#dc2626'; cMouth = '#7f1d1d';
    } else {
      // Normal green slime
      cOuter = '#4ade80'; cDark = '#22c55e'; cHighlight = '#86efac'; cBubble = '#d1fae5';
      cBubbleLight = '#bbf7d0'; cTrail = '#22c55e'; cTrailDark = '#16a34a'; cMouth = '#166534';
    }

    // Squash/stretch bouncing animation -- more dramatic
    const bouncePhase = (frame % 8) / 8;
    const squash = Math.sin(bouncePhase * Math.PI * 2);
    const baseW = 12;
    const baseH = 10;
    const w = Math.floor(baseW + squash * 3); // more dramatic squash
    const h = Math.floor(baseH - squash * 3);
    const bx = x + 8 - Math.floor(w / 2);
    const by = y + 14 - h;

    // Dripping effect at bottom (tiny droplet pixels)
    const dripPhase = (frame % 16);
    ctx.globalAlpha = 0.5;
    if (dripPhase < 8) {
      px(ctx, bx + 3, y + 14 + (dripPhase % 3), 1, 1, cOuter);
    }
    if (dripPhase > 4 && dripPhase < 12) {
      px(ctx, bx + w - 4, y + 14 + ((dripPhase + 2) % 3), 1, 1, cOuter);
    }
    ctx.globalAlpha = 1;

    // Small trail behind
    ctx.globalAlpha = 0.15;
    px(ctx, bx + 1, y + 14, w - 2, 1, cTrail);
    px(ctx, bx + 2, y + 15, w - 4, 1, cTrailDark);
    ctx.globalAlpha = 1;

    // Outer body -- more organic irregular edges
    px(ctx, bx, by + 1, w, h - 1, cOuter);
    px(ctx, bx + 1, by, w - 2, 1, cOuter); // rounded top
    px(ctx, bx + 1, by + h, w - 2, 1, cOuter); // rounded bottom
    // Irregular organic bumps
    px(ctx, bx - 1, by + 3, 1, 3, cOuter); // left bump
    px(ctx, bx + w, by + 4, 1, 2, cOuter); // right bump
    px(ctx, bx + 2, by - 1, 2, 1, cOuter); // top bump

    // Different color core vs outer layer -- darker center
    px(ctx, bx + 3, by + 3, w - 6, h - 5, cDark); // darker core

    // Inner lighter area (translucent highlight) -- lighter edges
    px(ctx, bx + 1, by + 1, 3, 2, cHighlight); // top-left highlight
    px(ctx, bx + w - 3, by + 2, 2, 2, cHighlight); // top-right highlight

    // Internal "bubbles" that move (2-3 dots that shift per frame)
    const bubble1X = bx + 3 + Math.sin(frame * 0.25 + 1.2) * 2;
    const bubble1Y = by + Math.floor(h * 0.4) + Math.cos(frame * 0.25) * 1.5;
    const bubble2X = bx + w - 5 + Math.cos(frame * 0.4 + 2.8) * 1.5;
    const bubble2Y = by + Math.floor(h * 0.6) + Math.sin(frame * 0.2) * 1;
    const bubble3X = bx + Math.floor(w * 0.5) + Math.sin(frame * 0.18 + 4.5) * 1;
    const bubble3Y = by + Math.floor(h * 0.3) + Math.cos(frame * 0.3) * 1;

    px(ctx, bubble1X, bubble1Y, 2, 2, cBubble);
    px(ctx, bubble2X, bubble2Y, 1, 1, cBubbleLight);
    px(ctx, bubble3X, bubble3Y, 1, 1, cBubble);

    // Bubble highlights on surface
    px(ctx, bx + 2, by + 1, 2, 2, cBubbleLight);
    px(ctx, bx + w - 4, by + 2, 1, 1, cBubbleLight);

    // Fire slime: ember particles floating up
    if (colorVariant === 2) {
      ctx.globalAlpha = 0.5;
      const emberX = bx + 3 + Math.sin(frame * 0.5) * 3;
      const emberY = by - 1 - (frame % 4);
      px(ctx, emberX, emberY, 1, 1, '#fbbf24');
      ctx.globalAlpha = 0.3;
      px(ctx, emberX + 3, emberY + 1, 1, 1, '#f97316');
      ctx.globalAlpha = 1;
    }
    // Ice slime: frost sparkles
    if (colorVariant === 1) {
      const sparkPos = frame % 16;
      if (sparkPos < 4) {
        ctx.globalAlpha = 0.6;
        px(ctx, bx + 1 + sparkPos, by - 1, 1, 1, '#ffffff');
        ctx.globalAlpha = 1;
      }
    }

    // Eyes (blink every ~3 seconds at 8fps)
    const blinkFrame = frame % 24;
    const isBlinking = blinkFrame === 0;
    const eyeY = by + Math.floor(h * 0.3);
    if (isBlinking) {
      px(ctx, bx + Math.floor(w * 0.25), eyeY, 2, 1, '#1a1a2e');
      px(ctx, bx + Math.floor(w * 0.6), eyeY, 2, 1, '#1a1a2e');
    } else {
      px(ctx, bx + Math.floor(w * 0.25), eyeY, 2, 2, '#1a1a2e');
      px(ctx, bx + Math.floor(w * 0.6), eyeY, 2, 2, '#1a1a2e');
      // Eye highlights
      px(ctx, bx + Math.floor(w * 0.25), eyeY, 1, 1, '#ffffff');
      px(ctx, bx + Math.floor(w * 0.6), eyeY, 1, 1, '#ffffff');
    }

    // Mouth (cute smile)
    px(ctx, bx + Math.floor(w * 0.35), eyeY + 3, Math.floor(w * 0.3), 1, cMouth);

    this.drawSpriteOutline(ctx, x, y);
  }

  private drawBat(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number): void {
    // Sine-based wing position for smoother animation
    const wingAngle = Math.sin(frame * 0.8) * 3;

    const bx = x + 3;
    const by = y + 3;

    // Shadow on the ground beneath
    ctx.globalAlpha = 0.15;
    const shadowY = by + 10;
    px(ctx, bx + 2, shadowY, 8, 1, '#000000');
    ctx.globalAlpha = 1;

    // Body (small furry oval with fur texture)
    px(ctx, bx + 4, by + 3, 4, 5, '#7c3aed');
    px(ctx, bx + 4, by + 2, 4, 1, '#8b5cf6');
    // Body fur texture (dithered darker pixels)
    px(ctx, bx + 5, by + 4, 1, 1, '#6d28d9');
    px(ctx, bx + 7, by + 5, 1, 1, '#6d28d9');
    px(ctx, bx + 4, by + 6, 1, 1, '#5b21b6');
    px(ctx, bx + 6, by + 3, 1, 1, '#6d28d9');

    // Head
    px(ctx, bx + 4, by + 1, 4, 3, '#6d28d9');

    // Ears (more detailed)
    px(ctx, bx + 4, by, 1, 2, '#5b21b6');
    px(ctx, bx + 7, by, 1, 2, '#5b21b6');
    // Ear inner color
    px(ctx, bx + 4, by + 1, 1, 1, '#8b5cf6');
    px(ctx, bx + 7, by + 1, 1, 1, '#8b5cf6');

    // Wings with membrane detail and vein lines
    // Left wing -- smooth sine position
    const lwUp = wingAngle;
    px(ctx, bx, by + 2 + lwUp, 4, 4, '#7c3aed');
    px(ctx, bx, by + 3 + lwUp, 1, 2, '#6d28d9'); // wing tip
    // Membrane veins
    px(ctx, bx + 1, by + 3 + lwUp, 1, 2, '#5b21b6');
    px(ctx, bx + 2, by + 2 + lwUp, 1, 3, '#5b21b6');
    // Extra vein detail
    px(ctx, bx, by + 4 + lwUp, 1, 1, '#4c1d95');
    px(ctx, bx + 1, by + 5 + lwUp, 1, 1, '#4c1d95');

    // Right wing -- opposite sine
    const rwUp = -wingAngle;
    px(ctx, bx + 8, by + 2 + rwUp, 4, 4, '#7c3aed');
    px(ctx, bx + 11, by + 3 + rwUp, 1, 2, '#6d28d9');
    px(ctx, bx + 10, by + 3 + rwUp, 1, 2, '#5b21b6');
    px(ctx, bx + 9, by + 2 + rwUp, 1, 3, '#5b21b6');
    // Extra vein detail
    px(ctx, bx + 11, by + 4 + rwUp, 1, 1, '#4c1d95');
    px(ctx, bx + 10, by + 5 + rwUp, 1, 1, '#4c1d95');

    // Red eyes -- intensity based on frame
    const eyeIntensity = 0.7 + Math.sin(frame * 0.6) * 0.3;
    const batEyeColor = eyeIntensity > 0.85 ? '#ff6b6b' : '#ef4444';
    px(ctx, bx + 5, by + 2, 1, 1, batEyeColor);
    px(ctx, bx + 6, by + 2, 1, 1, batEyeColor);
    // Eye glow
    ctx.globalAlpha = eyeIntensity * 0.15;
    px(ctx, bx + 4, by + 1, 4, 3, '#ff0000');
    ctx.globalAlpha = 1;

    // Visible fangs
    px(ctx, bx + 5, by + 4, 1, 1, '#ffffff');
    px(ctx, bx + 6, by + 4, 1, 1, '#ffffff');
    // Fang tips
    px(ctx, bx + 5, by + 5, 1, 1, '#e5e7eb');
  }

  private drawGoblin(ctx: CanvasRenderingContext2D, x: number, y: number, facing: Direction, frame: number, attacking = false): void {
    const wobble = WALK_OFFSETS[frame % 4];

    // Legs -- more muscular
    px(ctx, x + 5, y + 11, 2, 3, '#65a30d');
    px(ctx, x + 9, y + 11, 2, 3, '#65a30d');
    // Muscle detail
    px(ctx, x + 5, y + 11, 1, 1, '#4d7c0f');
    px(ctx, x + 10, y + 11, 1, 1, '#4d7c0f');
    // Feet
    px(ctx, x + 4, y + 13, 3, 2, '#4d7c0f');
    px(ctx, x + 9, y + 13, 3, 2, '#4d7c0f');

    // Body -- leather vest / belly armor
    px(ctx, x + 4, y + 7, 8, 4, '#78350f'); // vest
    px(ctx, x + 5, y + 7, 6, 1, '#92400e'); // vest collar
    // Leather vest stitching
    px(ctx, x + 4, y + 8, 1, 2, '#5c3d1e');
    px(ctx, x + 11, y + 8, 1, 2, '#5c3d1e');
    // Belt with buckle
    px(ctx, x + 4, y + 10, 8, 1, '#451a03');
    px(ctx, x + 7, y + 10, 2, 1, '#fbbf24'); // buckle

    // Green belly visible
    px(ctx, x + 6, y + 8, 4, 2, '#84cc16');

    // Big head -- more menacing posture
    px(ctx, x + 3, y + 1, 10, 7, '#84cc16');
    // War paint / tribal markings
    px(ctx, x + 4, y + 4, 1, 2, '#dc2626'); // left cheek mark
    px(ctx, x + 11, y + 4, 1, 2, '#dc2626'); // right cheek mark
    px(ctx, x + 7, y + 1, 2, 1, '#991b1b'); // forehead mark

    // Big pointed ears with earring
    px(ctx, x + 1, y + 2, 3, 4, '#84cc16');
    px(ctx, x + 0, y + 3, 1, 2, '#65a30d');
    // Left earring
    px(ctx, x + 0, y + 5, 1, 1, '#fbbf24');
    px(ctx, x + 12, y + 2, 3, 4, '#84cc16');
    px(ctx, x + 15, y + 3, 1, 2, '#65a30d');
    // Ear detail (inner ear)
    px(ctx, x + 2, y + 3, 1, 2, '#a3e635');
    px(ctx, x + 13, y + 3, 1, 2, '#a3e635');

    // Mean expression -- changes when attacking
    const angryBrowOffset = attacking ? -1 : 0;
    px(ctx, x + 5, y + 3, 2, 2, '#ffffff');
    px(ctx, x + 9, y + 3, 2, 2, '#ffffff');
    // Pupils
    px(ctx, x + 6, y + 4, 1, 1, '#1a1a2e');
    px(ctx, x + 9, y + 4, 1, 1, '#1a1a2e');
    // Angry brow -- more intense
    px(ctx, x + 5, y + 2 + angryBrowOffset, 2, 1, '#4d7c0f');
    px(ctx, x + 9, y + 2 + angryBrowOffset, 2, 1, '#4d7c0f');
    // Extra brow wrinkle
    px(ctx, x + 7, y + 2, 2, 1, '#65a30d');

    // Big nose
    px(ctx, x + 7, y + 4, 2, 2, '#65a30d');
    // Nostril
    px(ctx, x + 7, y + 5, 1, 1, '#4d7c0f');

    // Mouth with snaggle teeth
    px(ctx, x + 5, y + 6, 6, 1, '#1a1a2e');
    px(ctx, x + 6, y + 5, 1, 1, '#ffffff'); // snaggle tooth
    px(ctx, x + 9, y + 6, 1, 1, '#ffffff'); // another tooth
    px(ctx, x + 7, y + 6, 1, 1, '#e5e7eb'); // smaller tooth

    // Arms -- more muscular
    px(ctx, x + 2, y + 7 + wobble, 2, 4, '#84cc16');
    px(ctx, x + 2, y + 7 + wobble, 1, 1, '#65a30d'); // muscle shadow
    px(ctx, x + 12, y + 7 - wobble, 2, 4, '#84cc16');
    px(ctx, x + 13, y + 7 - wobble, 1, 1, '#65a30d');

    // Spiked club with blood stains in right hand
    px(ctx, x + 13, y + 4 - wobble, 2, 4, '#78350f');
    px(ctx, x + 13, y + 3 - wobble, 3, 2, '#92400e'); // club head (thicker)
    // Spikes on club
    px(ctx, x + 14, y + 2 - wobble, 1, 1, '#9ca3af'); // spike 1
    px(ctx, x + 15, y + 3 - wobble, 1, 1, '#9ca3af'); // spike 2
    px(ctx, x + 13, y + 2 - wobble, 1, 1, '#9ca3af'); // spike 3
    // Blood stains
    px(ctx, x + 14, y + 4 - wobble, 1, 1, '#dc2626');
    px(ctx, x + 15, y + 3 - wobble, 1, 1, '#991b1b');

    this.drawSpriteOutline(ctx, x, y);
  }

  private drawBossDemon(ctx: CanvasRenderingContext2D, x: number, y: number, facing: Direction, frame: number): void {
    // 2.5x size = ~40x40
    const pulse = Math.sin(frame * 0.3) * 3.5;
    const bx = x - 4;
    const by = y - 4;

    // Ground heat distortion (wavy dark pixels beneath)
    ctx.globalAlpha = 0.25;
    for (let i = 0; i < 8; i++) {
      const heatX = bx + 8 + i * 3 + Math.sin(frame * 0.4 + i) * 1.5;
      const heatY = by + 37 + Math.sin(frame * 0.3 + i * 0.5) * 1;
      px(ctx, heatX, heatY, 2, 1, '#451a03');
    }
    ctx.globalAlpha = 1;

    // Fire aura around body -- more dynamic
    ctx.globalAlpha = 0.12 + Math.sin(frame * 0.2) * 0.08;
    px(ctx, bx + 2, by + 2, 36, 36, '#ef4444');
    ctx.globalAlpha = 0.08;
    px(ctx, bx, by, 40, 40, '#f97316');
    ctx.globalAlpha = 0.05;
    px(ctx, bx - 1, by - 1, 42, 42, '#fbbf24');
    ctx.globalAlpha = 1;

    // Bat-like wings spread wide -- with veins and tears
    // Left wing
    px(ctx, bx + 1, by + 6 + pulse, 7, 18, '#7f1d1d');
    px(ctx, bx + 0, by + 8 + pulse, 2, 14, '#991b1b');
    // Wing membrane lines/veins -- more dramatic with branching
    px(ctx, bx + 2, by + 8 + pulse, 1, 14, '#450a0a');
    px(ctx, bx + 4, by + 7 + pulse, 1, 16, '#450a0a');
    px(ctx, bx + 6, by + 9 + pulse, 1, 12, '#450a0a');
    // Branching veins
    px(ctx, bx + 3, by + 10 + pulse, 1, 1, '#450a0a');
    px(ctx, bx + 1, by + 11 + pulse, 1, 1, '#450a0a');
    px(ctx, bx + 5, by + 12 + pulse, 1, 1, '#450a0a');
    px(ctx, bx + 3, by + 15 + pulse, 1, 1, '#450a0a');
    // Vein glow (blood pulsing through)
    const veinPulse = Math.sin(frame * 0.6) > 0.5;
    if (veinPulse) {
      ctx.globalAlpha = 0.3;
      px(ctx, bx + 2, by + 10 + pulse, 1, 3, '#dc2626');
      px(ctx, bx + 4, by + 12 + pulse, 1, 2, '#dc2626');
      ctx.globalAlpha = 1;
    }
    // Wing tears/holes
    px(ctx, bx + 3, by + 12 + pulse, 1, 2, '#000000');
    px(ctx, bx + 5, by + 16 + pulse, 1, 1, '#000000');
    px(ctx, bx + 1, by + 18 + pulse, 1, 1, '#000000');

    // Right wing
    px(ctx, bx + 32, by + 6 - pulse, 7, 18, '#7f1d1d');
    px(ctx, bx + 38, by + 8 - pulse, 2, 14, '#991b1b');
    px(ctx, bx + 37, by + 8 - pulse, 1, 14, '#450a0a');
    px(ctx, bx + 35, by + 7 - pulse, 1, 16, '#450a0a');
    px(ctx, bx + 33, by + 9 - pulse, 1, 12, '#450a0a');
    // Branching veins (right wing)
    px(ctx, bx + 36, by + 10 - pulse, 1, 1, '#450a0a');
    px(ctx, bx + 38, by + 11 - pulse, 1, 1, '#450a0a');
    px(ctx, bx + 34, by + 12 - pulse, 1, 1, '#450a0a');
    px(ctx, bx + 36, by + 15 - pulse, 1, 1, '#450a0a');
    if (veinPulse) {
      ctx.globalAlpha = 0.3;
      px(ctx, bx + 37, by + 10 - pulse, 1, 3, '#dc2626');
      px(ctx, bx + 35, by + 12 - pulse, 1, 2, '#dc2626');
      ctx.globalAlpha = 1;
    }
    // Wing tears
    px(ctx, bx + 36, by + 13 - pulse, 1, 2, '#000000');
    px(ctx, bx + 34, by + 18 - pulse, 1, 1, '#000000');
    px(ctx, bx + 38, by + 18 - pulse, 1, 1, '#000000');

    // Main body -- dark red, broader shoulders
    px(ctx, bx + 8, by + 8, 24, 22, '#dc2626'); // wider body
    // Shoulder bulk
    px(ctx, bx + 7, by + 10, 2, 6, '#dc2626');
    px(ctx, bx + 31, by + 10, 2, 6, '#dc2626');

    // Lava/fire cracks across body that pulse with light
    const crackGlow = 0.5 + Math.sin(frame * 0.5) * 0.5;
    const crackColor = crackGlow > 0.7 ? '#fbbf24' : '#f97316';
    px(ctx, bx + 14, by + 12, 1, 6, '#1a1a2e');
    px(ctx, bx + 14, by + 13, 1, 2, crackColor);
    px(ctx, bx + 25, by + 14, 1, 5, '#1a1a2e');
    px(ctx, bx + 25, by + 15, 1, 2, crackColor);
    px(ctx, bx + 18, by + 20, 4, 1, '#1a1a2e');
    px(ctx, bx + 19, by + 20, 2, 1, crackColor);
    // Additional cracks
    px(ctx, bx + 11, by + 18, 1, 4, '#1a1a2e');
    px(ctx, bx + 11, by + 19, 1, 1, crackColor);
    px(ctx, bx + 28, by + 16, 1, 3, '#1a1a2e');
    px(ctx, bx + 28, by + 17, 1, 1, crackColor);
    // Crack glow aura
    ctx.globalAlpha = crackGlow * 0.15;
    px(ctx, bx + 13, by + 12, 3, 6, '#f97316');
    px(ctx, bx + 24, by + 14, 3, 5, '#f97316');
    ctx.globalAlpha = 1;

    // Chest highlight
    px(ctx, bx + 14, by + 10, 12, 6, '#b91c1c');
    px(ctx, bx + 16, by + 11, 8, 4, '#991b1b');
    // Chest muscle definition
    px(ctx, bx + 19, by + 10, 1, 5, '#7f1d1d');

    // Demonic rune / pentagram on chest (simple geometric)
    const runeGlow = 0.3 + Math.sin(frame * 0.4) * 0.2;
    ctx.globalAlpha = runeGlow;
    // Inverted triangle rune
    px(ctx, bx + 18, by + 11, 4, 1, '#fbbf24');
    px(ctx, bx + 19, by + 12, 2, 1, '#fbbf24');
    px(ctx, bx + 17, by + 12, 1, 1, '#f97316');
    px(ctx, bx + 22, by + 12, 1, 1, '#f97316');
    px(ctx, bx + 18, by + 13, 4, 1, '#f97316');
    // Inner rune detail
    px(ctx, bx + 19, by + 11, 2, 1, '#fef3c7');
    ctx.globalAlpha = 1;

    // Head
    px(ctx, bx + 12, by + 2, 16, 10, '#dc2626');
    px(ctx, bx + 14, by + 1, 12, 2, '#b91c1c');

    // Huge horns curving upward -- with ridges/rings
    // Left horn
    px(ctx, bx + 9, by - 2, 4, 6, '#451a03');
    px(ctx, bx + 8, by - 4, 3, 3, '#78350f');
    px(ctx, bx + 7, by - 5, 2, 2, '#92400e');
    // Horn ridges
    px(ctx, bx + 9, by - 1, 4, 1, '#5c3d1e');
    px(ctx, bx + 8, by - 3, 3, 1, '#5c3d1e');
    // Right horn
    px(ctx, bx + 27, by - 2, 4, 6, '#451a03');
    px(ctx, bx + 29, by - 4, 3, 3, '#78350f');
    px(ctx, bx + 31, by - 5, 2, 2, '#92400e');
    // Horn ridges
    px(ctx, bx + 27, by - 1, 4, 1, '#5c3d1e');
    px(ctx, bx + 29, by - 3, 3, 1, '#5c3d1e');

    // Burning eyes -- cycling colors (red -> orange -> yellow)
    const eyeCycle = frame % 24;
    let demonEyeColor: string;
    let demonPupilColor: string;
    if (eyeCycle < 8) {
      demonEyeColor = '#ef4444'; // red
      demonPupilColor = '#dc2626';
    } else if (eyeCycle < 16) {
      demonEyeColor = '#f97316'; // orange
      demonPupilColor = '#ea580c';
    } else {
      demonEyeColor = '#fbbf24'; // yellow
      demonPupilColor = '#f59e0b';
    }
    px(ctx, bx + 15, by + 4, 3, 3, '#000000');
    px(ctx, bx + 22, by + 4, 3, 3, '#000000');
    px(ctx, bx + 15, by + 4, 2, 2, demonEyeColor);
    px(ctx, bx + 16, by + 5, 1, 1, demonPupilColor);
    px(ctx, bx + 23, by + 4, 2, 2, demonEyeColor);
    px(ctx, bx + 23, by + 5, 1, 1, demonPupilColor);
    // Eye fire flicker above
    ctx.globalAlpha = 0.4;
    px(ctx, bx + 15, by + 3, 2, 1, demonEyeColor);
    px(ctx, bx + 23, by + 3, 2, 1, demonEyeColor);
    ctx.globalAlpha = 1;

    // Mouth with fangs
    px(ctx, bx + 15, by + 8, 10, 3, '#1a1a2e');
    px(ctx, bx + 16, by + 10, 2, 2, '#ffffff');
    px(ctx, bx + 22, by + 10, 2, 2, '#ffffff');
    // Extra smaller fangs
    px(ctx, bx + 18, by + 10, 1, 1, '#e5e7eb');
    px(ctx, bx + 21, by + 10, 1, 1, '#e5e7eb');
    px(ctx, bx + 18, by + 9, 4, 1, '#ef4444'); // tongue/fire
    // Fire dripping from mouth
    ctx.globalAlpha = 0.5;
    px(ctx, bx + 19, by + 11, 2, 1, '#f97316');
    ctx.globalAlpha = 1;

    // Arms (muscular) -- broader shoulders
    px(ctx, bx + 5, by + 14, 5, 12, '#dc2626');
    px(ctx, bx + 6, by + 15, 3, 4, '#b91c1c'); // muscle highlight
    px(ctx, bx + 7, by + 20, 2, 2, '#b91c1c'); // forearm muscle
    px(ctx, bx + 30, by + 14, 5, 12, '#dc2626');
    px(ctx, bx + 31, by + 15, 3, 4, '#b91c1c');
    px(ctx, bx + 31, by + 20, 2, 2, '#b91c1c');

    // Claws -- more detailed
    px(ctx, bx + 4, by + 26, 2, 2, '#451a03');
    px(ctx, bx + 6, by + 26, 1, 3, '#451a03');
    px(ctx, bx + 7, by + 26, 1, 2, '#451a03');
    px(ctx, bx + 33, by + 26, 2, 2, '#451a03');
    px(ctx, bx + 32, by + 26, 1, 3, '#451a03');
    px(ctx, bx + 31, by + 26, 1, 2, '#451a03');

    // Fire particles dripping from hands
    const fireFrame = frame % 8;
    // Left hand fire
    ctx.globalAlpha = 0.7;
    px(ctx, bx + 5, by + 28 + (fireFrame % 3), 1, 1, '#fbbf24');
    px(ctx, bx + 6, by + 27 + ((fireFrame + 1) % 3), 1, 1, '#f97316');
    ctx.globalAlpha = 0.4;
    px(ctx, bx + 4, by + 29 + (fireFrame % 2), 1, 1, '#ef4444');
    px(ctx, bx + 7, by + 28 + ((fireFrame + 2) % 3), 1, 1, '#fbbf24');
    // Right hand fire
    ctx.globalAlpha = 0.7;
    px(ctx, bx + 33, by + 28 + ((fireFrame + 1) % 3), 1, 1, '#fbbf24');
    px(ctx, bx + 32, by + 27 + (fireFrame % 3), 1, 1, '#f97316');
    ctx.globalAlpha = 0.4;
    px(ctx, bx + 34, by + 29 + ((fireFrame + 2) % 2), 1, 1, '#ef4444');
    px(ctx, bx + 31, by + 28 + (fireFrame % 3), 1, 1, '#fbbf24');
    // Falling ember drops
    ctx.globalAlpha = 0.25;
    px(ctx, bx + 5, by + 30 + fireFrame * 0.5, 1, 1, '#f97316');
    px(ctx, bx + 33, by + 30 + (fireFrame + 2) * 0.5, 1, 1, '#f97316');
    ctx.globalAlpha = 1;

    // Legs
    px(ctx, bx + 12, by + 30, 6, 6, '#991b1b');
    px(ctx, bx + 22, by + 30, 6, 6, '#991b1b');
    // Leg muscle
    px(ctx, bx + 13, by + 30, 2, 3, '#b91c1c');
    px(ctx, bx + 23, by + 30, 2, 3, '#b91c1c');
    // Hooves
    px(ctx, bx + 11, by + 35, 8, 2, '#451a03');
    px(ctx, bx + 21, by + 35, 8, 2, '#451a03');
    // Hoof highlights
    px(ctx, bx + 12, by + 35, 2, 1, '#5c3d1e');
    px(ctx, bx + 22, by + 35, 2, 1, '#5c3d1e');

    // Tail with barbed end
    px(ctx, bx + 18, by + 30, 3, 2, '#991b1b');
    px(ctx, bx + 20, by + 31, 3, 2, '#7f1d1d');
    px(ctx, bx + 22, by + 32, 3, 2, '#7f1d1d');
    px(ctx, bx + 24, by + 31, 2, 1, '#7f1d1d');
    // Barbed end (spiky diamond shape)
    px(ctx, bx + 26, by + 30, 3, 3, '#451a03');
    px(ctx, bx + 27, by + 29, 1, 1, '#451a03'); // top barb
    px(ctx, bx + 27, by + 33, 1, 1, '#451a03'); // bottom barb
    px(ctx, bx + 29, by + 31, 1, 1, '#451a03'); // right barb point

    // Outline for boss
    this.drawSpriteOutline(ctx, bx, by);
  }

  private drawBossSpiderQueen(ctx: CanvasRenderingContext2D, x: number, y: number, _facing: Direction, frame: number): void {
    // Spider Queen — large purple/black spider with egg sac, web patterns, multiple eyes
    const bx = x - 4;
    const by = y - 4;
    const pulse = Math.sin(frame * 0.2) * 2;

    // Web strands trailing behind
    ctx.globalAlpha = 0.15;
    px(ctx, bx + 5, by + 38, 1, 4, '#d1d5db');
    px(ctx, bx + 15, by + 39, 1, 3, '#d1d5db');
    px(ctx, bx + 25, by + 38, 1, 4, '#d1d5db');
    px(ctx, bx + 35, by + 39, 1, 3, '#d1d5db');
    ctx.globalAlpha = 1;

    // 8 Legs — 4 per side with segment animation
    const legWave = Math.sin(frame * 0.5);
    const legWave2 = Math.cos(frame * 0.5);
    // Left legs (4)
    for (let i = 0; i < 4; i++) {
      const ly = by + 12 + i * 5;
      const wave = (i % 2 === 0 ? legWave : legWave2) * 2;
      px(ctx, bx + 2 - i, ly + wave, 8, 2, '#581c87');
      px(ctx, bx + 0 - i, ly + 1 + wave, 3, 1, '#4c1d95');
      // Leg joint highlight
      px(ctx, bx + 4, ly + wave, 1, 1, '#7c3aed');
    }
    // Right legs (4)
    for (let i = 0; i < 4; i++) {
      const ly = by + 12 + i * 5;
      const wave = (i % 2 === 0 ? legWave2 : legWave) * 2;
      px(ctx, bx + 30 + i, ly + wave, 8, 2, '#581c87');
      px(ctx, bx + 37 + i, ly + 1 + wave, 3, 1, '#4c1d95');
      px(ctx, bx + 35, ly + wave, 1, 1, '#7c3aed');
    }

    // Abdomen (large egg sac — bulbous, lighter purple with pattern)
    px(ctx, bx + 10, by + 18 + pulse, 20, 16, '#6b21a8');
    px(ctx, bx + 12, by + 17 + pulse, 16, 1, '#7c3aed');
    px(ctx, bx + 12, by + 34 + pulse, 16, 1, '#4c1d95');
    // Web pattern on abdomen
    px(ctx, bx + 15, by + 20 + pulse, 1, 12, '#8b5cf6');
    px(ctx, bx + 20, by + 19 + pulse, 1, 13, '#8b5cf6');
    px(ctx, bx + 25, by + 20 + pulse, 1, 12, '#8b5cf6');
    px(ctx, bx + 12, by + 25 + pulse, 16, 1, '#8b5cf6');
    // Abdomen sheen
    ctx.globalAlpha = 0.2;
    px(ctx, bx + 13, by + 19 + pulse, 8, 4, '#c4b5fd');
    ctx.globalAlpha = 1;
    // Egg bumps on abdomen
    const eggGlow = 0.3 + Math.sin(frame * 0.3) * 0.15;
    ctx.globalAlpha = eggGlow;
    px(ctx, bx + 14, by + 28 + pulse, 3, 3, '#d8b4fe');
    px(ctx, bx + 22, by + 27 + pulse, 2, 2, '#d8b4fe');
    px(ctx, bx + 18, by + 30 + pulse, 2, 2, '#e9d5ff');
    ctx.globalAlpha = 1;

    // Cephalothorax (front body — darker, smaller)
    px(ctx, bx + 12, by + 6, 16, 14, '#4c1d95');
    px(ctx, bx + 14, by + 5, 12, 2, '#581c87');
    // Armor plates
    px(ctx, bx + 13, by + 8, 14, 4, '#3b0764');
    px(ctx, bx + 14, by + 9, 12, 2, '#581c87'); // highlight

    // Multiple eyes (8 eyes — cluster)
    // Large center pair
    px(ctx, bx + 16, by + 6, 3, 3, '#1a1a2e');
    px(ctx, bx + 21, by + 6, 3, 3, '#1a1a2e');
    const mainEyeColor = frame % 16 < 8 ? '#ef4444' : '#dc2626';
    px(ctx, bx + 16, by + 6, 2, 2, mainEyeColor);
    px(ctx, bx + 22, by + 6, 2, 2, mainEyeColor);
    // Small outer pairs
    px(ctx, bx + 14, by + 7, 2, 2, '#ef4444');
    px(ctx, bx + 24, by + 7, 2, 2, '#ef4444');
    px(ctx, bx + 15, by + 9, 1, 1, '#b91c1c');
    px(ctx, bx + 24, by + 9, 1, 1, '#b91c1c');
    // Eye glow
    ctx.globalAlpha = 0.15;
    px(ctx, bx + 14, by + 5, 12, 6, '#ef4444');
    ctx.globalAlpha = 1;

    // Mandibles/fangs (large, dripping venom)
    px(ctx, bx + 16, by + 12, 2, 4, '#78350f');
    px(ctx, bx + 22, by + 12, 2, 4, '#78350f');
    px(ctx, bx + 16, by + 15, 1, 2, '#d1d5db'); // fang tip
    px(ctx, bx + 23, by + 15, 1, 2, '#d1d5db');
    // Venom drip
    const venomDrip = frame % 10;
    if (venomDrip < 5) {
      ctx.globalAlpha = 0.6;
      px(ctx, bx + 16, by + 17 + venomDrip * 0.5, 1, 1, '#22c55e');
      px(ctx, bx + 23, by + 17 + (venomDrip + 2) * 0.5, 1, 1, '#22c55e');
      ctx.globalAlpha = 1;
    }

    // Poison aura
    ctx.globalAlpha = 0.06 + Math.sin(frame * 0.2) * 0.04;
    px(ctx, bx + 4, by + 4, 32, 32, '#22c55e');
    ctx.globalAlpha = 1;

    this.drawSpriteOutline(ctx, bx, by);
  }

  private drawBossForgeGuardian(ctx: CanvasRenderingContext2D, x: number, y: number, _facing: Direction, frame: number): void {
    // Forge Guardian — massive iron golem with glowing forge belly, hammer, rivets
    const bx = x - 4;
    const by = y - 4;
    const heavyStep = Math.sin(frame * 0.15) * 1; // slow lumbering

    // Heat shimmer beneath
    ctx.globalAlpha = 0.12;
    for (let i = 0; i < 6; i++) {
      px(ctx, bx + 8 + i * 4, by + 37 + Math.sin(frame * 0.3 + i) * 1, 2, 1, '#f97316');
    }
    ctx.globalAlpha = 1;

    // Massive body — iron/dark metal
    px(ctx, bx + 8, by + 8 + heavyStep, 24, 24, '#374151');
    px(ctx, bx + 6, by + 10 + heavyStep, 2, 18, '#4b5563'); // left shoulder
    px(ctx, bx + 32, by + 10 + heavyStep, 2, 18, '#4b5563'); // right shoulder
    // Metal highlight
    px(ctx, bx + 10, by + 9 + heavyStep, 20, 2, '#6b7280');

    // Rivet details (dots along plates)
    const rivetColor = '#9ca3af';
    px(ctx, bx + 10, by + 12 + heavyStep, 1, 1, rivetColor);
    px(ctx, bx + 16, by + 12 + heavyStep, 1, 1, rivetColor);
    px(ctx, bx + 22, by + 12 + heavyStep, 1, 1, rivetColor);
    px(ctx, bx + 28, by + 12 + heavyStep, 1, 1, rivetColor);
    px(ctx, bx + 10, by + 20 + heavyStep, 1, 1, rivetColor);
    px(ctx, bx + 28, by + 20 + heavyStep, 1, 1, rivetColor);

    // Forge belly (glowing furnace window)
    const forgeGlow = 0.5 + Math.sin(frame * 0.4) * 0.5;
    const forgeColor = forgeGlow > 0.7 ? '#fbbf24' : '#f97316';
    px(ctx, bx + 14, by + 16 + heavyStep, 12, 8, '#1a1a2e');
    px(ctx, bx + 15, by + 17 + heavyStep, 10, 6, forgeColor);
    px(ctx, bx + 16, by + 18 + heavyStep, 8, 4, '#fef3c7'); // bright center
    // Forge glow aura
    ctx.globalAlpha = forgeGlow * 0.2;
    px(ctx, bx + 12, by + 14 + heavyStep, 16, 12, '#f97316');
    ctx.globalAlpha = 1;
    // Forge grate bars
    px(ctx, bx + 17, by + 16 + heavyStep, 1, 8, '#374151');
    px(ctx, bx + 20, by + 16 + heavyStep, 1, 8, '#374151');
    px(ctx, bx + 23, by + 16 + heavyStep, 1, 8, '#374151');

    // Head (anvil-shaped, flat top)
    px(ctx, bx + 12, by + 2 + heavyStep, 16, 8, '#4b5563');
    px(ctx, bx + 10, by + 2 + heavyStep, 2, 4, '#374151'); // left horn
    px(ctx, bx + 28, by + 2 + heavyStep, 2, 4, '#374151'); // right horn
    px(ctx, bx + 11, by + 1 + heavyStep, 18, 2, '#6b7280'); // top plate

    // Eyes (ember glow)
    px(ctx, bx + 15, by + 4 + heavyStep, 3, 2, '#1a1a2e');
    px(ctx, bx + 22, by + 4 + heavyStep, 3, 2, '#1a1a2e');
    px(ctx, bx + 15, by + 4 + heavyStep, 2, 1, forgeColor);
    px(ctx, bx + 23, by + 4 + heavyStep, 2, 1, forgeColor);

    // Jaw (metal plate)
    px(ctx, bx + 14, by + 8 + heavyStep, 12, 2, '#374151');

    // Arms (thick iron)
    px(ctx, bx + 4, by + 12 + heavyStep, 5, 16, '#4b5563');
    px(ctx, bx + 5, by + 13 + heavyStep, 3, 6, '#6b7280'); // highlight
    px(ctx, bx + 31, by + 12 + heavyStep, 5, 16, '#4b5563');
    px(ctx, bx + 32, by + 13 + heavyStep, 3, 6, '#6b7280');

    // Giant hammer (right hand)
    px(ctx, bx + 34, by + 10 + heavyStep, 4, 18, '#78350f'); // handle
    px(ctx, bx + 32, by + 6 + heavyStep, 8, 6, '#6b7280'); // hammer head
    px(ctx, bx + 33, by + 7 + heavyStep, 6, 4, '#9ca3af'); // head highlight
    // Hammer glow
    ctx.globalAlpha = 0.15;
    px(ctx, bx + 31, by + 5 + heavyStep, 10, 8, forgeColor);
    ctx.globalAlpha = 1;

    // Legs (thick pillars)
    px(ctx, bx + 12, by + 32 + heavyStep, 6, 6, '#374151');
    px(ctx, bx + 22, by + 32 + heavyStep, 6, 6, '#374151');
    px(ctx, bx + 13, by + 32 + heavyStep, 2, 3, '#4b5563'); // highlight

    this.drawSpriteOutline(ctx, bx, by);
  }

  private drawBossStoneWarden(ctx: CanvasRenderingContext2D, x: number, y: number, _facing: Direction, frame: number): void {
    // Stone Warden — ancient stone construct covered in runes, moss, crystal growths
    const bx = x - 4;
    const by = y - 4;
    const sway = Math.sin(frame * 0.12) * 1;

    // Stone body (massive, grey-blue)
    px(ctx, bx + 8, by + 8 + sway, 24, 26, '#64748b');
    px(ctx, bx + 10, by + 7 + sway, 20, 2, '#94a3b8'); // shoulder highlight
    px(ctx, bx + 6, by + 12 + sway, 2, 16, '#64748b'); // left shoulder
    px(ctx, bx + 32, by + 12 + sway, 2, 16, '#64748b');

    // Stone block texture (large cracks)
    px(ctx, bx + 16, by + 10 + sway, 1, 22, '#475569');
    px(ctx, bx + 24, by + 12 + sway, 1, 18, '#475569');
    px(ctx, bx + 10, by + 20 + sway, 20, 1, '#475569');
    px(ctx, bx + 10, by + 28 + sway, 20, 1, '#475569');

    // Glowing rune carvings
    const runeGlow = 0.4 + Math.sin(frame * 0.3) * 0.3;
    ctx.globalAlpha = runeGlow;
    // Rune 1: circle on chest
    px(ctx, bx + 17, by + 14 + sway, 6, 1, '#22d3ee');
    px(ctx, bx + 16, by + 15 + sway, 1, 4, '#22d3ee');
    px(ctx, bx + 23, by + 15 + sway, 1, 4, '#22d3ee');
    px(ctx, bx + 17, by + 19 + sway, 6, 1, '#22d3ee');
    // Rune 2: lines on shoulders
    px(ctx, bx + 10, by + 10 + sway, 4, 1, '#06b6d4');
    px(ctx, bx + 26, by + 10 + sway, 4, 1, '#06b6d4');
    px(ctx, bx + 11, by + 12 + sway, 2, 1, '#67e8f9');
    px(ctx, bx + 27, by + 12 + sway, 2, 1, '#67e8f9');
    ctx.globalAlpha = 1;

    // Moss growths
    ctx.globalAlpha = 0.5;
    px(ctx, bx + 8, by + 30 + sway, 4, 3, '#166534');
    px(ctx, bx + 28, by + 28 + sway, 3, 4, '#15532a');
    px(ctx, bx + 14, by + 8 + sway, 3, 2, '#166534');
    ctx.globalAlpha = 1;

    // Crystal growths (protruding cyan crystals)
    px(ctx, bx + 7, by + 8 + sway, 3, 5, '#06b6d4');
    px(ctx, bx + 8, by + 6 + sway, 1, 3, '#22d3ee'); // crystal tip
    px(ctx, bx + 30, by + 10 + sway, 3, 4, '#06b6d4');
    px(ctx, bx + 31, by + 8 + sway, 1, 3, '#22d3ee');
    // Crystal glow
    ctx.globalAlpha = 0.2;
    px(ctx, bx + 6, by + 6 + sway, 5, 8, '#22d3ee');
    px(ctx, bx + 29, by + 8 + sway, 5, 7, '#22d3ee');
    ctx.globalAlpha = 1;

    // Head (carved stone face)
    px(ctx, bx + 12, by + 1 + sway, 16, 9, '#94a3b8');
    px(ctx, bx + 14, by + 0 + sway, 12, 2, '#cbd5e1'); // forehead
    // Carved eye sockets
    px(ctx, bx + 15, by + 3 + sway, 3, 3, '#1e293b');
    px(ctx, bx + 22, by + 3 + sway, 3, 3, '#1e293b');
    // Glowing eyes (ancient blue)
    const eyePulse = 0.5 + Math.sin(frame * 0.4) * 0.5;
    px(ctx, bx + 15, by + 3 + sway, 2, 2, eyePulse > 0.6 ? '#22d3ee' : '#0891b2');
    px(ctx, bx + 23, by + 3 + sway, 2, 2, eyePulse > 0.6 ? '#22d3ee' : '#0891b2');
    // Carved mouth (horizontal line)
    px(ctx, bx + 16, by + 7 + sway, 8, 1, '#334155');

    // Arms (stone pillars)
    px(ctx, bx + 4, by + 14 + sway, 5, 16, '#64748b');
    px(ctx, bx + 5, by + 15 + sway, 3, 6, '#94a3b8');
    px(ctx, bx + 31, by + 14 + sway, 5, 16, '#64748b');
    px(ctx, bx + 32, by + 15 + sway, 3, 6, '#94a3b8');
    // Stone fists
    px(ctx, bx + 3, by + 29 + sway, 6, 4, '#475569');
    px(ctx, bx + 31, by + 29 + sway, 6, 4, '#475569');

    // Legs
    px(ctx, bx + 12, by + 34, 6, 4, '#475569');
    px(ctx, bx + 22, by + 34, 6, 4, '#475569');

    // Ground rune circle
    ctx.globalAlpha = 0.1 + Math.sin(frame * 0.2) * 0.05;
    px(ctx, bx + 6, by + 36, 28, 2, '#22d3ee');
    ctx.globalAlpha = 1;

    this.drawSpriteOutline(ctx, bx, by);
  }

  private drawBossFlameKnight(ctx: CanvasRenderingContext2D, x: number, y: number, facing: Direction, frame: number): void {
    // Flame Knight — burning armored knight, flaming sword, fire cape, charred armor
    const bx = x - 4;
    const by = y - 4;
    const pulse = Math.sin(frame * 0.25) * 1.5;
    const facingRight = facing === 'right' || facing === 'down';

    // Fire aura
    ctx.globalAlpha = 0.08 + Math.sin(frame * 0.3) * 0.04;
    px(ctx, bx + 2, by + 2, 36, 34, '#f97316');
    ctx.globalAlpha = 1;

    // Fire cape (flowing flames behind body)
    const flameWave = Math.sin(frame * 0.5) * 2;
    px(ctx, bx + 10, by + 10, 20, 20, '#dc2626');
    px(ctx, bx + 8, by + 12, 2, 16 + flameWave, '#ef4444');
    px(ctx, bx + 30, by + 12, 2, 16 - flameWave, '#ef4444');
    // Cape fire tips
    px(ctx, bx + 9, by + 28 + flameWave, 1, 3, '#f97316');
    px(ctx, bx + 14, by + 30 + flameWave * 0.5, 1, 2, '#fbbf24');
    px(ctx, bx + 20, by + 30 - flameWave * 0.5, 1, 3, '#f97316');
    px(ctx, bx + 26, by + 29 + flameWave, 1, 2, '#fbbf24');
    px(ctx, bx + 30, by + 28 - flameWave, 1, 3, '#f97316');

    // Charred black armor body
    px(ctx, bx + 10, by + 8 + pulse, 20, 20, '#1c1917');
    px(ctx, bx + 12, by + 7 + pulse, 16, 2, '#292524'); // shoulder plates
    // Armor cracks showing fire beneath
    const crackGlow = 0.5 + Math.sin(frame * 0.5) * 0.5;
    px(ctx, bx + 15, by + 12 + pulse, 1, 6, crackGlow > 0.6 ? '#fbbf24' : '#f97316');
    px(ctx, bx + 24, by + 14 + pulse, 1, 5, crackGlow > 0.6 ? '#fbbf24' : '#f97316');
    px(ctx, bx + 18, by + 22 + pulse, 4, 1, crackGlow > 0.6 ? '#f97316' : '#dc2626');
    // Armor highlight
    px(ctx, bx + 14, by + 9 + pulse, 12, 2, '#44403c');

    // Chest emblem (flaming skull)
    px(ctx, bx + 17, by + 13 + pulse, 6, 5, '#292524');
    const skullGlow = 0.4 + Math.sin(frame * 0.4) * 0.3;
    ctx.globalAlpha = skullGlow;
    px(ctx, bx + 18, by + 13 + pulse, 4, 3, '#fbbf24');
    px(ctx, bx + 18, by + 14 + pulse, 1, 1, '#000'); // eye
    px(ctx, bx + 21, by + 14 + pulse, 1, 1, '#000'); // eye
    ctx.globalAlpha = 1;

    // Helmet (horned, burning)
    px(ctx, bx + 13, by + 2 + pulse, 14, 8, '#1c1917');
    px(ctx, bx + 15, by + 1 + pulse, 10, 2, '#292524');
    // Burning horns
    px(ctx, bx + 10, by + 0 + pulse, 3, 5, '#451a03');
    px(ctx, bx + 27, by + 0 + pulse, 3, 5, '#451a03');
    // Fire on horn tips
    px(ctx, bx + 10, by - 2 + pulse, 2, 2, '#f97316');
    px(ctx, bx + 28, by - 2 + pulse, 2, 2, '#f97316');
    px(ctx, bx + 11, by - 3 + pulse, 1, 1, '#fbbf24');
    px(ctx, bx + 28, by - 3 + pulse, 1, 1, '#fbbf24');
    // Visor (burning eyes)
    const eyeColor = frame % 16 < 8 ? '#fbbf24' : '#f97316';
    px(ctx, bx + 16, by + 4 + pulse, 3, 2, '#000');
    px(ctx, bx + 21, by + 4 + pulse, 3, 2, '#000');
    px(ctx, bx + 16, by + 4 + pulse, 2, 1, eyeColor);
    px(ctx, bx + 22, by + 4 + pulse, 2, 1, eyeColor);
    // Eye flame trails
    ctx.globalAlpha = 0.4;
    px(ctx, bx + 15, by + 3 + pulse, 2, 1, eyeColor);
    px(ctx, bx + 23, by + 3 + pulse, 2, 1, eyeColor);
    ctx.globalAlpha = 1;

    // Arms
    px(ctx, bx + 6, by + 12 + pulse, 5, 14, '#1c1917');
    px(ctx, bx + 7, by + 13 + pulse, 3, 5, '#292524');
    px(ctx, bx + 29, by + 12 + pulse, 5, 14, '#1c1917');
    px(ctx, bx + 30, by + 13 + pulse, 3, 5, '#292524');

    // Flaming sword (left or right based on facing)
    const swordSide = facingRight ? 1 : -1;
    const sx = facingRight ? bx + 33 : bx + 3;
    // Blade
    px(ctx, sx, by + 4 + pulse, 2, 20, '#78350f');
    px(ctx, sx, by + 2 + pulse, 2, 3, '#dc2626'); // blade top
    // Flames wrapping blade
    const fFrame = frame % 6;
    px(ctx, sx - 1, by + 5 + pulse + fFrame, 1, 3, '#f97316');
    px(ctx, sx + 2, by + 8 + pulse + (fFrame + 2) % 4, 1, 2, '#fbbf24');
    px(ctx, sx - 1, by + 12 + pulse + (fFrame + 4) % 5, 1, 2, '#ef4444');
    px(ctx, sx + 2, by + 15 + pulse + fFrame % 3, 1, 2, '#f97316');
    // Sword fire glow
    ctx.globalAlpha = 0.15;
    px(ctx, sx - 2, by + 2 + pulse, 6, 22, '#f97316');
    ctx.globalAlpha = 1;
    // Crossguard
    px(ctx, sx - 2, by + 22 + pulse, 6, 2, '#92400e');

    // Legs
    px(ctx, bx + 13, by + 28 + pulse, 5, 6, '#1c1917');
    px(ctx, bx + 22, by + 28 + pulse, 5, 6, '#1c1917');
    px(ctx, bx + 14, by + 28 + pulse, 2, 3, '#292524');
    // Burning footprints
    ctx.globalAlpha = 0.2;
    px(ctx, bx + 12, by + 35, 7, 1, '#f97316');
    px(ctx, bx + 21, by + 35, 7, 1, '#f97316');
    ctx.globalAlpha = 1;

    this.drawSpriteOutline(ctx, bx, by);
  }

  // ===== UNIQUE MONSTER VARIANTS =====

  private drawGargoyle(ctx: CanvasRenderingContext2D, x: number, y: number, facing: Direction, frame: number): void {
    // Stone gargoyle — grey/blue stone body with glowing eyes, crouched pose
    const wobble = Math.sin(frame * 0.15) * 0.5; // very slow, statue-like movement

    // Stone dust particles falling occasionally
    if (frame % 12 < 2) {
      ctx.globalAlpha = 0.3;
      px(ctx, x + 3 + (frame % 5), y + 14, 1, 1, '#9ca3af');
      ctx.globalAlpha = 1;
    }

    // Wings (folded, stone)
    px(ctx, x + 1, y + 4 + wobble, 3, 8, '#6b7280');
    px(ctx, x + 0, y + 5 + wobble, 2, 6, '#4b5563');
    px(ctx, x + 12, y + 4 + wobble, 3, 8, '#6b7280');
    px(ctx, x + 14, y + 5 + wobble, 2, 6, '#4b5563');
    // Wing vein cracks
    px(ctx, x + 1, y + 6 + wobble, 1, 4, '#374151');
    px(ctx, x + 13, y + 6 + wobble, 1, 4, '#374151');

    // Body (stone grey, crouched and bulky)
    px(ctx, x + 3, y + 3 + wobble, 10, 10, '#6b7280');
    px(ctx, x + 4, y + 2 + wobble, 8, 1, '#9ca3af'); // shoulder highlight
    px(ctx, x + 5, y + 4 + wobble, 6, 6, '#4b5563'); // darker core

    // Stone texture cracks
    px(ctx, x + 5, y + 5 + wobble, 1, 4, '#374151');
    px(ctx, x + 8, y + 6 + wobble, 1, 3, '#374151');
    px(ctx, x + 10, y + 4 + wobble, 1, 5, '#374151');
    // Moss patches
    ctx.globalAlpha = 0.4;
    px(ctx, x + 4, y + 10 + wobble, 2, 2, '#166534');
    px(ctx, x + 11, y + 11 + wobble, 2, 1, '#15532a');
    ctx.globalAlpha = 1;

    // Head (horned, angular)
    px(ctx, x + 5, y + 0 + wobble, 6, 4, '#9ca3af');
    px(ctx, x + 6, y + 0 + wobble, 4, 3, '#d1d5db'); // lighter face
    // Horns (short, stone)
    px(ctx, x + 4, y - 1 + wobble, 2, 2, '#4b5563');
    px(ctx, x + 10, y - 1 + wobble, 2, 2, '#4b5563');
    px(ctx, x + 3, y - 2 + wobble, 1, 1, '#374151');
    px(ctx, x + 12, y - 2 + wobble, 1, 1, '#374151');

    // Glowing yellow eyes
    const eyeGlow = 0.6 + Math.sin(frame * 0.4) * 0.4;
    px(ctx, x + 6, y + 1 + wobble, 2, 2, '#1a1a2e');
    px(ctx, x + 9, y + 1 + wobble, 2, 2, '#1a1a2e');
    const eyeColor = eyeGlow > 0.8 ? '#fbbf24' : '#f59e0b';
    px(ctx, x + 6, y + 1 + wobble, 1, 1, eyeColor);
    px(ctx, x + 10, y + 1 + wobble, 1, 1, eyeColor);
    // Eye glow aura
    ctx.globalAlpha = eyeGlow * 0.2;
    px(ctx, x + 5, y + 0 + wobble, 3, 3, '#fbbf24');
    px(ctx, x + 8, y + 0 + wobble, 3, 3, '#fbbf24');
    ctx.globalAlpha = 1;

    // Fanged mouth
    px(ctx, x + 7, y + 3 + wobble, 3, 1, '#374151');
    px(ctx, x + 7, y + 3 + wobble, 1, 1, '#d1d5db'); // fang
    px(ctx, x + 9, y + 3 + wobble, 1, 1, '#d1d5db'); // fang

    // Clawed feet
    px(ctx, x + 4, y + 13, 3, 2, '#4b5563');
    px(ctx, x + 9, y + 13, 3, 2, '#4b5563');
    px(ctx, x + 3, y + 14, 1, 1, '#374151'); // claw
    px(ctx, x + 7, y + 14, 1, 1, '#374151');
    px(ctx, x + 12, y + 14, 1, 1, '#374151');

    this.drawSpriteOutline(ctx, x, y);
  }

  private drawDarkKnight(ctx: CanvasRenderingContext2D, x: number, y: number, facing: Direction, frame: number, attacking = false): void {
    // Dark Knight — heavily armored black/purple knight with glowing sword
    const wobble = WALK_OFFSETS[frame % 4];
    const facingRight = facing === 'right' || facing === 'down';

    // Cape (dark purple, flowing)
    const capeWave = Math.sin(frame * 0.3) * 1;
    px(ctx, x + 4, y + 6, 8, 7, '#1e1b4b');
    px(ctx, x + 3, y + 7, 1, 5 + capeWave, '#312e81');
    px(ctx, x + 12, y + 7, 1, 5 - capeWave, '#312e81');
    px(ctx, x + 5, y + 13, 6, 1 + Math.abs(capeWave), '#1e1b4b');

    // Armored body (dark black/grey with purple trim)
    px(ctx, x + 4, y + 4 + wobble, 8, 8, '#1f2937');
    px(ctx, x + 5, y + 3 + wobble, 6, 1, '#374151'); // shoulder plate
    // Purple trim on armor
    px(ctx, x + 4, y + 4 + wobble, 1, 8, '#4c1d95');
    px(ctx, x + 11, y + 4 + wobble, 1, 8, '#4c1d95');
    px(ctx, x + 5, y + 8 + wobble, 6, 1, '#4c1d95'); // belt

    // Chest emblem (dark rune)
    const runeGlow = 0.3 + Math.sin(frame * 0.5) * 0.2;
    ctx.globalAlpha = runeGlow;
    px(ctx, x + 6, y + 5 + wobble, 4, 3, '#7c3aed');
    px(ctx, x + 7, y + 5 + wobble, 2, 1, '#a78bfa');
    ctx.globalAlpha = 1;

    // Helmet (dark with T-visor glowing purple)
    px(ctx, x + 5, y + 0 + wobble, 6, 5, '#111827');
    px(ctx, x + 4, y + 1 + wobble, 1, 3, '#1f2937'); // side
    px(ctx, x + 11, y + 1 + wobble, 1, 3, '#1f2937');
    px(ctx, x + 6, y + 1 + wobble, 4, 1, '#374151'); // top highlight
    // T-visor glow
    px(ctx, x + 6, y + 2 + wobble, 4, 1, '#7c3aed');
    px(ctx, x + 7, y + 3 + wobble, 2, 1, '#7c3aed');
    // Visor glow aura
    ctx.globalAlpha = 0.15;
    px(ctx, x + 5, y + 1 + wobble, 6, 3, '#8b5cf6');
    ctx.globalAlpha = 1;

    // Legs (armored)
    px(ctx, x + 4, y + 12 + wobble, 3, 3, '#1f2937');
    px(ctx, x + 9, y + 12 + wobble, 3, 3, '#1f2937');
    px(ctx, x + 5, y + 12 + wobble, 1, 2, '#374151'); // leg highlight

    // Sword (glowing dark purple blade)
    const swordX = facingRight ? x + 12 : x - 1;
    if (attacking) {
      // Attack swing — horizontal
      px(ctx, x + 2, y + 5 + wobble, 12, 1, '#7c3aed');
      px(ctx, x + 1, y + 5 + wobble, 1, 1, '#a78bfa'); // tip glow
      // Swing trail
      ctx.globalAlpha = 0.3;
      px(ctx, x + 2, y + 4 + wobble, 12, 1, '#8b5cf6');
      px(ctx, x + 2, y + 6 + wobble, 12, 1, '#8b5cf6');
      ctx.globalAlpha = 1;
    } else {
      // Sword at side
      px(ctx, swordX, y + 3 + wobble, 1, 9, '#4c1d95');
      px(ctx, swordX, y + 3 + wobble, 1, 1, '#a78bfa'); // pommel
      px(ctx, swordX, y + 2 + wobble, 1, 1, '#c4b5fd'); // tip glow
      // Blade glow
      ctx.globalAlpha = 0.2;
      px(ctx, swordX - 1, y + 3 + wobble, 3, 8, '#8b5cf6');
      ctx.globalAlpha = 1;
    }

    this.drawSpriteOutline(ctx, x, y);
  }

  private drawPhantom(ctx: CanvasRenderingContext2D, x: number, y: number, facing: Direction, frame: number): void {
    // Phantom — transparent ghostly figure, cyan/white, phasing in and out
    const floatY = Math.sin(frame * 0.25) * 2;
    const phaseAlpha = 0.5 + Math.sin(frame * 0.15) * 0.2; // 0.3 to 0.7

    ctx.globalAlpha = phaseAlpha;

    // Ghostly trail (fading copies behind)
    ctx.globalAlpha = phaseAlpha * 0.15;
    px(ctx, x + 3, y + 3 + floatY + 2, 10, 10, '#67e8f9');
    ctx.globalAlpha = phaseAlpha;

    // Ethereal body (wispy, tapers at bottom)
    px(ctx, x + 4, y + 2 + floatY, 8, 8, '#cffafe');
    px(ctx, x + 5, y + 1 + floatY, 6, 1, '#e0f2fe');
    // Tapered bottom (wispy tendrils)
    px(ctx, x + 4, y + 10 + floatY, 2, 2, '#a5f3fc');
    px(ctx, x + 7, y + 10 + floatY, 1, 3, '#67e8f9');
    px(ctx, x + 10, y + 10 + floatY, 2, 2, '#a5f3fc');
    px(ctx, x + 5, y + 12 + floatY, 1, 2, '#67e8f9');
    px(ctx, x + 9, y + 11 + floatY, 1, 2, '#67e8f9');

    // Inner glow core
    ctx.globalAlpha = phaseAlpha * 0.4;
    px(ctx, x + 6, y + 4 + floatY, 4, 4, '#ffffff');
    ctx.globalAlpha = phaseAlpha;

    // Dark hollow eyes (large, menacing)
    px(ctx, x + 5, y + 3 + floatY, 3, 2, '#0f172a');
    px(ctx, x + 9, y + 3 + floatY, 3, 2, '#0f172a');
    // Eye inner glow (cold cyan)
    const eyePulse = 0.5 + Math.sin(frame * 0.6) * 0.5;
    const eyeC = eyePulse > 0.7 ? '#22d3ee' : '#06b6d4';
    px(ctx, x + 6, y + 3 + floatY, 1, 1, eyeC);
    px(ctx, x + 10, y + 3 + floatY, 1, 1, eyeC);

    // Wailing mouth
    px(ctx, x + 7, y + 6 + floatY, 2, 2, '#0c4a6e');
    px(ctx, x + 7, y + 7 + floatY, 2, 1, '#0f172a');

    // Floating soul particles around
    ctx.globalAlpha = phaseAlpha * 0.5;
    const pX1 = x + 2 + Math.sin(frame * 0.3) * 3;
    const pY1 = y + 4 + Math.cos(frame * 0.4) * 2;
    px(ctx, pX1, pY1 + floatY, 1, 1, '#67e8f9');
    const pX2 = x + 12 + Math.cos(frame * 0.35) * 2;
    const pY2 = y + 6 + Math.sin(frame * 0.25) * 3;
    px(ctx, pX2, pY2 + floatY, 1, 1, '#a5f3fc');

    ctx.globalAlpha = 1;
    this.drawSpriteOutline(ctx, x, y);
  }

  private drawLavaSlime(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number): void {
    // Lava Slime — molten rock body with orange/red magma, ember particles, crust

    // Squash/stretch bounce
    const bouncePhase = (frame % 8) / 8;
    const squash = Math.sin(bouncePhase * Math.PI * 2);
    const baseW = 12;
    const baseH = 10;
    const w = Math.floor(baseW + squash * 3);
    const h = Math.floor(baseH - squash * 3);
    const bx = x + 8 - Math.floor(w / 2);
    const by = y + 14 - h;

    // Heat distortion beneath
    ctx.globalAlpha = 0.2;
    for (let i = 0; i < 4; i++) {
      px(ctx, bx + 1 + i * 3, y + 15 + Math.sin(frame * 0.5 + i) * 0.5, 2, 1, '#f97316');
    }
    ctx.globalAlpha = 1;

    // Lava trail
    ctx.globalAlpha = 0.3;
    px(ctx, bx + 1, y + 14, w - 2, 1, '#dc2626');
    px(ctx, bx + 2, y + 15, w - 4, 1, '#991b1b');
    ctx.globalAlpha = 1;

    // Dark rock crust outer shell
    px(ctx, bx, by + 1, w, h - 1, '#451a03');
    px(ctx, bx + 1, by, w - 2, 1, '#451a03');
    px(ctx, bx + 1, by + h, w - 2, 1, '#451a03');

    // Molten magma showing through cracks
    const magmaGlow = 0.6 + Math.sin(frame * 0.4) * 0.4;
    const magmaColor = magmaGlow > 0.8 ? '#fbbf24' : '#f97316';
    // Large magma crack pattern
    px(ctx, bx + 2, by + 2, w - 4, h - 4, '#b91c1c'); // inner magma
    px(ctx, bx + 3, by + 3, w - 6, h - 6, '#ef4444'); // brighter core

    // Rock crust patches over magma
    px(ctx, bx + 2, by + 1, 3, 2, '#78350f');
    px(ctx, bx + w - 5, by + 2, 3, 3, '#78350f');
    px(ctx, bx + 3, by + h - 3, 4, 2, '#78350f');
    px(ctx, bx + w - 3, by + h - 2, 2, 2, '#5c3310');

    // Glowing cracks between crust
    px(ctx, bx + 4, by + 2, 1, 3, magmaColor);
    px(ctx, bx + w - 4, by + 4, 1, 2, magmaColor);
    px(ctx, bx + 3, by + h - 2, 3, 1, magmaColor);
    // Glow aura on cracks
    ctx.globalAlpha = magmaGlow * 0.3;
    px(ctx, bx + 3, by + 1, 3, 5, '#fbbf24');
    ctx.globalAlpha = 1;

    // Angry glowing eyes
    const eyeY = by + Math.floor(h * 0.3);
    px(ctx, bx + Math.floor(w * 0.25), eyeY, 2, 2, '#fbbf24');
    px(ctx, bx + Math.floor(w * 0.6), eyeY, 2, 2, '#fbbf24');
    px(ctx, bx + Math.floor(w * 0.25) + 1, eyeY, 1, 1, '#ffffff'); // hot center
    px(ctx, bx + Math.floor(w * 0.6) + 1, eyeY, 1, 1, '#ffffff');

    // Ember particles rising
    ctx.globalAlpha = 0.6;
    const e1x = bx + 2 + Math.sin(frame * 0.5) * 3;
    const e1y = by - 1 - (frame % 5);
    px(ctx, e1x, e1y, 1, 1, '#fbbf24');
    const e2x = bx + w - 3 + Math.cos(frame * 0.4) * 2;
    const e2y = by - 2 - ((frame + 3) % 4);
    px(ctx, e2x, e2y, 1, 1, '#f97316');
    ctx.globalAlpha = 0.3;
    const e3x = bx + Math.floor(w / 2) + Math.sin(frame * 0.3 + 1) * 2;
    px(ctx, e3x, by - 3 - (frame % 3), 1, 1, '#ef4444');
    ctx.globalAlpha = 1;

    this.drawSpriteOutline(ctx, x, y);
  }

  // ===== NEW MONSTER SPRITES =====

  private drawRat(ctx: CanvasRenderingContext2D, x: number, y: number, facing: Direction, frame: number): void {
    // size 0.5 = ~8x8 pixels
    const facingRight = facing === 'right' || facing === 'down';
    const dir = facingRight ? 1 : -1;
    // Rapid leg animation (double speed)
    const legFrame = (frame * 2) % 4;
    const legOff = legFrame % 2;

    // Offset for centering in tile
    const ox = x + 4;
    const oy = y + 5;

    // Tail (3-4px curved behind body)
    const tailWave = Math.sin(frame * 1.5) * 1;
    if (facingRight) {
      px(ctx, ox - 2, oy + 3 + tailWave, 1, 1, '#a8a29e');
      px(ctx, ox - 3, oy + 2 + tailWave, 1, 1, '#a8a29e');
      px(ctx, ox - 4, oy + 1 + tailWave * 0.5, 1, 1, '#a8a29e');
    } else {
      px(ctx, ox + 5, oy + 3 + tailWave, 1, 1, '#a8a29e');
      px(ctx, ox + 6, oy + 2 + tailWave, 1, 1, '#a8a29e');
      px(ctx, ox + 7, oy + 1 + tailWave * 0.5, 1, 1, '#a8a29e');
    }

    // Body (3x4px brown/gray rodent body)
    px(ctx, ox, oy + 1, 4, 3, '#78716c');
    px(ctx, ox + 1, oy + 1, 2, 2, '#8a8178'); // lighter center

    // Belly (lighter)
    px(ctx, ox + 1, oy + 3, 2, 1, '#a8a29e');

    // Head
    const headX = facingRight ? ox + 3 : ox - 1;
    px(ctx, headX, oy, 2, 3, '#78716c');
    px(ctx, headX, oy + 1, 2, 1, '#8a8178'); // lighter face

    // Pink nose (1px)
    const noseX = facingRight ? headX + 2 : headX - 1;
    px(ctx, noseX, oy + 1, 1, 1, '#f9a8d4');

    // Beady red eyes
    const eyeX = facingRight ? headX + 1 : headX;
    px(ctx, eyeX, oy, 1, 1, '#ef4444');

    // Pink ears
    const earX = facingRight ? headX : headX + 1;
    px(ctx, earX, oy - 1, 1, 1, '#f9a8d4');
    px(ctx, earX + 1, oy - 1, 1, 1, '#f9a8d4');

    // Whiskers (1px lines)
    ctx.globalAlpha = 0.5;
    if (facingRight) {
      px(ctx, noseX + 1, oy, 2, 1, '#d6d3d1');
      px(ctx, noseX + 1, oy + 2, 2, 1, '#d6d3d1');
    } else {
      px(ctx, noseX - 2, oy, 2, 1, '#d6d3d1');
      px(ctx, noseX - 2, oy + 2, 2, 1, '#d6d3d1');
    }
    ctx.globalAlpha = 1;

    // Tiny legs with rapid animation
    px(ctx, ox, oy + 4, 1, 1 + legOff, '#57534e');
    px(ctx, ox + 1, oy + 4, 1, 1 + (1 - legOff), '#57534e');
    px(ctx, ox + 2, oy + 4, 1, 1 + legOff, '#57534e');
    px(ctx, ox + 3, oy + 4, 1, 1 + (1 - legOff), '#57534e');

    this.drawSpriteOutline(ctx, x, y);
  }

  private drawSpider(ctx: CanvasRenderingContext2D, x: number, y: number, facing: Direction, frame: number): void {
    // size 0.8 = ~13x13 pixels
    const ox = x + 2;
    const oy = y + 2;
    // Leg pairs alternate up/down per frame
    const legPhase = Math.sin(frame * 0.8);
    const legAlt = legPhase > 0 ? 1 : 0;

    // Abdomen (larger rear segment) with web pattern
    px(ctx, ox + 3, oy + 5, 7, 6, '#581c87');
    px(ctx, ox + 4, oy + 5, 5, 5, '#6b21a8'); // slightly lighter center
    // Web pattern on abdomen (lighter purple lines)
    px(ctx, ox + 5, oy + 5, 1, 5, '#7c3aed');
    px(ctx, ox + 7, oy + 6, 1, 3, '#7c3aed');
    px(ctx, ox + 4, oy + 7, 5, 1, '#7c3aed');
    // Abdomen highlight
    px(ctx, ox + 5, oy + 6, 2, 1, '#8b5cf6');

    // Cephalothorax (front segment, smaller)
    px(ctx, ox + 4, oy + 2, 5, 4, '#4c1d95');
    px(ctx, ox + 5, oy + 2, 3, 3, '#581c87'); // slightly lighter

    // Multiple red eyes (cluster of 3-4 tiny dots)
    px(ctx, ox + 5, oy + 2, 1, 1, '#ef4444');
    px(ctx, ox + 7, oy + 2, 1, 1, '#ef4444');
    px(ctx, ox + 6, oy + 3, 1, 1, '#dc2626');
    px(ctx, ox + 5, oy + 3, 1, 1, '#b91c1c');
    // Eye glow
    ctx.globalAlpha = 0.2;
    px(ctx, ox + 4, oy + 1, 5, 3, '#ef4444');
    ctx.globalAlpha = 1;

    // Mandibles with dripping venom
    px(ctx, ox + 5, oy + 5, 1, 1, '#451a03');
    px(ctx, ox + 7, oy + 5, 1, 1, '#451a03');
    // Venom drip (green 1px dots, animated)
    const venomDrip = (frame % 6);
    if (venomDrip < 3) {
      ctx.globalAlpha = 0.7;
      px(ctx, ox + 5, oy + 6 + (venomDrip % 2), 1, 1, '#4ade80');
      ctx.globalAlpha = 0.4;
      px(ctx, ox + 7, oy + 6 + ((venomDrip + 1) % 2), 1, 1, '#4ade80');
      ctx.globalAlpha = 1;
    }

    // 8 legs animated in pairs (4 on each side, alternating up/down)
    // Left legs (4)
    const lUp = legAlt;
    const lDown = 1 - legAlt;
    // Left leg 1 (front top)
    px(ctx, ox + 2, oy + 2 - lUp, 2, 1, '#4c1d95');
    px(ctx, ox, oy + 1 - lUp, 2, 1, '#4c1d95');
    px(ctx, ox, oy + 2 - lUp, 1, 1, '#3b0764');
    // Left leg 2
    px(ctx, ox + 2, oy + 3 + lDown, 2, 1, '#4c1d95');
    px(ctx, ox, oy + 3 + lDown, 2, 1, '#4c1d95');
    px(ctx, ox, oy + 4 + lDown, 1, 1, '#3b0764');
    // Left leg 3
    px(ctx, ox + 2, oy + 6 - lUp, 2, 1, '#4c1d95');
    px(ctx, ox, oy + 6 - lUp, 2, 1, '#4c1d95');
    px(ctx, ox, oy + 7 - lUp, 1, 1, '#3b0764');
    // Left leg 4 (rear)
    px(ctx, ox + 2, oy + 8 + lDown, 2, 1, '#4c1d95');
    px(ctx, ox, oy + 9 + lDown, 2, 1, '#4c1d95');
    px(ctx, ox, oy + 10 + lDown, 1, 1, '#3b0764');

    // Right legs (4) -- mirrored
    // Right leg 1 (front top)
    px(ctx, ox + 9, oy + 2 + lDown, 2, 1, '#4c1d95');
    px(ctx, ox + 11, oy + 1 + lDown, 2, 1, '#4c1d95');
    px(ctx, ox + 12, oy + 2 + lDown, 1, 1, '#3b0764');
    // Right leg 2
    px(ctx, ox + 9, oy + 3 - lUp, 2, 1, '#4c1d95');
    px(ctx, ox + 11, oy + 3 - lUp, 2, 1, '#4c1d95');
    px(ctx, ox + 12, oy + 4 - lUp, 1, 1, '#3b0764');
    // Right leg 3
    px(ctx, ox + 9, oy + 6 + lDown, 2, 1, '#4c1d95');
    px(ctx, ox + 11, oy + 6 + lDown, 2, 1, '#4c1d95');
    px(ctx, ox + 12, oy + 7 + lDown, 1, 1, '#3b0764');
    // Right leg 4 (rear)
    px(ctx, ox + 9, oy + 8 - lUp, 2, 1, '#4c1d95');
    px(ctx, ox + 11, oy + 9 - lUp, 2, 1, '#4c1d95');
    px(ctx, ox + 12, oy + 10 - lUp, 1, 1, '#3b0764');

    this.drawSpriteOutline(ctx, x, y);
  }

  private drawWraith(ctx: CanvasRenderingContext2D, x: number, y: number, facing: Direction, frame: number): void {
    // size 1.0 = 16x16 pixels
    // Larger vertical sine oscillation (floating)
    const floatY = Math.sin(frame * 0.25) * 2.5;
    const fy = y + floatY;

    // Ethereal particle trail (1-2px fading cyan dots behind)
    ctx.globalAlpha = 0.2;
    const trailCount = 5;
    for (let i = 0; i < trailCount; i++) {
      const trailAge = (frame * 0.3 + i * 1.5);
      const tx = x + 8 + Math.sin(trailAge) * 3;
      const ty = fy + 14 + i * 1.5 + Math.cos(trailAge * 0.7) * 1;
      const alpha = 0.3 - i * 0.05;
      if (alpha > 0) {
        ctx.globalAlpha = alpha;
        px(ctx, tx, ty, 1, 1, '#a5f3fc');
      }
    }
    ctx.globalAlpha = 1;

    // Slight cyan glow aura around the figure
    ctx.globalAlpha = 0.08 + Math.sin(frame * 0.2) * 0.04;
    px(ctx, x + 1, fy + 0, 14, 15, '#a5f3fc');
    ctx.globalAlpha = 1;

    // Tattered spectral robes (translucent body)
    ctx.globalAlpha = 0.6;
    // Main robe body
    px(ctx, x + 4, fy + 5, 8, 6, '#164e63');
    px(ctx, x + 5, fy + 4, 6, 2, '#155e75');
    // Robe widens and fades to nothing at bottom
    px(ctx, x + 3, fy + 10, 10, 2, '#134e4a');
    px(ctx, x + 2, fy + 12, 12, 1, '#0f3d3b');
    // Tattered robe edges (ragged hem)
    const tatterWave1 = Math.sin(frame * 0.4) * 1;
    const tatterWave2 = Math.sin(frame * 0.4 + 2) * 1;
    px(ctx, x + 2 + tatterWave1, fy + 13, 3, 1, '#0d3331');
    px(ctx, x + 7, fy + 13 + tatterWave2 * 0.5, 2, 1, '#0d3331');
    px(ctx, x + 11 - tatterWave1, fy + 13, 2, 1, '#0d3331');
    // Fading bottom wisps
    ctx.globalAlpha = 0.3;
    px(ctx, x + 3 + tatterWave2, fy + 14, 2, 1, '#134e4a');
    px(ctx, x + 9 - tatterWave2, fy + 14, 2, 1, '#134e4a');
    ctx.globalAlpha = 0.15;
    px(ctx, x + 5, fy + 15, 3, 1, '#164e63');
    ctx.globalAlpha = 0.6;

    // Hood / head area
    px(ctx, x + 4, fy + 1, 8, 4, '#1e293b');
    px(ctx, x + 5, fy + 0, 6, 2, '#1e293b');
    // Hood shadow depth
    px(ctx, x + 5, fy + 2, 6, 2, '#0f172a');
    ctx.globalAlpha = 1;

    // Hollow glowing cyan eyes
    px(ctx, x + 5, fy + 2, 2, 2, '#000000');
    px(ctx, x + 9, fy + 2, 2, 2, '#000000');
    // Cyan glow core
    const eyePulse = 0.6 + Math.sin(frame * 0.5) * 0.4;
    px(ctx, x + 5, fy + 2, 1, 1, eyePulse > 0.7 ? '#67e8f9' : '#22d3ee');
    px(ctx, x + 10, fy + 2, 1, 1, eyePulse > 0.7 ? '#67e8f9' : '#22d3ee');
    // Eye glow aura
    ctx.globalAlpha = eyePulse * 0.25;
    px(ctx, x + 4, fy + 1, 4, 4, '#22d3ee');
    px(ctx, x + 8, fy + 1, 4, 4, '#22d3ee');
    ctx.globalAlpha = 1;

    // Ghostly hands reaching forward
    ctx.globalAlpha = 0.5;
    const handWave = Math.sin(frame * 0.35) * 1;
    // Left hand
    px(ctx, x + 2, fy + 6 + handWave, 2, 3, '#94a3b8');
    px(ctx, x + 1, fy + 7 + handWave, 1, 1, '#94a3b8');
    // Right hand
    px(ctx, x + 12, fy + 6 - handWave, 2, 3, '#94a3b8');
    px(ctx, x + 14, fy + 7 - handWave, 1, 1, '#94a3b8');
    // Ghostly finger wisps
    ctx.globalAlpha = 0.3;
    px(ctx, x + 0, fy + 7 + handWave, 1, 1, '#cbd5e1');
    px(ctx, x + 15, fy + 7 - handWave, 1, 1, '#cbd5e1');
    ctx.globalAlpha = 1;

    this.drawSpriteOutline(ctx, x, y);
  }

  private drawMushroom(ctx: CanvasRenderingContext2D, x: number, y: number, facing: Direction, frame: number): void {
    // size 0.9 = ~14x14 pixels
    const ox = x + 1;
    const oy = y + 1;

    // Cap bobbing animation
    const capBob = Math.sin(frame * 0.3) * 0.8;

    // Spore cloud animation: small particles floating up from cap
    const sporeCount = 4;
    for (let i = 0; i < sporeCount; i++) {
      const sporeAge = (frame * 0.15 + i * 2.5) % 8;
      const sx = ox + 3 + i * 2.5 + Math.sin(frame * 0.2 + i * 1.7) * 2;
      const sy = oy - 1 + capBob - sporeAge * 1.2;
      const sporeAlpha = 0.3 - sporeAge * 0.035;
      if (sporeAlpha > 0 && sy > oy - 6) {
        ctx.globalAlpha = sporeAlpha;
        px(ctx, sx, sy, 1, 1, i % 2 === 0 ? '#a3e635' : '#fde047');
      }
    }
    ctx.globalAlpha = 1;

    // Stumpy body/stem (beige/tan)
    px(ctx, ox + 4, oy + 7, 6, 5, '#d4a574');
    px(ctx, ox + 5, oy + 7, 4, 4, '#e8c9a0'); // lighter center
    // Stem texture (darker streaks)
    px(ctx, ox + 5, oy + 8, 1, 3, '#c4956a');
    px(ctx, ox + 8, oy + 8, 1, 3, '#c4956a');

    // Tiny stubby feet
    px(ctx, ox + 3, oy + 12, 3, 2, '#b8956a');
    px(ctx, ox + 8, oy + 12, 3, 2, '#b8956a');
    // Foot detail
    px(ctx, ox + 3, oy + 12, 1, 1, '#a07850');
    px(ctx, ox + 10, oy + 12, 1, 1, '#a07850');

    // Small angry face on stem
    // Dot eyes (angry)
    px(ctx, ox + 5, oy + 8, 1, 1, '#1a1a2e');
    px(ctx, ox + 8, oy + 8, 1, 1, '#1a1a2e');
    // Angry eyebrows
    px(ctx, ox + 5, oy + 7, 2, 1, '#8b4513');
    px(ctx, ox + 7, oy + 7, 2, 1, '#8b4513');
    // Frown mouth
    px(ctx, ox + 6, oy + 10, 2, 1, '#1a1a2e');
    px(ctx, ox + 5, oy + 9, 1, 1, '#1a1a2e');
    px(ctx, ox + 8, oy + 9, 1, 1, '#1a1a2e');

    // Large mushroom cap (red with white spots - amanita style)
    px(ctx, ox + 1, oy + 2 + capBob, 12, 5, '#dc2626');
    px(ctx, ox + 2, oy + 1 + capBob, 10, 2, '#ef4444');
    px(ctx, ox + 3, oy + 0 + capBob, 8, 1, '#dc2626');
    // Cap bottom edge (darker, with gill-like underside)
    px(ctx, ox + 2, oy + 6 + capBob, 10, 1, '#991b1b');
    // Gill lines (darker red below cap)
    px(ctx, ox + 3, oy + 6 + capBob, 1, 1, '#7f1d1d');
    px(ctx, ox + 5, oy + 6 + capBob, 1, 1, '#7f1d1d');
    px(ctx, ox + 7, oy + 6 + capBob, 1, 1, '#7f1d1d');
    px(ctx, ox + 9, oy + 6 + capBob, 1, 1, '#7f1d1d');

    // White spots on cap (classic amanita)
    px(ctx, ox + 3, oy + 2 + capBob, 2, 2, '#ffffff');
    px(ctx, ox + 7, oy + 1 + capBob, 2, 1, '#ffffff');
    px(ctx, ox + 9, oy + 3 + capBob, 2, 2, '#ffffff');
    px(ctx, ox + 5, oy + 4 + capBob, 1, 1, '#ffffff');
    // Spot shading (cream tint)
    px(ctx, ox + 4, oy + 3 + capBob, 1, 1, '#fef3c7');
    px(ctx, ox + 10, oy + 4 + capBob, 1, 1, '#fef3c7');

    // Cap highlight (sheen)
    px(ctx, ox + 3, oy + 1 + capBob, 3, 1, '#f87171');
    px(ctx, ox + 2, oy + 2 + capBob, 1, 1, '#f87171');

    // Poison drip from cap edge
    const dripPhase = frame % 12;
    if (dripPhase < 6) {
      ctx.globalAlpha = 0.6;
      px(ctx, ox + 2, oy + 7 + capBob + (dripPhase % 3), 1, 1, '#4ade80');
      ctx.globalAlpha = 0.4;
      px(ctx, ox + 11, oy + 7 + capBob + ((dripPhase + 1) % 3), 1, 1, '#4ade80');
      ctx.globalAlpha = 1;
    }

    // Small stubby arms
    px(ctx, ox + 2, oy + 8, 2, 2, '#d4a574');
    px(ctx, ox + 10, oy + 8, 2, 2, '#d4a574');

    this.drawSpriteOutline(ctx, x, y);
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
    _tiles?: unknown,
    _mapWidth?: number,
    _mapHeight?: number,
    _animFrame?: number,
  ): void {
    // Use tile grid position for deterministic variation (not screen coords)
    const hash = tileHash(tileX + 1000, tileY + 1000);

    // Cache each tile as an offscreen canvas — tiles are fully deterministic per hash
    // Use only bits that affect visual output (bits 0-10 cover all tile drawing branches)
    const reducedHash = hash & 0x7ff;
    const cacheKey = `tile_${type}_${reducedHash}_${roomCleared ? 1 : 0}`;
    let cached = this.tileCache.get(cacheKey);
    if (!cached) {
      cached = document.createElement('canvas');
      cached.width = TILE_SIZE;
      cached.height = TILE_SIZE;
      const sprCtx = cached.getContext('2d');
      if (sprCtx) {
        switch (type) {
          case 'floor': this.drawFloorTile(sprCtx, 0, 0, hash); break;
          case 'wall': this.drawWallTile(sprCtx, 0, 0, hash); break;
          case 'door': this.drawDoorTile(sprCtx, 0, 0, roomCleared); break;
          case 'stairs': this.drawStairsTile(sprCtx, 0, 0); break;
          case 'chest': this.drawChestTile(sprCtx, 0, 0, roomCleared); break;
          case 'void': px(sprCtx, 0, 0, TILE_SIZE, TILE_SIZE, '#000000'); break;
        }
      }
      this.tileCache.set(cacheKey, cached);
    }
    ctx.drawImage(cached, Math.floor(x), Math.floor(y));
  }

  private drawFloorTile(ctx: CanvasRenderingContext2D, x: number, y: number, hash: number): void {
    const variation = hash % 5;

    // Base stone floor — bright enough to be visible through fog
    px(ctx, x, y, TILE_SIZE, TILE_SIZE, '#3e3e5c');

    // Grid lines (mortar)
    ctx.fillStyle = '#4a4a68';
    ctx.fillRect(x + TILE_SIZE - 1, y, 1, TILE_SIZE);
    ctx.fillRect(x, y + TILE_SIZE - 1, TILE_SIZE, 1);

    // Stone tile variation (5 types)
    if (variation === 0) {
      // Clean stone
      px(ctx, x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2, '#424266');
    } else if (variation === 1) {
      // Cracked stone
      px(ctx, x + 3, y + 5, 1, 4, '#32324c');
      px(ctx, x + 4, y + 8, 1, 3, '#32324c');
      px(ctx, x + 5, y + 10, 1, 2, '#32324c');
      px(ctx, x + 2, y + 6, 1, 1, '#2c2c44');
      px(ctx, x + 4, y + 9, 1, 1, '#2c2c44');
      px(ctx, x + 6, y + 11, 1, 1, '#32324c');
      px(ctx, x + 9, y + 3, 1, 3, '#32324c');
      px(ctx, x + 10, y + 5, 1, 2, '#2c2c44');
    } else if (variation === 2) {
      // Moss with mushroom
      px(ctx, x + 10, y + 3, 2, 1, '#3a6e3a');
      px(ctx, x + 11, y + 4, 1, 1, '#3a6e3a');
      px(ctx, x + 4, y + 11, 2, 1, '#3a6e3a');
      px(ctx, x + 3, y + 12, 1, 1, '#2e8848');
      px(ctx, x + 12, y + 5, 1, 1, '#c87020');
      px(ctx, x + 11, y + 4, 2, 1, '#d88e20');
      if ((hash >> 4) % 3 === 0) {
        px(ctx, x + 5, y + 12, 1, 1, '#a86822');
        px(ctx, x + 4, y + 11, 2, 1, '#d88e20');
      }
    } else if (variation === 3) {
      // Blood stain
      ctx.globalAlpha = 0.5;
      px(ctx, x + 5, y + 6, 4, 3, '#6a2424');
      px(ctx, x + 6, y + 5, 2, 1, '#5a1818');
      px(ctx, x + 4, y + 8, 2, 1, '#5a1818');
      ctx.globalAlpha = 0.3;
      px(ctx, x + 8, y + 7, 2, 2, '#6a2424');
      px(ctx, x + 3, y + 5, 1, 1, '#5a1818');
      px(ctx, x + 10, y + 8, 1, 1, '#5a1818');
      ctx.globalAlpha = 1;
    } else {
      // Water puddle
      px(ctx, x + 4, y + 5, 7, 5, '#384858');
      px(ctx, x + 5, y + 4, 5, 1, '#384858');
      px(ctx, x + 5, y + 10, 5, 1, '#384858');
      const shimmerOffset = (hash >> 6) % 4;
      ctx.globalAlpha = 0.3;
      px(ctx, x + 5 + shimmerOffset, y + 6, 2, 1, '#80c0ff');
      px(ctx, x + 7 - shimmerOffset, y + 8, 2, 1, '#80c0ff');
      ctx.globalAlpha = 0.15;
      px(ctx, x + 6, y + 7, 3, 1, '#b0d8ff');
      ctx.globalAlpha = 1;
    }

    // Occasional stone detail
    if ((hash >> 8) % 5 === 0) {
      px(ctx, x + 7, y + 7, 2, 2, '#464666');
    }
  }

  private drawWallTile(ctx: CanvasRenderingContext2D, x: number, y: number, hash: number): void {
    // Base wall — vibrant purple, clearly distinct from floor
    px(ctx, x, y, TILE_SIZE, TILE_SIZE, '#5038a0');

    // Top slightly lighter
    px(ctx, x, y, TILE_SIZE, 3, '#6048b0');

    // Brick mortar lines
    const mortarColor = '#3a2878';
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

    // Individual brick color variation (based on hash bits)
    const brickVar1 = ((hash >> 2) % 3);
    const brickVar2 = ((hash >> 5) % 3);
    if (brickVar1 === 0) {
      px(ctx, x + 1, y + 1, 3, 3, '#5838a8');
    } else if (brickVar1 === 1) {
      px(ctx, x + 5, y + 1, 6, 3, '#483095');
    }
    if (brickVar2 === 0) {
      px(ctx, x + 1, y + 5, 7, 4, '#4a2e9a');
    } else if (brickVar2 === 2) {
      px(ctx, x + 9, y + 5, 6, 4, '#5a3caa');
    }
    if (((hash >> 7) % 2) === 0) {
      px(ctx, x + 5, y + 10, 6, 4, '#4a2e9a');
    }

    // Brick highlights
    px(ctx, x + 1, y + 1, 2, 1, '#6040b0');
    px(ctx, x + 6, y + 6, 2, 1, '#6040b0');
    px(ctx, x + 1, y + 11, 2, 1, '#6040b0');
    px(ctx, x + 9, y + 1, 2, 1, '#6040b0');
    px(ctx, x + 13, y + 11, 2, 1, '#6040b0');

    // Border edges
    ctx.fillStyle = '#3a2878';
    ctx.fillRect(x, y, TILE_SIZE, 1);
    ctx.fillRect(x, y, 1, TILE_SIZE);
    ctx.fillStyle = '#6048b0';
    ctx.fillRect(x, y + TILE_SIZE - 1, TILE_SIZE, 1);
    ctx.fillRect(x + TILE_SIZE - 1, y, 1, TILE_SIZE);

    // Moss/vine
    if ((hash >> 4) % 4 === 0) {
      px(ctx, x + 2, y + 13, 1, 2, '#2a4e2a');
      px(ctx, x + 3, y + 12, 1, 3, '#1e6838');
      px(ctx, x + 4, y + 14, 1, 1, '#2a4e2a');
      px(ctx, x + 1, y + 14, 1, 1, '#164428');
      px(ctx, x + 5, y + 13, 1, 2, '#1e6838');
      px(ctx, x + 3, y + 11, 1, 1, '#266038');
    }
    if ((hash >> 10) % 3 === 0) {
      px(ctx, x + 12, y + 14, 2, 1, '#2a4e2a');
      px(ctx, x + 13, y + 13, 1, 1, '#1e6838');
    }

    // Skull decoration
    if ((hash >> 14) % 9 === 0) {
      px(ctx, x + 6, y + 10, 4, 3, '#d1d5db');
      px(ctx, x + 7, y + 10, 2, 1, '#e5e7eb');
      px(ctx, x + 6, y + 11, 1, 1, '#2a2a48');
      px(ctx, x + 9, y + 11, 1, 1, '#2a2a48');
      px(ctx, x + 7, y + 12, 2, 1, '#b0b0b0');
    }

    // Torch placement more frequent (1 in 5 walls instead of 1 in 7)
    if ((hash >> 8) % 5 === 0) {
      this.drawWallTorch(ctx, x + 6, y + 3, hash);
    }
  }

  /** Draw a small torch on wall */
  drawWallTorch(ctx: CanvasRenderingContext2D, x: number, y: number, hash: number): void {
    // Torch holder
    px(ctx, x + 1, y + 2, 2, 4, '#78350f');
    px(ctx, x, y + 5, 4, 1, '#92400e');

    // Flame (2 frames based on hash trick -- flickers)
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
    px(ctx, x, y, TILE_SIZE, TILE_SIZE, '#3e3e5c');

    if (roomCleared) {
      // Open door: swung open against wall
      // Door frame
      px(ctx, x, y, 2, TILE_SIZE, '#5c3d1e');
      px(ctx, x + TILE_SIZE - 2, y, 2, TILE_SIZE, '#5c3d1e');
      px(ctx, x, y, TILE_SIZE, 2, '#5c3d1e');

      // Open door panel (shown from side, leaning against frame)
      px(ctx, x + 1, y + 2, 3, TILE_SIZE - 3, '#8b6914');
      px(ctx, x + 2, y + 3, 1, TILE_SIZE - 5, '#a67c1a'); // highlight
      // Iron band visible on open door panel
      px(ctx, x + 1, y + 4, 3, 1, '#6b7280');
      px(ctx, x + 1, y + 10, 3, 1, '#6b7280');

      // Passage visible
      px(ctx, x + 4, y + 2, TILE_SIZE - 6, TILE_SIZE - 3, '#2a2a48');

      // Torch light from beyond the door
      ctx.globalAlpha = 0.12;
      px(ctx, x + 5, y + 3, TILE_SIZE - 8, TILE_SIZE - 5, '#f59e0b');
      ctx.globalAlpha = 0.06;
      px(ctx, x + 4, y + 2, TILE_SIZE - 6, TILE_SIZE - 3, '#fbbf24');
      ctx.globalAlpha = 1;
    } else {
      // Closed: solid wooden door with iron bindings -- reinforced
      px(ctx, x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2, '#6b4f2a');

      // Wood grain
      px(ctx, x + 4, y + 2, 1, TILE_SIZE - 4, '#5c3d1e');
      px(ctx, x + 8, y + 2, 1, TILE_SIZE - 4, '#5c3d1e');
      px(ctx, x + 12, y + 2, 1, TILE_SIZE - 4, '#5c3d1e');

      // Reinforced iron bands -- more prominent (thicker, with rivets)
      px(ctx, x + 1, y + 3, TILE_SIZE - 2, 2, '#6b7280');
      px(ctx, x + 1, y + TILE_SIZE - 5, TILE_SIZE - 2, 2, '#6b7280');
      // Iron band highlights
      px(ctx, x + 2, y + 3, TILE_SIZE - 4, 1, '#9ca3af');
      px(ctx, x + 2, y + TILE_SIZE - 5, TILE_SIZE - 4, 1, '#9ca3af');
      // Rivets on iron bands
      px(ctx, x + 3, y + 3, 1, 1, '#d1d5db');
      px(ctx, x + 7, y + 3, 1, 1, '#d1d5db');
      px(ctx, x + 11, y + 3, 1, 1, '#d1d5db');
      px(ctx, x + 3, y + TILE_SIZE - 5, 1, 1, '#d1d5db');
      px(ctx, x + 7, y + TILE_SIZE - 5, 1, 1, '#d1d5db');
      px(ctx, x + 11, y + TILE_SIZE - 5, 1, 1, '#d1d5db');
      // Middle iron band
      px(ctx, x + 1, y + 8, TILE_SIZE - 2, 1, '#4b5563');

      // Iron ring handle
      px(ctx, x + 10, y + 6, 3, 3, '#9ca3af');
      px(ctx, x + 11, y + 7, 1, 1, '#6b4f2a'); // hole in ring
      // Handle highlight
      px(ctx, x + 10, y + 6, 1, 1, '#d1d5db');

      // Door frame (thicker, more defined)
      px(ctx, x, y, TILE_SIZE, 1, '#3b2a1a');
      px(ctx, x, y, 1, TILE_SIZE, '#3b2a1a');
      px(ctx, x + TILE_SIZE - 1, y, 1, TILE_SIZE, '#4a3728');
      px(ctx, x, y + TILE_SIZE - 1, TILE_SIZE, 1, '#4a3728');
      // Frame inner edge highlight
      px(ctx, x + 1, y + 1, TILE_SIZE - 2, 1, '#5c3d1e');
      px(ctx, x + 1, y + 1, 1, TILE_SIZE - 2, '#5c3d1e');
    }
  }

  private drawStairsTile(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    // Background (stairs descend into shadow)
    px(ctx, x, y, TILE_SIZE, TILE_SIZE, '#252540');

    // Spiral staircase going down -- more step detail
    const stairColor = '#78716c';
    const stairLight = '#a8a29e';
    const stairDark = '#57534e';

    // Steps descending left to right, curving -- more steps for better spiral illusion
    px(ctx, x + 2, y + 0, 12, 2, stairLight);
    px(ctx, x + 3, y + 0, 10, 1, lighten(stairLight, 0.2)); // top step highlight
    px(ctx, x + 3, y + 3, 11, 2, stairColor);
    px(ctx, x + 3, y + 3, 10, 1, lighten(stairColor, 0.1));
    px(ctx, x + 4, y + 6, 10, 2, darken(stairColor, 0.1));
    px(ctx, x + 4, y + 6, 9, 1, stairColor);
    px(ctx, x + 3, y + 9, 10, 2, darken(stairColor, 0.15));
    px(ctx, x + 3, y + 9, 9, 1, darken(stairColor, 0.05));
    px(ctx, x + 2, y + 12, 10, 2, darken(stairColor, 0.25));
    px(ctx, x + 2, y + 12, 9, 1, darken(stairColor, 0.15));

    // Step edge shadows (depth illusion)
    px(ctx, x + 2, y + 2, 12, 1, stairDark);
    px(ctx, x + 3, y + 5, 11, 1, stairDark);
    px(ctx, x + 4, y + 8, 10, 1, darken(stairDark, 0.1));
    px(ctx, x + 3, y + 11, 10, 1, darken(stairDark, 0.15));
    px(ctx, x + 2, y + 14, 10, 1, darken(stairDark, 0.2));

    // Railing with detail
    px(ctx, x + 1, y + 0, 1, TILE_SIZE, '#451a03');
    px(ctx, x + 0, y + 0, 1, TILE_SIZE, '#3b1400');
    // Railing posts
    px(ctx, x + 1, y + 0, 1, 1, '#5c3d1e');
    px(ctx, x + 1, y + 5, 1, 1, '#5c3d1e');
    px(ctx, x + 1, y + 10, 1, 1, '#5c3d1e');

    // Torch on the wall beside stairs
    px(ctx, x + 14, y + 1, 1, 3, '#78350f'); // torch handle
    px(ctx, x + 14, y + 0, 1, 1, '#fbbf24'); // flame
    px(ctx, x + 13, y + 0, 1, 1, '#f97316'); // flame flicker
    // Torch light glow
    ctx.globalAlpha = 0.1;
    px(ctx, x + 12, y + 0, 4, 3, '#fbbf24');
    ctx.globalAlpha = 1;

    // Magical rune circle at the base
    ctx.globalAlpha = 0.25;
    px(ctx, x + 4, y + 14, 8, 1, '#a78bfa');
    px(ctx, x + 3, y + 13, 1, 1, '#a78bfa');
    px(ctx, x + 12, y + 13, 1, 1, '#a78bfa');
    px(ctx, x + 5, y + 15, 6, 1, '#8b5cf6');
    // Rune dots
    px(ctx, x + 6, y + 14, 1, 1, '#c4b5fd');
    px(ctx, x + 9, y + 14, 1, 1, '#c4b5fd');
    ctx.globalAlpha = 1;

    // Glow from below
    ctx.globalAlpha = 0.2;
    px(ctx, x + 4, y + 12, 8, 3, '#f59e0b');
    ctx.globalAlpha = 0.1;
    px(ctx, x + 2, y + 10, 12, 5, '#f59e0b');
    ctx.globalAlpha = 1;
  }

  private drawChestTile(ctx: CanvasRenderingContext2D, x: number, y: number, opened: boolean): void {
    // Floor beneath
    px(ctx, x, y, TILE_SIZE, TILE_SIZE, '#3e3e5c');

    if (opened) {
      // Open chest with golden glow -- radial glow effect
      // Outer glow ring
      ctx.globalAlpha = 0.08 + Math.sin(Date.now() * 0.003) * 0.05;
      px(ctx, x, y, TILE_SIZE, TILE_SIZE, '#fbbf24');
      ctx.globalAlpha = 0.15 + Math.sin(Date.now() * 0.003) * 0.1;
      px(ctx, x + 1, y + 1, 14, 10, '#fbbf24');
      ctx.globalAlpha = 0.25 + Math.sin(Date.now() * 0.004) * 0.1;
      px(ctx, x + 3, y + 3, 10, 6, '#fef3c7');
      ctx.globalAlpha = 1;

      // Chest body
      px(ctx, x + 3, y + 6, 10, 6, '#92400e');
      // Gold bands
      px(ctx, x + 3, y + 6, 10, 1, '#eab308');
      px(ctx, x + 3, y + 11, 10, 1, '#eab308');

      // Gem decorations on chest body
      px(ctx, x + 4, y + 8, 1, 1, '#ef4444'); // red gem
      px(ctx, x + 11, y + 8, 1, 1, '#3b82f6'); // blue gem
      px(ctx, x + 7, y + 10, 2, 1, '#4ade80'); // green gem

      // Lid up (tilted back)
      px(ctx, x + 3, y + 3, 10, 3, '#78350f');
      px(ctx, x + 4, y + 3, 8, 1, '#92400e');
      // Gold band on lid
      px(ctx, x + 3, y + 5, 10, 1, '#eab308');

      // Golden glow inside
      px(ctx, x + 4, y + 7, 8, 4, '#fbbf24');
      px(ctx, x + 5, y + 8, 6, 2, '#fef3c7');

      // Coins spilling out of open chest
      px(ctx, x + 2, y + 11, 2, 1, '#eab308');
      px(ctx, x + 1, y + 12, 1, 1, '#ca8a04');
      px(ctx, x + 12, y + 11, 2, 1, '#fbbf24');
      px(ctx, x + 13, y + 12, 1, 1, '#eab308');
      px(ctx, x + 3, y + 12, 1, 1, '#fbbf24');
      // Coin highlights
      px(ctx, x + 2, y + 11, 1, 1, '#fef3c7');
      px(ctx, x + 12, y + 11, 1, 1, '#fef3c7');
    } else {
      // Closed chest with keyhole and gem decorations
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

      // Gem decorations on chest
      px(ctx, x + 5, y + 6, 1, 1, '#ef4444'); // red gem left
      px(ctx, x + 10, y + 6, 1, 1, '#3b82f6'); // blue gem right
      px(ctx, x + 5, y + 10, 1, 1, '#4ade80'); // green gem bottom left
      px(ctx, x + 10, y + 10, 1, 1, '#a78bfa'); // purple gem bottom right

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
    type: 'arrow' | 'fireball' | 'sword_slash' | 'holy_bolt',
    frame: number,
    vx = 0,
    vy = 0,
    dirX = 0,
    dirY = 0,
  ): void {
    switch (type) {
      case 'arrow': this.drawArrowProjectile(ctx, x, y, vx, vy); break;
      case 'fireball': this.drawFireballProjectile(ctx, x, y, frame); break;
      case 'sword_slash': this.drawSwordSlashProjectile(ctx, x, y, frame, dirX, dirY); break;
      case 'holy_bolt': this.drawHolyBoltProjectile(ctx, x, y, frame, vx, vy); break;
    }
  }

  private drawArrowProjectile(ctx: CanvasRenderingContext2D, x: number, y: number, vx: number, vy: number): void {
    // Calculate rotation from velocity
    const angle = Math.atan2(vy, vx);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    // Arrow length = 9px
    const len = 9;
    const tipX = Math.floor(x + cos * len);
    const tipY = Math.floor(y + sin * len);
    const tailX = Math.floor(x - cos * 3);
    const tailY = Math.floor(y - sin * 3);

    // Motion trail (fading copies behind)
    ctx.globalAlpha = 0.15;
    const t1x = Math.floor(x - cos * 6);
    const t1y = Math.floor(y - sin * 6);
    px(ctx, t1x, t1y, 1, 1, '#78350f');

    ctx.globalAlpha = 0.25;
    const t2x = Math.floor(x - cos * 4);
    const t2y = Math.floor(y - sin * 4);
    px(ctx, t2x, t2y, 1, 1, '#92400e');
    ctx.globalAlpha = 1;

    // Metal tip (arrowhead)
    px(ctx, tipX, tipY, 2, 1, '#9ca3af');
    px(ctx, tipX - Math.floor(cos), tipY - Math.floor(sin), 1, 1, '#6b7280');
    px(ctx, tipX + Math.floor(sin), tipY - Math.floor(cos), 1, 1, '#9ca3af');
    px(ctx, tipX - Math.floor(sin), tipY + Math.floor(cos), 1, 1, '#9ca3af');

    // Wood shaft
    const midX = Math.floor(x + cos * 3);
    const midY = Math.floor(y + sin * 3);
    px(ctx, midX, midY, 1, 1, '#92400e');
    px(ctx, Math.floor(x + cos), Math.floor(y + sin), 1, 1, '#78350f');
    px(ctx, x, y, 1, 1, '#78350f');
    px(ctx, Math.floor(x - cos), Math.floor(y - sin), 1, 1, '#78350f');

    // Feathered fletching
    px(ctx, tailX, tailY, 1, 1, '#fbbf24');
    px(ctx, tailX + Math.floor(sin), tailY - Math.floor(cos), 1, 1, '#f59e0b');
    px(ctx, tailX - Math.floor(sin), tailY + Math.floor(cos), 1, 1, '#f59e0b');
    px(ctx, tailX + Math.floor(sin * 2), tailY - Math.floor(cos * 2), 1, 1, '#d97706');
    px(ctx, tailX - Math.floor(sin * 2), tailY + Math.floor(cos * 2), 1, 1, '#d97706');
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

  private drawSwordSlashProjectile(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number, dirX: number, dirY: number): void {
    const slashPhase = frame % 4;
    const progress = slashPhase / 3; // 0 to 1

    // Determine primary direction angle
    const angle = Math.atan2(dirY || 0, dirX || 1);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    // Perpendicular for arc sweep
    const perpX = -sin;
    const perpY = cos;

    // Arc sweep: start from one side, sweep to the other
    const sweepStart = -1 + progress * 2; // -1 to 1
    const arcRadius = 10;
    const arcWidth = 12;

    // Main slash arc (multiple segments along the sweep)
    const segments = 5;
    for (let i = 0; i < segments; i++) {
      const t = sweepStart + (i / segments) * 0.8;
      if (t < -1 || t > 1) continue;

      const segAlpha = 0.9 - Math.abs(t - sweepStart) * 0.3 - progress * 0.2;
      ctx.globalAlpha = Math.max(0, segAlpha);

      const ox = Math.floor(cos * arcRadius * 0.6 + perpX * t * arcWidth);
      const oy = Math.floor(sin * arcRadius * 0.6 + perpY * t * arcWidth);

      // White/silver slash trail
      px(ctx, x + ox, y + oy, 2, 2, '#ffffff');
      px(ctx, x + ox - 1, y + oy - 1, 1, 1, '#e5e7eb');
    }

    // Leading edge glow
    const edgeT = sweepStart + 0.8;
    const edgeAlpha = 0.8 - progress * 0.3;
    ctx.globalAlpha = Math.max(0, edgeAlpha);
    const edgeX = Math.floor(cos * arcRadius * 0.6 + perpX * edgeT * arcWidth);
    const edgeY = Math.floor(sin * arcRadius * 0.6 + perpY * edgeT * arcWidth);
    px(ctx, x + edgeX, y + edgeY, 3, 3, '#fef3c7');

    // Directional spark particles
    ctx.globalAlpha = 0.7 - progress * 0.3;
    for (let s = 0; s < 3; s++) {
      const sparkT = sweepStart + s * 0.3;
      const sparkDist = arcRadius * (0.4 + s * 0.15);
      const sparkX = Math.floor(cos * sparkDist * 0.5 + perpX * sparkT * arcWidth * 1.2);
      const sparkY = Math.floor(sin * sparkDist * 0.5 + perpY * sparkT * arcWidth * 1.2);
      px(ctx, x + sparkX, y + sparkY, 1, 1, s === 0 ? '#ffffff' : '#fef3c7');
    }

    // Center flash on early frames
    if (slashPhase < 2) {
      ctx.globalAlpha = 0.4 - progress * 0.3;
      px(ctx, x - 1, y - 1, 3, 3, '#ffffff');
    }

    ctx.globalAlpha = 1;
  }

  private drawHolyBoltProjectile(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number, vx: number, vy: number): void {
    const phase = frame % 3;
    const angle = Math.atan2(vy, vx);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    // Outer glow (golden)
    ctx.globalAlpha = 0.2;
    px(ctx, x - 4, y - 4, 8, 8, '#fbbf24');
    ctx.globalAlpha = 1;

    // Core (white-gold, animated)
    if (phase === 0) {
      px(ctx, x - 2, y - 2, 4, 4, '#fef3c7');
      px(ctx, x - 1, y - 1, 2, 2, '#ffffff');
    } else if (phase === 1) {
      px(ctx, x - 2, y - 1, 4, 3, '#fef3c7');
      px(ctx, x - 1, y - 2, 2, 4, '#fef3c7');
      px(ctx, x, y, 1, 1, '#ffffff');
    } else {
      px(ctx, x - 1, y - 2, 3, 5, '#fef3c7');
      px(ctx, x - 1, y - 1, 3, 2, '#ffffff');
    }

    // Trailing sparkles
    ctx.globalAlpha = 0.4;
    const t1x = Math.floor(x - cos * 5);
    const t1y = Math.floor(y - sin * 5);
    px(ctx, t1x, t1y, 1, 1, '#fde68a');
    ctx.globalAlpha = 0.2;
    const t2x = Math.floor(x - cos * 8);
    const t2y = Math.floor(y - sin * 8);
    px(ctx, t2x, t2y, 1, 1, '#f59e0b');
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
    const bounceY = Math.sin(frame * 0.15) * 3.5;
    const ly = y + bounceY;

    // Elliptical shadow beneath loot
    this.drawEntityShadow(ctx, x, y, 16, 16);

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
    // Cork top with texture
    px(ctx, x + 6, y + 2, 4, 2, '#92400e');
    px(ctx, x + 7, y + 2, 1, 1, '#a16207'); // cork grain
    px(ctx, x + 8, y + 3, 1, 1, '#78350f'); // cork grain

    // Bottle neck -- curved
    px(ctx, x + 6, y + 4, 4, 2, '#d1d5db');
    px(ctx, x + 6, y + 4, 1, 1, '#e5e7eb'); // glass highlight

    // Bottle body (red liquid) -- more curved shape
    px(ctx, x + 5, y + 5, 6, 1, '#dc2626'); // neck transition
    px(ctx, x + 4, y + 6, 8, 5, '#ef4444');
    px(ctx, x + 5, y + 11, 6, 1, '#b91c1c');
    // Bottom curve
    px(ctx, x + 5, y + 11, 6, 1, '#dc2626');

    // Heart label
    px(ctx, x + 7, y + 7, 2, 1, '#fecaca');
    px(ctx, x + 6, y + 8, 4, 1, '#fecaca');
    px(ctx, x + 7, y + 9, 2, 1, '#fecaca');

    // Liquid slosh animation -- tilts left/right (low threshold for near-constant visibility)
    const slosh = Math.sin(frame * 0.2);
    if (slosh > 0.1) {
      px(ctx, x + 5, y + 7, 2, 1, lighten('#ef4444', 0.3));
      px(ctx, x + 5, y + 8, 1, 1, lighten('#ef4444', 0.2));
    } else if (slosh < -0.1) {
      px(ctx, x + 9, y + 7, 2, 1, lighten('#ef4444', 0.3));
      px(ctx, x + 10, y + 8, 1, 1, lighten('#ef4444', 0.2));
    }

    // Red liquid highlight bubble
    px(ctx, x + 9, y + 7, 1, 1, '#fca5a5');

    // Glass highlight
    px(ctx, x + 5, y + 6, 1, 3, lighten('#ef4444', 0.4));

    // Sparkle effect (1px white dot that appears/disappears)
    const sparkle = (frame % 20);
    if (sparkle < 4) {
      px(ctx, x + 10, y + 6, 1, 1, '#ffffff');
    } else if (sparkle > 10 && sparkle < 14) {
      px(ctx, x + 5, y + 9, 1, 1, '#ffffff');
    }
  }

  private drawManaPotion(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number): void {
    // Cork
    px(ctx, x + 6, y + 2, 4, 2, '#92400e');
    px(ctx, x + 7, y + 2, 1, 1, '#a16207');

    // Bottle neck -- more elegant shape
    px(ctx, x + 6, y + 4, 4, 2, '#d1d5db');
    px(ctx, x + 6, y + 4, 1, 1, '#e5e7eb');

    // Bottle body (blue liquid) -- elegant wider body
    px(ctx, x + 5, y + 5, 6, 1, '#2563eb'); // neck transition
    px(ctx, x + 4, y + 6, 8, 5, '#3b82f6');
    px(ctx, x + 5, y + 11, 6, 1, '#1d4ed8');

    // Star-shaped label
    px(ctx, x + 7, y + 7, 2, 3, '#bfdbfe');
    px(ctx, x + 6, y + 8, 4, 1, '#bfdbfe');

    // Swirling particle inside
    const swirlAngle = frame * 0.3;
    const swirlX = x + 7 + Math.cos(swirlAngle) * 1.5;
    const swirlY = y + 8 + Math.sin(swirlAngle) * 1;
    px(ctx, swirlX, swirlY, 1, 1, '#93c5fd');

    // Glass highlight
    px(ctx, x + 5, y + 6, 1, 3, lighten('#3b82f6', 0.4));

    // Blue sparkle particles rising
    if (frame % 6 < 3) {
      px(ctx, x + 7, y + 1, 1, 1, '#93c5fd');
    }
    if (frame % 8 < 2) {
      px(ctx, x + 9, y + 3, 1, 1, '#ffffff');
    }
    if (frame % 10 < 3) {
      px(ctx, x + 5, y + 2, 1, 1, '#60a5fa');
    }
  }

  private drawDamageBoost(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number): void {
    const pulse = Math.sin(frame * 0.2) * 0.15;

    // Red/orange glow pulsing
    ctx.globalAlpha = 0.2 + pulse;
    px(ctx, x + 3, y + 2, 10, 10, '#f59e0b');
    ctx.globalAlpha = 0.1 + pulse * 0.5;
    px(ctx, x + 2, y + 1, 12, 12, '#ef4444');
    ctx.globalAlpha = 1;

    // Sword icon -- more detailed with crossguard
    // Blade
    px(ctx, x + 7, y + 2, 2, 6, '#d1d5db');
    px(ctx, x + 6, y + 2, 1, 3, '#e5e7eb'); // blade edge left
    px(ctx, x + 9, y + 2, 1, 3, '#9ca3af'); // blade shadow right
    // Blade tip
    px(ctx, x + 7, y + 1, 2, 1, '#e5e7eb');
    px(ctx, x + 8, y + 1, 1, 1, '#ffffff'); // tip highlight

    // Cross guard -- more detailed
    px(ctx, x + 5, y + 8, 6, 1, '#fbbf24');
    px(ctx, x + 5, y + 8, 1, 1, '#f59e0b'); // guard shadow
    px(ctx, x + 10, y + 8, 1, 1, '#f59e0b');

    // Handle
    px(ctx, x + 7, y + 9, 2, 2, '#78350f');
    px(ctx, x + 7, y + 9, 1, 1, '#92400e'); // handle highlight

    // Pommel
    px(ctx, x + 7, y + 11, 2, 1, '#fbbf24');

    // Motion lines suggesting power
    ctx.globalAlpha = 0.3 + pulse;
    px(ctx, x + 3, y + 4, 1, 1, '#f97316');
    px(ctx, x + 2, y + 6, 1, 1, '#f97316');
    px(ctx, x + 12, y + 3, 1, 1, '#f97316');
    px(ctx, x + 13, y + 5, 1, 1, '#f97316');
    ctx.globalAlpha = 1;
  }

  private drawSpeedBoost(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number): void {
    const streak = frame % 4;

    // Boot shape -- brighter, more vibrant
    px(ctx, x + 4, y + 4, 5, 6, '#06b6d4');
    px(ctx, x + 4, y + 10, 7, 2, '#0891b2');
    px(ctx, x + 3, y + 8, 1, 2, '#06b6d4');
    // Boot highlight
    px(ctx, x + 5, y + 5, 2, 1, '#22d3ee');
    // Boot sole
    px(ctx, x + 4, y + 11, 7, 1, '#0e7490');

    // Wing detail on boot -- more elaborate
    px(ctx, x + 9, y + 3, 3, 2, lighten('#06b6d4', 0.3));
    px(ctx, x + 10, y + 2, 3, 2, lighten('#06b6d4', 0.4));
    px(ctx, x + 11, y + 1, 2, 2, lighten('#06b6d4', 0.5));
    // Wing feather lines
    px(ctx, x + 10, y + 4, 2, 1, lighten('#06b6d4', 0.2));
    px(ctx, x + 12, y + 2, 1, 1, '#ffffff');

    // Speed line trails behind -- more prominent
    ctx.globalAlpha = 0.5;
    px(ctx, x + 1 - streak, y + 6, 3, 1, '#06b6d4');
    px(ctx, x + 0 - streak, y + 8, 2, 1, '#0891b2');
    ctx.globalAlpha = 0.3;
    px(ctx, x - 1 - streak, y + 5, 2, 1, '#22d3ee');
    px(ctx, x - 1 - streak, y + 9, 2, 1, '#0891b2');
    ctx.globalAlpha = 1;

    // Highlight
    px(ctx, x + 5, y + 5, 1, 2, lighten('#06b6d4', 0.5));
  }

  private drawGoldLoot(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number): void {
    // Stack of 4 coins with varying angles
    // Bottom coin
    px(ctx, x + 2, y + 10, 8, 3, '#a16207');
    px(ctx, x + 3, y + 10, 6, 1, '#ca8a04');

    // Second coin (offset)
    px(ctx, x + 3, y + 8, 8, 3, '#ca8a04');
    px(ctx, x + 4, y + 8, 6, 1, '#eab308');

    // Third coin (offset other way)
    px(ctx, x + 4, y + 5, 8, 3, '#eab308');
    px(ctx, x + 5, y + 5, 6, 1, '#fbbf24');

    // Top coin
    px(ctx, x + 5, y + 3, 6, 3, '#fbbf24');
    px(ctx, x + 6, y + 3, 4, 1, lighten('#fbbf24', 0.3));

    // $ symbol / coin face on front coin
    px(ctx, x + 7, y + 4, 2, 1, '#ca8a04');
    px(ctx, x + 7, y + 5, 1, 1, '#a16207'); // $ bottom

    // Metallic sheen -- bright yellow highlight that moves
    const sheenPos = (frame % 10);
    if (sheenPos < 3) {
      px(ctx, x + 6 + sheenPos, y + 3, 1, 1, '#fef3c7');
    } else if (sheenPos < 6) {
      px(ctx, x + 5 + (sheenPos - 3), y + 6, 1, 1, '#fef3c7');
    }

    // Golden sparkle particles -- overlapping sine waves for frequent sparkles
    const sparkle1 = Math.max(0, Math.sin(frame * 0.4 + 0));
    const sparkle2 = Math.max(0, Math.sin(frame * 0.4 + 2.1));
    const sparkle3 = Math.max(0, Math.sin(frame * 0.4 + 4.2));
    const sparkle4 = Math.max(0, Math.sin(frame * 0.4 + 5.5));
    if (sparkle1 > 0.3) {
      ctx.globalAlpha = sparkle1;
      px(ctx, x + 10, y + 3, 1, 1, '#ffffff');
      px(ctx, x + 11, y + 2, 1, 1, '#fef3c7');
      ctx.globalAlpha = 1;
    }
    if (sparkle2 > 0.3) {
      ctx.globalAlpha = sparkle2;
      px(ctx, x + 4, y + 5, 1, 1, '#ffffff');
      px(ctx, x + 3, y + 4, 1, 1, '#fef3c7');
      ctx.globalAlpha = 1;
    }
    if (sparkle3 > 0.3) {
      ctx.globalAlpha = sparkle3;
      px(ctx, x + 8, y + 8, 1, 1, '#ffffff');
      ctx.globalAlpha = 1;
    }
    if (sparkle4 > 0.3) {
      ctx.globalAlpha = sparkle4;
      px(ctx, x + 12, y + 6, 1, 1, '#ffffff');
      px(ctx, x + 2, y + 9, 1, 1, '#fef3c7');
      ctx.globalAlpha = 1;
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

  /** Simple outline helper -- draws black border rect */
  private drawOutline(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, _color: string): void {
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }
}

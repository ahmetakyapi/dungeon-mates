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
  ): void {
    // Elliptical shadow beneath
    this.drawEntityShadow(ctx, x, y, 16, 16);

    // Idle breathing: subtle Y oscillation every ~30 frames
    const breatheY = Math.sin(frame * 0.21) * 0.6;

    if (flashWhite) {
      this.drawPlayerWhiteFlash(ctx, x, y + breatheY, playerClass, facing, attacking, frame);
      return;
    }

    switch (playerClass) {
      case 'warrior':
        this.drawWarrior(ctx, x, y + breatheY, facing, attacking, frame);
        break;
      case 'mage':
        this.drawMage(ctx, x, y + breatheY, facing, attacking, frame);
        break;
      case 'archer':
        this.drawArcher(ctx, x, y + breatheY, facing, attacking, frame);
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
    const legOff = frame % 2;
    const isHoriz = facing === 'left' || facing === 'right';
    const facingRight = facing === 'right';
    const facingUp = facing === 'up';
    // Arm swing offset for walking
    const armSwing = Math.sin(frame * 1.2) * 1;

    // Steel boots
    px(ctx, x + 4, y + 13 + legOff, 3, 2, '#6b7280');
    px(ctx, x + 9, y + 13 - legOff, 3, 2, '#6b7280');
    // Boot highlight
    px(ctx, x + 4, y + 13 + legOff, 1, 1, '#9ca3af');
    px(ctx, x + 9, y + 13 - legOff, 1, 1, '#9ca3af');

    // Legs (dark armor) -- more pronounced movement
    px(ctx, x + 5, y + 11, 2, 3 + legOff, '#991b1b');
    px(ctx, x + 9, y + 11, 2, 3 - legOff, '#991b1b');

    // Red cape flowing behind -- direction-aware
    if (!facingUp) {
      const capeDir = facingRight ? -1 : 1;
      const capeWave = Math.sin(frame * 0.8) * 1.5;
      px(ctx, x + 5, y + 7 + walkY, 6, 5, '#b91c1c');
      px(ctx, x + 4 + capeWave * capeDir * 0.3, y + 10 + walkY, 8, 2, '#991b1b');
      // Cape edge detail
      px(ctx, x + 5, y + 11 + walkY, 1, 1, '#7f1d1d');
      px(ctx, x + 10, y + 11 + walkY, 1, 1, '#7f1d1d');
      // Cape flow highlights
      px(ctx, x + 6, y + 8 + walkY, 2, 1, '#dc2626');
    }

    // Body -- full plate armor
    px(ctx, x + 4, y + 6 + walkY, 8, 5, '#9ca3af'); // steel body
    px(ctx, x + 5, y + 6 + walkY, 6, 1, '#d1d5db'); // chest highlight
    px(ctx, x + 6, y + 8 + walkY, 4, 1, '#fbbf24'); // gold belt
    // Armor plate lines
    px(ctx, x + 7, y + 7 + walkY, 1, 3, '#6b7280'); // center line

    // Shield on arm -- with light reflection
    const glintOffset = (frame % 8);
    if (isHoriz) {
      const sx2 = facingRight ? x + 1 : x + 12;
      px(ctx, sx2, y + 5 + walkY, 3, 6, '#6b7280');
      px(ctx, sx2, y + 6 + walkY, 3, 4, '#3b82f6');
      px(ctx, sx2 + 1, y + 7 + walkY, 1, 2, '#fbbf24'); // shield emblem
      // Reflect light -- moving highlight
      const reflectY = y + 6 + walkY + (glintOffset % 4);
      if (reflectY < y + 10 + walkY) {
        px(ctx, sx2 + 2, reflectY, 1, 1, '#93c5fd');
      }
    } else {
      px(ctx, x + 2, y + 6 + walkY, 3, 5, '#6b7280');
      px(ctx, x + 2, y + 7 + walkY, 3, 3, '#3b82f6');
      // Shield reflection
      px(ctx, x + 4, y + 7 + walkY + (glintOffset % 3), 1, 1, '#93c5fd');
    }

    // Right arm (sword arm) with swing
    if (!isHoriz) {
      px(ctx, x + 12, y + 6 + walkY + armSwing * 0.3, 2, 5, '#9ca3af');
    } else {
      const swordArmX = facingRight ? x + 12 : x + 2;
      px(ctx, swordArmX, y + 6 + walkY, 2, 5, '#9ca3af');
    }

    // Sword with glint pixel
    const swordGlintPos = (frame % 12);
    if (attacking) {
      // Attack: horizontal slash with motion blur trail
      const slashDir = facingRight ? 1 : -1;
      if (isHoriz) {
        const bladeX = facingRight ? x + 14 : x - 6;
        px(ctx, bladeX, y + 4 + walkY, 6, 1, '#d1d5db');
        px(ctx, bladeX, y + 5 + walkY, 6, 1, '#e5e7eb');
        // Sword glint on blade
        px(ctx, bladeX + (swordGlintPos % 5), y + 4 + walkY, 1, 1, '#ffffff');
        // Motion trail
        ctx.globalAlpha = 0.4;
        px(ctx, bladeX - slashDir * 2, y + 3 + walkY, 8, 3, '#ffffff');
        ctx.globalAlpha = 0.2;
        px(ctx, bladeX - slashDir * 4, y + 2 + walkY, 10, 5, '#ffffff');
        ctx.globalAlpha = 1;
      } else {
        const bladeY = facingUp ? y - 4 : y + 14;
        px(ctx, x + 10, bladeY, 1, 6, '#d1d5db');
        px(ctx, x + 11, bladeY, 1, 6, '#e5e7eb');
        px(ctx, x + 10, bladeY + (swordGlintPos % 5), 1, 1, '#ffffff');
        ctx.globalAlpha = 0.3;
        px(ctx, x + 8, bladeY, 5, 6, '#ffffff');
        ctx.globalAlpha = 1;
      }
      px(ctx, x + 11, y + 10 + walkY, 2, 2, '#78350f');
    } else {
      // Idle: sword held down with moving glint
      px(ctx, x + 12, y + 4 + walkY, 1, 7, '#9ca3af');
      px(ctx, x + 13, y + 4 + walkY, 1, 7, '#d1d5db');
      // Glint moves along blade
      const glintY = y + 4 + walkY + (swordGlintPos % 6);
      if (glintY < y + 10 + walkY) {
        px(ctx, x + 13, glintY, 1, 1, '#ffffff');
      }
      px(ctx, x + 12, y + 10 + walkY, 2, 2, '#78350f');
    }

    // Head
    px(ctx, x + 5, y + 2, 6, 4, '#fcd5b4');
    // Horned helmet with visor
    px(ctx, x + 4, y + 1, 8, 2, '#6b7280');
    px(ctx, x + 5, y + 0, 6, 1, '#9ca3af');
    px(ctx, x + 3, y - 1, 2, 3, '#fbbf24');
    px(ctx, x + 11, y - 1, 2, 3, '#fbbf24');
    // Helmet visor slit
    if (facing !== 'up') {
      px(ctx, x + 5, y + 2, 6, 1, '#4b5563'); // visor
      px(ctx, x + 6, y + 2, 4, 1, '#374151'); // visor slit
    }

    // Face details
    if (facing !== 'up') {
      px(ctx, x + 6, y + 3, 1, 1, '#1a1a2e');
      px(ctx, x + 9, y + 3, 1, 1, '#1a1a2e');
    }

    // Shoulder pads (gold trim)
    px(ctx, x + 3, y + 5 + walkY, 2, 2, '#fbbf24');
    px(ctx, x + 11, y + 5 + walkY, 2, 2, '#fbbf24');
    // Shoulder highlights
    px(ctx, x + 3, y + 5 + walkY, 1, 1, '#fde68a');
    px(ctx, x + 11, y + 5 + walkY, 1, 1, '#fde68a');

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
    // Robe billow when moving
    const robeBillow = Math.sin(frame * 0.6) * 1;

    // Flowing purple robe (long, covers legs partially)
    px(ctx, x + 3, y + 7 + walkY, 10, 6, '#7c3aed');
    px(ctx, x + 2 + robeBillow * 0.3, y + 10 + walkY, 12, 3, '#6d28d9'); // robe bottom (flowing/billowing)
    px(ctx, x + 4, y + 13, 3, 2, '#5b21b6');
    px(ctx, x + 9, y + 13, 3, 2, '#5b21b6');
    // Robe edge detail
    px(ctx, x + 2, y + 12 + walkY, 1, 1, '#5b21b6');
    px(ctx, x + 13, y + 12 + walkY, 1, 1, '#5b21b6');

    // Runic patterns on robe -- animated shift
    const runeShift = (frame % 12) < 6 ? 0 : 1;
    px(ctx, x + 5 + runeShift, y + 9 + walkY, 1, 1, '#c4b5fd');
    px(ctx, x + 7 - runeShift, y + 10 + walkY, 1, 1, '#ddd6fe');
    px(ctx, x + 10 + runeShift, y + 9 + walkY, 1, 1, '#c4b5fd');
    // Additional rune symbols
    px(ctx, x + 4, y + 11 + walkY, 1, 1, '#a78bfa');
    px(ctx, x + 8 + runeShift, y + 11 + walkY, 1, 1, '#a78bfa');
    px(ctx, x + 11, y + 10 + walkY, 1, 1, '#c4b5fd');

    // Body
    px(ctx, x + 4, y + 5 + walkY, 8, 3, '#8b5cf6');
    px(ctx, x + 5, y + 5 + walkY, 6, 1, '#a78bfa'); // collar highlight

    // Arms (robe sleeves)
    px(ctx, x + 2, y + 6 + walkY, 2, 4, '#7c3aed');
    px(ctx, x + 12, y + 6 + walkY, 2, 4, '#7c3aed');

    // Staff with glowing/pulsing crystal
    const staffX = facingRight ? x + 13 : x + 1;
    const crystalPulse = 0.5 + Math.sin(frame * 0.4) * 0.5; // 0..1 pulsing
    const crystalGlow = crystalPulse > 0.7;
    if (attacking) {
      // Staff raised, magic circle beneath
      px(ctx, staffX, y - 2, 1, 14, '#78350f');
      px(ctx, staffX - 1, y - 3, 3, 3, '#a78bfa');
      // Glowing crystal core -- pulsing
      px(ctx, staffX, y - 2, 1, 1, crystalGlow ? '#ffffff' : '#ddd6fe');
      px(ctx, staffX - 1, y - 4, 3, 1, withAlpha('#c4b5fd', crystalPulse * 0.6)); // crystal glow aura
      // Magic circle beneath player
      ctx.globalAlpha = 0.4 + Math.sin(frame * 0.5) * 0.2;
      px(ctx, x + 1, y + 13, 14, 1, '#a78bfa');
      px(ctx, x + 2, y + 14, 12, 1, '#8b5cf6');
      px(ctx, x + 0, y + 12, 1, 2, '#a78bfa');
      px(ctx, x + 15, y + 12, 1, 2, '#a78bfa');
      ctx.globalAlpha = 1;
    } else {
      px(ctx, staffX, y + 1, 1, 12, '#78350f');
      px(ctx, staffX - 1, y + 0, 3, 2, '#a78bfa');
      px(ctx, staffX, y + 0, 1, 1, crystalGlow ? '#ffffff' : '#ddd6fe');
      // Crystal glow aura
      if (crystalGlow) {
        ctx.globalAlpha = 0.3;
        px(ctx, staffX - 1, y - 1, 3, 1, '#c4b5fd');
        ctx.globalAlpha = 1;
      }
    }

    // Magic particle trail when moving (walkY !== 0 implies motion)
    if (walkY !== 0) {
      ctx.globalAlpha = 0.4;
      const trailX = x + 6 + Math.sin(frame * 0.7) * 3;
      const trailY = y + 14 + Math.cos(frame * 0.5) * 1;
      px(ctx, trailX, trailY, 1, 1, '#c4b5fd');
      px(ctx, trailX + 2, trailY - 1, 1, 1, '#a78bfa');
      ctx.globalAlpha = 1;
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
      const eyeGlow = crystalGlow ? '#ddd6fe' : '#c4b5fd';
      px(ctx, x + 6, y + 3, 1, 1, eyeGlow);
      px(ctx, x + 9, y + 3, 1, 1, eyeGlow);
    }

    // Pointed wizard hat with gem
    px(ctx, x + 4, y + 1, 8, 2, '#7c3aed');
    px(ctx, x + 5, y + 0, 6, 1, '#6d28d9');
    px(ctx, x + 6, y - 1, 4, 1, '#5b21b6');
    px(ctx, x + 7, y - 2, 2, 1, '#4c1d95');
    // Gem on hat -- pulsing
    px(ctx, x + 7, y + 0, 2, 1, crystalGlow ? '#fde68a' : '#fbbf24');

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
    const facingRight = facing === 'right';
    const facingUp = facing === 'up';
    // Arm swing
    const armSwing = Math.sin(frame * 1.0) * 1;

    // Legs -- more pronounced movement
    px(ctx, x + 5, y + 11, 2, 3 + legOff, '#374151');
    px(ctx, x + 9, y + 11, 2, 3 - legOff, '#374151');

    // Boots with detail
    px(ctx, x + 4, y + 13 + legOff, 3, 2, '#78350f');
    px(ctx, x + 9, y + 13 - legOff, 3, 2, '#78350f');
    // Boot lace/stitching
    px(ctx, x + 5, y + 13 + legOff, 1, 1, '#92400e');
    px(ctx, x + 10, y + 13 - legOff, 1, 1, '#92400e');

    // Leather armor body with stitch detail
    px(ctx, x + 4, y + 6 + walkY, 8, 5, '#854d0e');
    px(ctx, x + 5, y + 6 + walkY, 6, 1, '#a16207'); // chest highlight
    px(ctx, x + 6, y + 8 + walkY, 4, 1, '#713f12'); // belt
    // Stitch lines on leather
    px(ctx, x + 5, y + 7 + walkY, 1, 1, '#713f12');
    px(ctx, x + 7, y + 7 + walkY, 1, 1, '#713f12');
    px(ctx, x + 9, y + 7 + walkY, 1, 1, '#713f12');
    px(ctx, x + 10, y + 9 + walkY, 1, 1, '#713f12');

    // Green hooded cloak
    px(ctx, x + 3, y + 4 + walkY, 10, 4, '#15803d');
    px(ctx, x + 3, y + 8 + walkY, 2, 4, '#166534');
    px(ctx, x + 11, y + 8 + walkY, 2, 4, '#166534');

    // Arms with bracers and swing
    px(ctx, x + 2, y + 6 + walkY + armSwing * 0.3, 2, 4, '#854d0e');
    px(ctx, x + 2, y + 9 + walkY, 2, 1, '#713f12');
    px(ctx, x + 12, y + 6 + walkY - armSwing * 0.3, 2, 4, '#854d0e');
    px(ctx, x + 12, y + 9 + walkY, 2, 1, '#713f12');

    // Quiver on back (arrows visible -- staggered tips)
    if (!facingUp) {
      px(ctx, x + 10, y + 3 + walkY, 3, 6, '#78350f');
      // Arrow tips with varying heights
      px(ctx, x + 10, y + 2 + walkY, 1, 1, '#9ca3af');
      px(ctx, x + 11, y + 1 + walkY, 1, 1, '#9ca3af');
      px(ctx, x + 12, y + 2 + walkY, 1, 1, '#9ca3af');
      // Quiver strap
      px(ctx, x + 10, y + 4 + walkY, 1, 1, '#5c3d1e');
    }

    // Bow in hand
    const bowX = facingRight ? x + 14 : x + 0;
    if (attacking) {
      // Drawn bow with tension
      px(ctx, bowX, y + 3 + walkY, 1, 8, '#78350f');
      px(ctx, bowX + (facingRight ? -1 : 1), y + 3 + walkY, 1, 1, '#78350f');
      px(ctx, bowX + (facingRight ? -1 : 1), y + 10 + walkY, 1, 1, '#78350f');
      // Bowstring pulled back -- taut
      const stringX = facingRight ? bowX - 2 : bowX + 2;
      px(ctx, stringX, y + 4 + walkY, 1, 6, '#fbbf24');
      // String tension highlight
      px(ctx, stringX, y + 7 + walkY, 1, 1, '#fef3c7');
      // Arrow being released
      const arrowDir = facingRight ? 1 : -1;
      px(ctx, bowX + arrowDir * 2, y + 7 + walkY, 4, 1, '#d1d5db');
      px(ctx, bowX + arrowDir * 5, y + 6 + walkY, 1, 3, '#9ca3af');
    } else {
      // Bow at rest with visible string tension
      px(ctx, bowX, y + 4 + walkY, 1, 7, '#78350f');
      px(ctx, bowX + (facingRight ? 1 : -1), y + 4 + walkY, 1, 1, '#78350f');
      px(ctx, bowX + (facingRight ? 1 : -1), y + 10 + walkY, 1, 1, '#78350f');
      // String at rest (slight curve)
      px(ctx, bowX + (facingRight ? 1 : -1), y + 5 + walkY, 1, 5, '#fbbf24');
      // String highlight at center
      px(ctx, bowX + (facingRight ? 1 : -1), y + 7 + walkY, 1, 1, '#fef3c7');
    }

    // Head
    px(ctx, x + 5, y + 2, 6, 4, '#fcd5b4');
    // Hood -- directional shadow
    px(ctx, x + 4, y + 1, 8, 2, '#15803d');
    px(ctx, x + 5, y + 0, 6, 1, '#166534');
    // Hood shadow on face depends on facing direction
    if (facing !== 'up') {
      if (facingRight) {
        px(ctx, x + 5, y + 2, 2, 1, '#d4a574'); // shadow on left side
      } else if (facing === 'left') {
        px(ctx, x + 9, y + 2, 2, 1, '#d4a574'); // shadow on right side
      } else {
        // facing down -- shadow on top of face
        px(ctx, x + 5, y + 2, 6, 1, '#d4a574');
      }
    }

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

    // Elliptical shadow beneath
    this.drawEntityShadow(ctx, x, y, renderSize, renderSize);

    if (flashWhite) {
      // White silhouette with red tint
      px(ctx, x + 2, y + 2, renderSize - 4, renderSize - 4, '#ff8888');
      ctx.globalAlpha = 0.3;
      px(ctx, x + 2, y + 2, renderSize - 4, renderSize - 4, '#ff0000');
      ctx.globalAlpha = 1;
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

    // Jaw
    const jawOpen = (frame % 8) < 2 ? 1 : 0;
    px(ctx, x + 5, y + 5 + jawOpen, 6, 2, '#d1d5db');
    px(ctx, x + 6, y + 5, 4, 1, '#1a1a2e');
    // Teeth -- more detailed
    px(ctx, x + 6, y + 5 + jawOpen, 1, 1, '#ffffff');
    px(ctx, x + 7, y + 5 + jawOpen, 1, 1, '#e5e7eb');
    px(ctx, x + 8, y + 5 + jawOpen, 1, 1, '#ffffff');
    px(ctx, x + 9, y + 5 + jawOpen, 1, 1, '#e5e7eb');

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

    // Arms (bone segments with articulated joints)
    // Left arm
    px(ctx, x + 3, y + 7 + wobble, 2, 1, '#d1d5db');
    px(ctx, x + 3, y + 7 + wobble, 1, 1, '#f0f0f0'); // joint highlight
    px(ctx, x + 2, y + 8 + wobble, 1, 3, '#c4c4c4');
    px(ctx, x + 2, y + 10 + wobble, 1, 1, '#f0f0f0'); // wrist joint
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

    // Attack animation: sword swing arc with trail
    if (attacking) {
      ctx.globalAlpha = 0.3;
      px(ctx, x + 14, y + 3 - wobble, 2, 1, '#ffffff');
      px(ctx, x + 15, y + 4 - wobble, 1, 2, '#ffffff');
      ctx.globalAlpha = 0.15;
      px(ctx, x + 15, y + 2 - wobble, 2, 2, '#ffffff');
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
      px(ctx, bx + 3, y + 14 + (dripPhase % 3), 1, 1, '#4ade80');
    }
    if (dripPhase > 4 && dripPhase < 12) {
      px(ctx, bx + w - 4, y + 14 + ((dripPhase + 2) % 3), 1, 1, '#4ade80');
    }
    ctx.globalAlpha = 1;

    // Small trail behind
    ctx.globalAlpha = 0.15;
    px(ctx, bx + 1, y + 14, w - 2, 1, '#22c55e');
    px(ctx, bx + 2, y + 15, w - 4, 1, '#16a34a');
    ctx.globalAlpha = 1;

    // Outer body -- more organic irregular edges
    px(ctx, bx, by + 1, w, h - 1, '#4ade80');
    px(ctx, bx + 1, by, w - 2, 1, '#4ade80'); // rounded top
    px(ctx, bx + 1, by + h, w - 2, 1, '#4ade80'); // rounded bottom
    // Irregular organic bumps
    px(ctx, bx - 1, by + 3, 1, 3, '#4ade80'); // left bump
    px(ctx, bx + w, by + 4, 1, 2, '#4ade80'); // right bump
    px(ctx, bx + 2, by - 1, 2, 1, '#4ade80'); // top bump

    // Different color core vs outer layer -- darker center
    px(ctx, bx + 3, by + 3, w - 6, h - 5, '#22c55e'); // darker core

    // Inner lighter area (translucent highlight) -- lighter edges
    px(ctx, bx + 1, by + 1, 3, 2, '#86efac'); // top-left highlight
    px(ctx, bx + w - 3, by + 2, 2, 2, '#86efac'); // top-right highlight

    // Internal "bubbles" that move (2-3 dots that shift per frame)
    const bubble1X = bx + 3 + Math.sin(frame * 0.3) * 2;
    const bubble1Y = by + Math.floor(h * 0.4) + Math.cos(frame * 0.25) * 1.5;
    const bubble2X = bx + w - 5 + Math.cos(frame * 0.35) * 1.5;
    const bubble2Y = by + Math.floor(h * 0.6) + Math.sin(frame * 0.2) * 1;
    const bubble3X = bx + Math.floor(w * 0.5) + Math.sin(frame * 0.4) * 1;
    const bubble3Y = by + Math.floor(h * 0.3) + Math.cos(frame * 0.3) * 1;

    px(ctx, bubble1X, bubble1Y, 2, 2, '#d1fae5');
    px(ctx, bubble2X, bubble2Y, 1, 1, '#bbf7d0');
    px(ctx, bubble3X, bubble3Y, 1, 1, '#d1fae5');

    // Bubble highlights on surface
    px(ctx, bx + 2, by + 1, 2, 2, '#bbf7d0');
    px(ctx, bx + w - 4, by + 2, 1, 1, '#bbf7d0');

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
    px(ctx, bx + Math.floor(w * 0.35), eyeY + 3, Math.floor(w * 0.3), 1, '#166534');

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

  private drawGoblin(ctx: CanvasRenderingContext2D, x: number, y: number, facing: Direction, frame: number): void {
    const wobble = WALK_OFFSETS[frame % 4];
    const attacking = false; // TODO: pass attacking state

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
    const pulse = Math.sin(frame * 0.3) * 2;
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
    // Wing membrane lines/veins
    px(ctx, bx + 2, by + 8 + pulse, 1, 14, '#450a0a');
    px(ctx, bx + 4, by + 7 + pulse, 1, 16, '#450a0a');
    px(ctx, bx + 6, by + 9 + pulse, 1, 12, '#450a0a');
    // Wing tears/holes
    px(ctx, bx + 3, by + 12 + pulse, 1, 2, '#000000');
    px(ctx, bx + 5, by + 16 + pulse, 1, 1, '#000000');

    // Right wing
    px(ctx, bx + 32, by + 6 - pulse, 7, 18, '#7f1d1d');
    px(ctx, bx + 38, by + 8 - pulse, 2, 14, '#991b1b');
    px(ctx, bx + 37, by + 8 - pulse, 1, 14, '#450a0a');
    px(ctx, bx + 35, by + 7 - pulse, 1, 16, '#450a0a');
    px(ctx, bx + 33, by + 9 - pulse, 1, 12, '#450a0a');
    // Wing tears
    px(ctx, bx + 36, by + 13 - pulse, 1, 2, '#000000');
    px(ctx, bx + 34, by + 18 - pulse, 1, 1, '#000000');

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
    dirX = 0,
    dirY = 0,
  ): void {
    switch (type) {
      case 'arrow': this.drawArrowProjectile(ctx, x, y, vx, vy); break;
      case 'fireball': this.drawFireballProjectile(ctx, x, y, frame); break;
      case 'sword_slash': this.drawSwordSlashProjectile(ctx, x, y, frame, dirX, dirY); break;
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

    // Liquid slosh animation -- tilts left/right
    const slosh = Math.sin(frame * 0.2);
    if (slosh > 0.3) {
      px(ctx, x + 5, y + 7, 2, 1, lighten('#ef4444', 0.3));
      px(ctx, x + 5, y + 8, 1, 1, lighten('#ef4444', 0.2));
    } else if (slosh < -0.3) {
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

    // Golden sparkle particles -- more prominent
    const sparklePhase = frame % 16;
    if (sparklePhase < 3) {
      px(ctx, x + 10, y + 3, 1, 1, '#ffffff');
      px(ctx, x + 11, y + 2, 1, 1, '#fef3c7');
    } else if (sparklePhase > 5 && sparklePhase < 8) {
      px(ctx, x + 4, y + 5, 1, 1, '#ffffff');
      px(ctx, x + 3, y + 4, 1, 1, '#fef3c7');
    } else if (sparklePhase > 9 && sparklePhase < 12) {
      px(ctx, x + 8, y + 8, 1, 1, '#ffffff');
    } else if (sparklePhase > 12 && sparklePhase < 15) {
      px(ctx, x + 12, y + 6, 1, 1, '#ffffff');
      px(ctx, x + 2, y + 9, 1, 1, '#fef3c7');
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

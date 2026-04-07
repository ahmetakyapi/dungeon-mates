// ==========================================
// Dungeon Mates — Sprite Utility Functions
// Color helpers, pixel drawing, caching, and shared constants
// ==========================================

import type { Direction, PlayerClass, MonsterType, TileType, LootType } from '../../../../shared/types';
import { CLASS_STATS, MONSTER_STATS, LOOT_TABLE, TILE_SIZE } from '../../../../shared/types';

// Re-export types for convenience
export type { Direction, PlayerClass, MonsterType, TileType, LootType };
export { CLASS_STATS, MONSTER_STATS, LOOT_TABLE, TILE_SIZE };

// --- Color utilities ---
export const hexToRgb = (hex: string): [number, number, number] => {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
};

export const darken = (hex: string, amount: number): string => {
  const [r, g, b] = hexToRgb(hex);
  const f = 1 - amount;
  return `rgb(${Math.floor(r * f)},${Math.floor(g * f)},${Math.floor(b * f)})`;
};

export const lighten = (hex: string, amount: number): string => {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.min(255, Math.floor(r + (255 - r) * amount))},${Math.min(255, Math.floor(g + (255 - g) * amount))},${Math.min(255, Math.floor(b + (255 - b) * amount))})`;
};

export const withAlpha = (hex: string, alpha: number): string => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
};

// Pixel helper: draws a filled rect at pixel-art scale
export const px = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void => {
  ctx.fillStyle = color;
  ctx.fillRect(Math.floor(x), Math.floor(y), w, h);
};

// Simple position-based hash for tile variation
export const tileHash = (tx: number, ty: number): number => {
  let h = tx * 374761393 + ty * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return (h ^ (h >> 16)) & 0x7fffffff;
};

// --- Off-screen sprite cache with LRU eviction ---
export type CacheKey = string;
export const SPRITE_CACHE_MAX = 256;
export const spriteCache = new Map<CacheKey, HTMLCanvasElement>();

// Tile cache moved to SpriteRenderer instance to avoid HMR stale cache issues

export const getCachedSprite = (
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
export const WALK_OFFSETS = [0, -1, 0, 1] as const;

// --- 4-frame smooth leg alternation offsets ---
export const LEG_CYCLE = [0, 1, 2, 1] as const; // smooth stride: neutral, forward, full, back

// --- Entity shadow ---

/** Draw an elliptical semi-transparent shadow beneath an entity */
export const drawEntityShadow = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
): void => {
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
};

// --- Outline utilities ---

/** Draw a 1px black outline around a sprite region (no-op for performance) */
export const drawSpriteOutline = (ctx: CanvasRenderingContext2D, _x: number, _y: number): void => {
  // For performance, we skip full outline computation.
  // Instead we rely on the 1px black shadow beneath + dark border pixels
  // already placed in each sprite. Full outline would require reading
  // pixel data which is too expensive per frame.
};

/** Simple outline helper -- draws black border rect */
export const drawOutline = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, _color: string): void => {
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
};

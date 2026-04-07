// ===== ENVIRONMENT (TILE) SPRITES =====
// Extracted from SpriteRenderer.ts — standalone tile drawing functions

import type { TileType } from '../../../../shared/types';
import { TILE_SIZE } from '../../../../shared/types';
import { px, darken, lighten, tileHash } from './SpriteUtils';

/** Module-level tile cache (singleton — tiles are fully deterministic per hash) */
const tileCache = new Map<string, HTMLCanvasElement>();

/** Clear the tile cache (e.g. on HMR or floor change) */
export function clearTileCache(): void {
  tileCache.clear();
}

/** Draw a tile (cached) */
export function drawTile(
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
  let cached = tileCache.get(cacheKey);
  if (!cached) {
    cached = document.createElement('canvas');
    cached.width = TILE_SIZE;
    cached.height = TILE_SIZE;
    const sprCtx = cached.getContext('2d');
    if (sprCtx) {
      switch (type) {
        case 'floor': drawFloorTile(sprCtx, 0, 0, hash); break;
        case 'wall': drawWallTile(sprCtx, 0, 0, hash); break;
        case 'door': drawDoorTile(sprCtx, 0, 0, roomCleared); break;
        case 'stairs': drawStairsTile(sprCtx, 0, 0); break;
        case 'chest': drawChestTile(sprCtx, 0, 0, roomCleared); break;
        case 'void': px(sprCtx, 0, 0, TILE_SIZE, TILE_SIZE, '#000000'); break;
      }
    }
    tileCache.set(cacheKey, cached);
  }
  ctx.drawImage(cached, Math.floor(x), Math.floor(y));
}

export function drawFloorTile(ctx: CanvasRenderingContext2D, x: number, y: number, hash: number): void {
  const variation = hash % 5;

  // Base stone floor — brighter gray-blue
  px(ctx, x, y, TILE_SIZE, TILE_SIZE, '#2e2e48');

  // Grid lines (mortar)
  ctx.fillStyle = '#383850';
  ctx.fillRect(x + TILE_SIZE - 1, y, 1, TILE_SIZE);
  ctx.fillRect(x, y + TILE_SIZE - 1, TILE_SIZE, 1);

  // Stone tile variation (5 types)
  if (variation === 0) {
    // Clean stone
    px(ctx, x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2, '#303050');
  } else if (variation === 1) {
    // Cracked stone
    px(ctx, x + 3, y + 5, 1, 4, '#242438');
    px(ctx, x + 4, y + 8, 1, 3, '#242438');
    px(ctx, x + 5, y + 10, 1, 2, '#242438');
    px(ctx, x + 2, y + 6, 1, 1, '#1e1e30');
    px(ctx, x + 4, y + 9, 1, 1, '#1e1e30');
    px(ctx, x + 6, y + 11, 1, 1, '#242438');
    px(ctx, x + 9, y + 3, 1, 3, '#242438');
    px(ctx, x + 10, y + 5, 1, 2, '#1e1e30');
  } else if (variation === 2) {
    // Moss with mushroom
    px(ctx, x + 10, y + 3, 2, 1, '#2a4e2a');
    px(ctx, x + 11, y + 4, 1, 1, '#2a4e2a');
    px(ctx, x + 4, y + 11, 2, 1, '#2a4e2a');
    px(ctx, x + 3, y + 12, 1, 1, '#1e6838');
    px(ctx, x + 12, y + 5, 1, 1, '#a85010');
    px(ctx, x + 11, y + 4, 2, 1, '#b86e10');
    if ((hash >> 4) % 3 === 0) {
      px(ctx, x + 5, y + 12, 1, 1, '#884812');
      px(ctx, x + 4, y + 11, 2, 1, '#b86e10');
    }
  } else if (variation === 3) {
    // Blood stain
    ctx.globalAlpha = 0.5;
    px(ctx, x + 5, y + 6, 4, 3, '#5a1414');
    px(ctx, x + 6, y + 5, 2, 1, '#4a0e0e');
    px(ctx, x + 4, y + 8, 2, 1, '#4a0e0e');
    ctx.globalAlpha = 0.3;
    px(ctx, x + 8, y + 7, 2, 2, '#5a1414');
    px(ctx, x + 3, y + 5, 1, 1, '#4a0e0e');
    px(ctx, x + 10, y + 8, 1, 1, '#4a0e0e');
    ctx.globalAlpha = 1;
  } else {
    // Water puddle
    px(ctx, x + 4, y + 5, 7, 5, '#283848');
    px(ctx, x + 5, y + 4, 5, 1, '#283848');
    px(ctx, x + 5, y + 10, 5, 1, '#283848');
    const shimmerOffset = (hash >> 6) % 4;
    ctx.globalAlpha = 0.2;
    px(ctx, x + 5 + shimmerOffset, y + 6, 2, 1, '#70b0f0');
    px(ctx, x + 7 - shimmerOffset, y + 8, 2, 1, '#70b0f0');
    ctx.globalAlpha = 0.1;
    px(ctx, x + 6, y + 7, 3, 1, '#a0c8ff');
    ctx.globalAlpha = 1;
  }

  // Occasional stone detail
  if ((hash >> 8) % 5 === 0) {
    px(ctx, x + 7, y + 7, 2, 2, '#323250');
  }
}

export function drawWallTile(ctx: CanvasRenderingContext2D, x: number, y: number, hash: number): void {
  // Base wall — brighter purple
  px(ctx, x, y, TILE_SIZE, TILE_SIZE, '#3d2880');

  // Top slightly lighter
  px(ctx, x, y, TILE_SIZE, 3, '#4d3890');

  // Brick mortar lines
  const mortarColor = '#2a1858';
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
    px(ctx, x + 1, y + 1, 3, 3, '#422a88');
  } else if (brickVar1 === 1) {
    px(ctx, x + 5, y + 1, 6, 3, '#362075');
  }
  if (brickVar2 === 0) {
    px(ctx, x + 1, y + 5, 7, 4, '#38207a');
  } else if (brickVar2 === 2) {
    px(ctx, x + 9, y + 5, 6, 4, '#442c8a');
  }
  if (((hash >> 7) % 2) === 0) {
    px(ctx, x + 5, y + 10, 6, 4, '#38207a');
  }

  // Brick highlights
  px(ctx, x + 1, y + 1, 2, 1, '#4a3090');
  px(ctx, x + 6, y + 6, 2, 1, '#4a3090');
  px(ctx, x + 1, y + 11, 2, 1, '#4a3090');
  px(ctx, x + 9, y + 1, 2, 1, '#4a3090');
  px(ctx, x + 13, y + 11, 2, 1, '#4a3090');

  // Border edges
  ctx.fillStyle = '#2a1858';
  ctx.fillRect(x, y, TILE_SIZE, 1);
  ctx.fillRect(x, y, 1, TILE_SIZE);
  ctx.fillStyle = '#4d3890';
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
    drawWallTorch(ctx, x + 6, y + 3, hash);
  }
}

/** Draw a small torch on wall */
export function drawWallTorch(ctx: CanvasRenderingContext2D, x: number, y: number, hash: number): void {
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

export function drawDoorTile(ctx: CanvasRenderingContext2D, x: number, y: number, roomCleared: boolean): void {
  // Floor beneath
  px(ctx, x, y, TILE_SIZE, TILE_SIZE, '#2e2e48');

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

    // Passage visible -- darker
    px(ctx, x + 4, y + 2, TILE_SIZE - 6, TILE_SIZE - 3, '#1e1e38');

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

export function drawStairsTile(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  // Dark background (stairs descend into darkness)
  px(ctx, x, y, TILE_SIZE, TILE_SIZE, '#1a1a30');

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

export function drawChestTile(ctx: CanvasRenderingContext2D, x: number, y: number, opened: boolean): void {
  // Floor beneath
  px(ctx, x, y, TILE_SIZE, TILE_SIZE, '#2e2e48');

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

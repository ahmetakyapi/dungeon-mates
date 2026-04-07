// ===== EFFECT SPRITES (PROJECTILES & LOOT) =====
// Extracted from SpriteRenderer.ts — standalone drawing functions

import type { LootType } from '../../../../shared/types';
import { LOOT_TABLE } from '../../../../shared/types';
import { px, lighten } from './SpriteUtils';

// ===== PROJECTILE SPRITES =====

/** Draw a projectile */
export function drawProjectile(
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
    case 'arrow': drawArrowProjectile(ctx, x, y, vx, vy); break;
    case 'fireball': drawFireballProjectile(ctx, x, y, frame); break;
    case 'sword_slash': drawSwordSlashProjectile(ctx, x, y, frame, dirX, dirY); break;
  }
}

export function drawArrowProjectile(ctx: CanvasRenderingContext2D, x: number, y: number, vx: number, vy: number): void {
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

export function drawFireballProjectile(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number): void {
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

export function drawSwordSlashProjectile(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number, dirX: number, dirY: number): void {
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

/** Draw an entity shadow (elliptical) */
function drawEntityShadow(
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

/** Draw a loot item */
export function drawLoot(
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
  drawEntityShadow(ctx, x, y, 16, 16);

  // Glow underneath
  ctx.globalAlpha = 0.2 + Math.sin(frame * 0.1) * 0.1;
  px(ctx, x + 3, y + 12, 10, 2, color);
  ctx.globalAlpha = 1;

  switch (type) {
    case 'health_potion': drawHealthPotion(ctx, x, ly, frame); break;
    case 'mana_potion': drawManaPotion(ctx, x, ly, frame); break;
    case 'damage_boost': drawDamageBoost(ctx, x, ly, frame); break;
    case 'speed_boost': drawSpeedBoost(ctx, x, ly, frame); break;
    case 'gold': drawGoldLoot(ctx, x, ly, frame); break;
  }
}

export function drawHealthPotion(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number): void {
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

export function drawManaPotion(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number): void {
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

export function drawDamageBoost(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number): void {
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

export function drawSpeedBoost(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number): void {
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

export function drawGoldLoot(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number): void {
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

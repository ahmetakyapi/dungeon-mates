// ==========================================
// Dungeon Mates — Player Sprite Drawing
// Standalone functions for warrior, mage, and archer sprites
// ==========================================

import type { Direction, PlayerClass } from './SpriteUtils';
import {
  px,
  withAlpha,
  getCachedSprite,
  drawEntityShadow,
  drawSpriteOutline,
  drawOutline,
  WALK_OFFSETS,
  LEG_CYCLE,
} from './SpriteUtils';

// ===== PLAYER SPRITES =====

/** Draw a player character (16x16 pixel art) -- detailed per class */
export function drawPlayer(
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
  drawEntityShadow(ctx, x, y, 16, 16);

  // Idle breathing: subtle Y oscillation every ~30 frames
  const breatheY = Math.sin(frame * 0.21) * 0.6;

  if (flashWhite) {
    drawPlayerWhiteFlash(ctx, x, y + breatheY, playerClass, facing, attacking, frame);
    return;
  }

  // Cache player sprite per animation state — avoids 50+ px() calls per frame
  const walkFrame = frame % 4;
  const atkFrame = attacking ? 1 : 0;
  const cacheKey = `player_${playerClass}_${facing}_${atkFrame}_${walkFrame}`;
  const cached = getCachedSprite(cacheKey, 16, 16, (sprCtx) => {
    switch (playerClass) {
      case 'warrior':
        drawWarrior(sprCtx, 0, 0, facing, attacking, frame);
        break;
      case 'mage':
        drawMage(sprCtx, 0, 0, facing, attacking, frame);
        break;
      case 'archer':
        drawArcher(sprCtx, 0, 0, facing, attacking, frame);
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

export function drawPlayerWhiteFlash(
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
  drawOutline(ctx, x, y, 16, 16, '#ffffff');
}

export function drawWarrior(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  facing: Direction,
  attacking: boolean,
  frame: number,
): void {
  const walkY = WALK_OFFSETS[frame % 4];
  const legPhase = LEG_CYCLE[frame % 4];
  const legLeft = legPhase;
  const legRight = LEG_CYCLE[(frame + 2) % 4]; // offset by 2 for alternation
  const isHoriz = facing === 'left' || facing === 'right';
  const facingRight = facing === 'right';
  const facingUp = facing === 'up';
  // Arm swing offset for walking
  const armSwing = Math.sin(frame * 1.2) * 1;

  // Steel boots -- 4-frame smooth stride
  px(ctx, x + 4, y + 13 + legLeft, 3, 2, '#6b7280');
  px(ctx, x + 9, y + 13 + legRight, 3, 2, '#6b7280');
  // Boot highlight
  px(ctx, x + 4, y + 13 + legLeft, 1, 1, '#9ca3af');
  px(ctx, x + 9, y + 13 + legRight, 1, 1, '#9ca3af');

  // Legs (dark armor) -- smooth 4-frame movement
  px(ctx, x + 5, y + 11, 2, 3 + legLeft, '#991b1b');
  px(ctx, x + 9, y + 11, 2, 3 + legRight, '#991b1b');

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

  // Shield on arm -- with light reflection and emblem
  const glintOffset = (frame % 8);
  if (isHoriz) {
    const sx2 = facingRight ? x + 0 : x + 12;
    px(ctx, sx2, y + 5 + walkY, 4, 7, '#6b7280');
    px(ctx, sx2, y + 6 + walkY, 4, 5, '#3b82f6');
    // Shield emblem (cross/lion shape)
    px(ctx, sx2 + 1, y + 7 + walkY, 2, 1, '#fbbf24'); // horizontal cross bar
    px(ctx, sx2 + 1, y + 6 + walkY, 1, 3, '#fbbf24'); // vertical cross bar
    // Shield rim
    px(ctx, sx2, y + 5 + walkY, 4, 1, '#4b5563');
    px(ctx, sx2, y + 11 + walkY, 4, 1, '#4b5563');
    // Reflect light -- moving highlight
    const reflectY = y + 6 + walkY + (glintOffset % 4);
    if (reflectY < y + 10 + walkY) {
      px(ctx, sx2 + 3, reflectY, 1, 1, '#93c5fd');
    }
  } else {
    px(ctx, x + 2, y + 5 + walkY, 3, 6, '#6b7280');
    px(ctx, x + 2, y + 6 + walkY, 3, 4, '#3b82f6');
    // Shield emblem (cross)
    px(ctx, x + 3, y + 7 + walkY, 1, 2, '#fbbf24');
    px(ctx, x + 2, y + 8 + walkY, 3, 1, '#fbbf24');
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

  // Larger, more imposing sword with blood channel detail
  const swordGlintPos = (frame % 12);
  if (attacking) {
    // Attack: horizontal slash with motion blur trail + weapon trail afterimages
    const slashDir = facingRight ? 1 : -1;
    if (isHoriz) {
      const bladeX = facingRight ? x + 14 : x - 7;
      px(ctx, bladeX, y + 3 + walkY, 7, 1, '#d1d5db');
      px(ctx, bladeX, y + 4 + walkY, 7, 1, '#e5e7eb');
      px(ctx, bladeX, y + 5 + walkY, 7, 1, '#b0b0b0');
      // Blood channel (fuller groove on blade)
      px(ctx, bladeX + 1, y + 4 + walkY, 4, 1, '#9ca3af');
      // Sword glint on blade
      px(ctx, bladeX + (swordGlintPos % 6), y + 3 + walkY, 1, 1, '#ffffff');
      // Motion trail -- more visible
      ctx.globalAlpha = 0.5;
      px(ctx, bladeX - slashDir * 2, y + 2 + walkY, 9, 4, '#ffffff');
      ctx.globalAlpha = 0.3;
      px(ctx, bladeX - slashDir * 4, y + 1 + walkY, 11, 6, '#e5e7eb');
      ctx.globalAlpha = 0.15;
      px(ctx, bladeX - slashDir * 6, y + 0 + walkY, 13, 7, '#d1d5db');
      ctx.globalAlpha = 1;
    } else {
      const bladeY = facingUp ? y - 5 : y + 14;
      px(ctx, x + 9, bladeY, 1, 7, '#d1d5db');
      px(ctx, x + 10, bladeY, 1, 7, '#e5e7eb');
      px(ctx, x + 11, bladeY, 1, 7, '#b0b0b0');
      // Blood channel
      px(ctx, x + 10, bladeY + 1, 1, 4, '#9ca3af');
      px(ctx, x + 10, bladeY + (swordGlintPos % 6), 1, 1, '#ffffff');
      ctx.globalAlpha = 0.4;
      px(ctx, x + 7, bladeY, 7, 7, '#ffffff');
      ctx.globalAlpha = 0.2;
      px(ctx, x + 6, bladeY - 1, 9, 9, '#e5e7eb');
      ctx.globalAlpha = 1;
    }
    px(ctx, x + 11, y + 10 + walkY, 2, 2, '#78350f');
  } else {
    // Idle: larger sword held down with moving glint and blood channel
    px(ctx, x + 12, y + 3 + walkY, 1, 8, '#9ca3af');
    px(ctx, x + 13, y + 3 + walkY, 1, 8, '#d1d5db');
    px(ctx, x + 14, y + 4 + walkY, 1, 6, '#b0b0b0');
    // Blood channel detail on blade
    px(ctx, x + 13, y + 4 + walkY, 1, 4, '#9ca3af');
    // Blade tip (pointed)
    px(ctx, x + 13, y + 2 + walkY, 1, 1, '#e5e7eb');
    // Glint moves along blade
    const glintY = y + 3 + walkY + (swordGlintPos % 7);
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

  // Red feather plume on top of helmet crest
  const plumeWave = Math.sin(frame * 0.6) * 0.5;
  px(ctx, x + 6, y - 2, 4, 1, '#dc2626');
  px(ctx, x + 7, y - 3, 2, 1, '#ef4444');
  px(ctx, x + 7, y - 4 + plumeWave, 2, 1, '#f87171');
  px(ctx, x + 8, y - 5 + plumeWave, 1, 1, '#fca5a5');
  // Plume side feather wisps
  px(ctx, x + 5, y - 2, 1, 1, '#b91c1c');
  px(ctx, x + 10, y - 2, 1, 1, '#b91c1c');

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

  // Idle animation: subtle cape flutter
  if (!attacking) {
    const capeFlutter = Math.sin(frame * 0.4) * 0.8;
    px(ctx, x + 4, y + 12 + walkY + capeFlutter, 1, 1, '#991b1b');
    px(ctx, x + 11, y + 12 + walkY - capeFlutter, 1, 1, '#991b1b');
  }

  drawSpriteOutline(ctx, x, y);
}

export function drawMage(
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

  // Constellation pattern (tiny dots of light on robe)
  const constFrame = frame % 20;
  ctx.globalAlpha = 0.4 + Math.sin(frame * 0.15) * 0.2;
  px(ctx, x + 4, y + 8 + walkY, 1, 1, '#fef3c7');
  px(ctx, x + 6, y + 12 + walkY, 1, 1, '#fef3c7');
  px(ctx, x + 9, y + 9 + walkY, 1, 1, '#fef3c7');
  px(ctx, x + 12, y + 11 + walkY, 1, 1, '#fef3c7');
  // Constellation lines (faint connections)
  ctx.globalAlpha = 0.15;
  if (constFrame < 10) {
    px(ctx, x + 5, y + 9 + walkY, 1, 1, '#ddd6fe');
    px(ctx, x + 7, y + 10 + walkY, 1, 1, '#ddd6fe');
    px(ctx, x + 10, y + 10 + walkY, 1, 1, '#ddd6fe');
  }
  ctx.globalAlpha = 1;

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

  // Pointed wizard hat with gem -- taller and more pointed with a fold
  px(ctx, x + 4, y + 1, 8, 2, '#7c3aed');
  px(ctx, x + 5, y + 0, 6, 1, '#6d28d9');
  px(ctx, x + 6, y - 1, 4, 1, '#5b21b6');
  px(ctx, x + 7, y - 2, 2, 1, '#4c1d95');
  px(ctx, x + 7, y - 3, 2, 1, '#3b0764'); // taller point
  px(ctx, x + 8, y - 4, 1, 1, '#4c1d95'); // tip
  // Hat fold (tip bends slightly)
  px(ctx, x + 9, y - 4, 1, 1, '#5b21b6');
  px(ctx, x + 10, y - 3, 1, 1, '#6d28d9');
  // Hat band
  px(ctx, x + 4, y + 0, 8, 1, '#451a03');
  // Gem on hat -- pulsing
  px(ctx, x + 7, y + 0, 2, 1, crystalGlow ? '#fde68a' : '#fbbf24');

  // Staff crystal sparkle orbit when idle
  if (!attacking) {
    const sparkleAngle1 = frame * 0.25;
    const sparkleAngle2 = frame * 0.25 + Math.PI;
    const orbitR = 2.5;
    const scx = (facingRight ? x + 14 : x + 2);
    const scy = y + 0;
    ctx.globalAlpha = 0.5 + Math.sin(frame * 0.4) * 0.3;
    px(ctx, scx + Math.cos(sparkleAngle1) * orbitR, scy + Math.sin(sparkleAngle1) * orbitR, 1, 1, '#fef3c7');
    ctx.globalAlpha = 0.3 + Math.sin(frame * 0.3) * 0.2;
    px(ctx, scx + Math.cos(sparkleAngle2) * orbitR, scy + Math.sin(sparkleAngle2) * orbitR, 1, 1, '#c4b5fd');
    ctx.globalAlpha = 1;
  }

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

  drawSpriteOutline(ctx, x, y);
}

export function drawArcher(
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
  // Arm swing
  const armSwing = Math.sin(frame * 1.0) * 1;

  // Legs -- smooth 4-frame stride
  px(ctx, x + 5, y + 11, 2, 3 + legPhaseA, '#374151');
  px(ctx, x + 9, y + 11, 2, 3 + legPhaseB, '#374151');

  // Boots with detail
  px(ctx, x + 4, y + 13 + legPhaseA, 3, 2, '#78350f');
  px(ctx, x + 9, y + 13 + legPhaseB, 3, 2, '#78350f');
  // Boot lace/stitching
  px(ctx, x + 5, y + 13 + legPhaseA, 1, 1, '#92400e');
  px(ctx, x + 10, y + 13 + legPhaseB, 1, 1, '#92400e');

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

  // Quiver on back (arrows visible -- staggered tips, depleting animation when attacking)
  if (!facingUp) {
    px(ctx, x + 10, y + 3 + walkY, 3, 6, '#78350f');
    // Arrow tips with varying heights (cosmetically fewer when attacking)
    if (attacking) {
      // Show fewer arrows in quiver
      px(ctx, x + 11, y + 1 + walkY, 1, 1, '#9ca3af');
    } else {
      px(ctx, x + 10, y + 2 + walkY, 1, 1, '#9ca3af');
      px(ctx, x + 11, y + 1 + walkY, 1, 1, '#9ca3af');
      px(ctx, x + 12, y + 2 + walkY, 1, 1, '#9ca3af');
      // Arrow fletching detail
      px(ctx, x + 10, y + 3 + walkY, 1, 1, '#fbbf24');
      px(ctx, x + 12, y + 3 + walkY, 1, 1, '#fbbf24');
    }
    // Quiver strap
    px(ctx, x + 10, y + 4 + walkY, 1, 1, '#5c3d1e');
    // Quiver leather detail
    px(ctx, x + 10, y + 8 + walkY, 3, 1, '#5c3d1e');
  }

  // Bow in hand with rune markings
  const bowX = facingRight ? x + 14 : x + 0;
  if (attacking) {
    // Drawn bow with tension
    px(ctx, bowX, y + 3 + walkY, 1, 8, '#78350f');
    px(ctx, bowX + (facingRight ? -1 : 1), y + 3 + walkY, 1, 1, '#78350f');
    px(ctx, bowX + (facingRight ? -1 : 1), y + 10 + walkY, 1, 1, '#78350f');
    // Rune markings glow when attacking
    ctx.globalAlpha = 0.7;
    px(ctx, bowX, y + 4 + walkY, 1, 1, '#4ade80');
    px(ctx, bowX, y + 6 + walkY, 1, 1, '#4ade80');
    px(ctx, bowX, y + 8 + walkY, 1, 1, '#4ade80');
    ctx.globalAlpha = 0.3;
    px(ctx, bowX - (facingRight ? 0 : -1), y + 3 + walkY, 2, 8, '#4ade80');
    ctx.globalAlpha = 1;
    // Bowstring pulled back -- taut
    const stringX = facingRight ? bowX - 2 : bowX + 2;
    px(ctx, stringX, y + 4 + walkY, 1, 6, '#fbbf24');
    // String tension highlight
    px(ctx, stringX, y + 7 + walkY, 1, 1, '#fef3c7');
    // Arrow being released
    const arrowDir = facingRight ? 1 : -1;
    px(ctx, bowX + arrowDir * 2, y + 7 + walkY, 4, 1, '#d1d5db');
    px(ctx, bowX + arrowDir * 5, y + 6 + walkY, 1, 3, '#9ca3af');
    // Weapon trail effect (semi-transparent afterimage)
    ctx.globalAlpha = 0.2;
    px(ctx, bowX + arrowDir * 1, y + 6 + walkY, 3, 3, '#ffffff');
    ctx.globalAlpha = 1;
  } else {
    // Bow at rest with visible string tension
    px(ctx, bowX, y + 4 + walkY, 1, 7, '#78350f');
    px(ctx, bowX + (facingRight ? 1 : -1), y + 4 + walkY, 1, 1, '#78350f');
    px(ctx, bowX + (facingRight ? 1 : -1), y + 10 + walkY, 1, 1, '#78350f');
    // Rune markings (subtle when idle)
    ctx.globalAlpha = 0.3;
    px(ctx, bowX, y + 5 + walkY, 1, 1, '#4ade80');
    px(ctx, bowX, y + 7 + walkY, 1, 1, '#4ade80');
    px(ctx, bowX, y + 9 + walkY, 1, 1, '#4ade80');
    ctx.globalAlpha = 1;
    // String at rest (slight curve)
    px(ctx, bowX + (facingRight ? 1 : -1), y + 5 + walkY, 1, 5, '#fbbf24');
    // String highlight at center
    px(ctx, bowX + (facingRight ? 1 : -1), y + 7 + walkY, 1, 1, '#fef3c7');
    // Idle animation: subtle bow check / fidget
    if ((frame % 24) < 4) {
      px(ctx, bowX, y + 3 + walkY, 1, 1, '#92400e');
    }
  }

  // Head
  px(ctx, x + 5, y + 2, 6, 4, '#fcd5b4');
  // Hood -- directional shadow with stitching and fur trim
  px(ctx, x + 4, y + 1, 8, 2, '#15803d');
  px(ctx, x + 5, y + 0, 6, 1, '#166534');
  // Hood stitching detail
  px(ctx, x + 6, y + 0, 1, 1, '#0f5132');
  px(ctx, x + 8, y + 0, 1, 1, '#0f5132');
  px(ctx, x + 10, y + 1, 1, 1, '#0f5132');
  // Fur trim around hood edge
  px(ctx, x + 4, y + 2, 1, 1, '#a8a29e');
  px(ctx, x + 11, y + 2, 1, 1, '#a8a29e');
  px(ctx, x + 5, y + 1, 1, 1, '#d6d3d1');
  px(ctx, x + 10, y + 1, 1, 1, '#d6d3d1');
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

  drawSpriteOutline(ctx, x, y);
}

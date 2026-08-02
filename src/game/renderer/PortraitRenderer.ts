/**
 * Character portraits.
 *
 * The class cards used to show the 16×16 dungeon sprite blown up to 190px. At
 * that scale a 16px character is four pixels of face and one pixel of eye —
 * there is nothing there to connect with, and upscaling only makes the absence
 * larger. These are drawn at 48×64 instead: roughly three times the linear
 * resolution and nine times the pixel budget, which is the difference between
 * "a shape wearing red" and a character with a face, a jaw, a pauldron and a
 * cape that moves.
 *
 * Style is anime-influenced pixel art rather than the dungeon's chunky sprite
 * work, because these are portraits and portraits are about the face: a large
 * head against the body (about 1:4), big eyes with a specular highlight and a
 * shadow line above them, cel-shaded blocks instead of dithering, and a cool
 * rim light down the right edge to lift the silhouette off the card.
 *
 * Everything is procedural, like the rest of the game's art — no sprite sheets,
 * and the palettes come from the same class colours the HUD uses.
 */

export const PORTRAIT_W = 48;
export const PORTRAIT_H = 64;

type Ramp = {
  /** darkest → lightest. Four tones is enough to read as cel shading. */
  shadow: string;
  base: string;
  light: string;
  hi: string;
};

type PortraitPalette = {
  cloth: Ramp;
  metal: Ramp;
  accent: string;
  accentGlow: string;
  skin: Ramp;
  hair: Ramp;
  eye: string;
  /** Light that rakes the right-hand edge; the one cool note in a warm figure. */
  rim: string;
};

const SKIN: Ramp = { shadow: '#a3654a', base: '#d99b74', light: '#f0bd94', hi: '#ffe0c2' };

const PALETTES: Record<string, PortraitPalette> = {
  warrior: {
    cloth: { shadow: '#5c0f14', base: '#c81e2a', light: '#f0454f', hi: '#ff8d92' },
    metal: { shadow: '#333b4a', base: '#6f7c92', light: '#b3c0d4', hi: '#f2f7ff' },
    accent: '#fbbf24',
    accentGlow: 'rgba(251,191,36,0.5)',
    skin: SKIN,
    hair: { shadow: '#3a2410', base: '#5c3a18', light: '#8a5a28', hi: '#b07c3c' },
    eye: '#7dd3fc',
    rim: '#93c5fd',
  },
  mage: {
    cloth: { shadow: '#2e1065', base: '#6d1fe0', light: '#a06bff', hi: '#ddd0ff' },
    metal: { shadow: '#4a3a20', base: '#8a6a30', light: '#c79a48', hi: '#f0cf80' },
    accent: '#22d3ee',
    accentGlow: 'rgba(34,211,238,0.55)',
    skin: SKIN,
    hair: { shadow: '#2a1f4a', base: '#4a3a7a', light: '#7a63b8', hi: '#b7a3e8' },
    eye: '#a5f3fc',
    rim: '#67e8f9',
  },
  archer: {
    cloth: { shadow: '#0d3d22', base: '#14783a', light: '#25c463', hi: '#7dfaa6' },
    metal: { shadow: '#3d2a16', base: '#6b4a24', light: '#9c6f38', hi: '#c99a54' },
    accent: '#a3e635',
    accentGlow: 'rgba(163,230,53,0.45)',
    skin: SKIN,
    hair: { shadow: '#2c1d0e', base: '#4a3218', light: '#75512a', hi: '#9c6f3c' },
    eye: '#bef264',
    rim: '#86efac',
  },
  healer: {
    cloth: { shadow: '#96701f', base: '#e8ce85', light: '#fbf0c4', hi: '#fffdf5' },
    metal: { shadow: '#8a6512', base: '#c9930f', light: '#f0b429', hi: '#fde68a' },
    accent: '#fde68a',
    accentGlow: 'rgba(253,230,138,0.6)',
    skin: SKIN,
    hair: { shadow: '#8a6a1a', base: '#c9a544', light: '#e8cf7a', hi: '#fff0b8' },
    eye: '#fef3c7',
    rim: '#fef08a',
  },
};

/** Integer-aligned rect. Every mark in a portrait goes through this. */
function px(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/** Mirror-safe horizontal pair, for symmetric features like eyes and boots. */
function pxPair(
  ctx: CanvasRenderingContext2D, cx: number, offset: number, y: number, w: number, h: number, color: string,
): void {
  px(ctx, cx - offset - w, y, w, h, color);
  px(ctx, cx + offset, y, w, h, color);
}

export type PortraitClass = 'warrior' | 'mage' | 'archer' | 'healer';

/**
 * Warrior and archer read male, mage and healer female.
 *
 * At 48px this is carried by three things and nothing else: hair that falls
 * past the shoulders, a narrower jaw, and a slimmer shoulder line. Faces this
 * small have no room for anything subtler, and piling on more cues would just
 * make them read as caricature.
 */
const FEMININE: ReadonlySet<PortraitClass> = new Set<PortraitClass>(['mage', 'healer']);

/**
 * Draw one portrait into a 48×64 context.
 *
 * `t` is seconds; it drives the breathing, the cloth sway and the weapon glint.
 * Everything derived from it is continuous, so the portrait never pops.
 */
export function drawPortrait(
  ctx: CanvasRenderingContext2D, cls: PortraitClass, t: number,
): void {
  const p = PALETTES[cls];
  ctx.clearRect(0, 0, PORTRAIT_W, PORTRAIT_H);

  const cx = PORTRAIT_W / 2;
  // Breathing lifts the whole upper body by a pixel; the legs stay planted.
  const breathe = Math.sin(t * 1.6) > 0.2 ? -1 : 0;
  const sway = Math.sin(t * 1.1);

  drawCastShadow(ctx, cx, p);
  drawBackHair(ctx, cls, cx, p, sway);
  drawCape(ctx, cls, cx, p, sway, t);
  drawLegs(ctx, cls, cx, p);
  drawTorso(ctx, cls, cx, p, breathe);
  drawArmsAndWeapon(ctx, cls, cx, p, breathe, t);
  drawHead(ctx, cls, cx, p, breathe, t);
  drawRimLight(ctx, cls, cx, p, breathe);
  drawFx(ctx, cls, cx, p, t);
}

// ── ground ────────────────────────────────────────────────────────────────

function drawCastShadow(ctx: CanvasRenderingContext2D, cx: number, _p: PortraitPalette): void {
  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.ellipse(cx, 60, 13, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.16;
  ctx.beginPath();
  ctx.ellipse(cx, 60, 18, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Hair falling behind the shoulders. Feminine classes only — this is the single
 * strongest read at this size, which is why it is drawn behind the cape where
 * it frames the whole figure rather than as a detail on the head.
 */
function drawBackHair(
  ctx: CanvasRenderingContext2D, cls: PortraitClass, cx: number, p: PortraitPalette, sway: number,
): void {
  if (!FEMININE.has(cls)) return;
  const drift = sway * 1.2;
  for (let i = 0; i < 24; i++) {
    const y = 12 + i;
    const k = i / 24;
    // Widest at the shoulder, tapering to a point at the tips.
    const spread = 9 + Math.sin(k * Math.PI) * 3 - k * 3;
    const shift = Math.round(k * drift);
    px(ctx, cx - spread + shift, y, 3, 1, p.hair.base);
    px(ctx, cx + spread + shift - 3, y, 3, 1, p.hair.shadow);
    // A lit strand catching the key light on the left fall.
    if (i % 3 === 0) px(ctx, cx - spread + shift, y, 1, 1, p.hair.light);
  }
}

// ── cape / robe skirt, behind everything ─────────────────────────────────

function drawCape(
  ctx: CanvasRenderingContext2D, cls: PortraitClass, cx: number, p: PortraitPalette,
  sway: number, t: number,
): void {
  const drift = Math.round(sway * 1.5);

  if (cls === 'warrior') {
    // A cape read from behind the shoulders, widening as it falls.
    for (let i = 0; i < 26; i++) {
      const y = 22 + i;
      const spread = 7 + i * 0.42;
      const shift = Math.round((i / 26) * drift);
      px(ctx, cx - spread + shift, y, spread * 2, 1, i > 20 ? p.cloth.shadow : p.cloth.base);
    }
    // Fold shading down the left third.
    for (let i = 4; i < 26; i++) {
      px(ctx, cx - 6 + Math.round((i / 26) * drift), 22 + i, 3, 1, p.cloth.shadow);
    }
    return;
  }

  if (cls === 'mage' || cls === 'healer') {
    // Robes flare to the floor. Wider than the warrior's cape and softer at the hem.
    const ramp = p.cloth;
    const rows = 28;
    for (let i = 0; i < rows; i++) {
      const y = 31 + i;
      if (y > 58) break;
      const k = i / rows;
      // Cubic flare: close to the body at the waist, opening near the hem.
      const spread = 5 + k * k * 13;
      const shift = Math.round(k * drift);
      px(ctx, cx - spread + shift, y, spread * 2, 1, ramp.base);
      px(ctx, cx - spread + shift, y, 2, 1, ramp.shadow);
      px(ctx, cx + spread + shift - 2, y, 2, 1, ramp.light);
    }
    // Three folds, each drifting outward with the flare so they follow the cloth
    // rather than sitting on top of it as straight stripes.
    for (let i = 5; i < rows; i++) {
      const y = 31 + i;
      if (y > 58) break;
      const k = i / rows;
      const spread = 5 + k * k * 13;
      const shift = Math.round(k * drift);
      px(ctx, cx - Math.round(spread * 0.5) + shift, y, 1, 1, ramp.shadow);
      px(ctx, cx + Math.round(spread * 0.45) + shift, y, 1, 1, ramp.shadow);
      if (i > 14) px(ctx, cx + shift, y, 1, 1, ramp.light);
    }
    // Hem: a darker lip so the robe ends on a line instead of fading out.
    const hemK = (rows - 1) / rows;
    const hemSpread = 5 + hemK * hemK * 13;
    px(ctx, cx - hemSpread, 58, hemSpread * 2, 1, ramp.shadow);
    return;
  }

  // Archer: a short travelling cloak and a scarf that actually moves.
  for (let i = 0; i < 16; i++) {
    const y = 24 + i;
    const spread = 6 + i * 0.3;
    const shift = Math.round((i / 16) * drift);
    px(ctx, cx - spread + shift, y, spread * 2, 1, p.cloth.shadow);
  }
  const scarfWave = Math.sin(t * 2.2);
  for (let i = 0; i < 12; i++) {
    const x = cx + 6 + i;
    const y = 26 + Math.round(Math.sin(t * 2.2 + i * 0.5) * 2) + Math.round(i * 0.35);
    px(ctx, x, y, 1, 2, i > 8 ? p.cloth.shadow : p.cloth.light);
  }
  void scarfWave;
}

// ── legs ─────────────────────────────────────────────────────────────────

function drawLegs(ctx: CanvasRenderingContext2D, cls: PortraitClass, cx: number, p: PortraitPalette): void {
  if (cls === 'mage' || cls === 'healer') {
    // Hidden by the robe; only the toes show.
    pxPair(ctx, cx, 1, 57, 4, 3, p.metal.shadow);
    return;
  }
  const trouser = cls === 'warrior' ? p.metal : p.cloth;
  // Thighs
  pxPair(ctx, cx, 1, 42, 5, 9, trouser.base);
  pxPair(ctx, cx, 1, 42, 2, 9, trouser.shadow);
  // Boots
  pxPair(ctx, cx, 1, 51, 6, 7, p.metal.shadow);
  pxPair(ctx, cx, 1, 51, 6, 2, p.metal.base);
  // Toe highlight so the feet do not merge with the shadow.
  px(ctx, cx + 1, 56, 6, 1, p.metal.light);
}

// ── torso ────────────────────────────────────────────────────────────────

function drawTorso(
  ctx: CanvasRenderingContext2D, cls: PortraitClass, cx: number, p: PortraitPalette, dy: number,
): void {
  const top = 24 + dy;

  if (cls === 'warrior') {
    // Breastplate: a tapered box with a raised centre ridge.
    px(ctx, cx - 9, top, 18, 19, p.metal.base);
    px(ctx, cx - 9, top, 4, 19, p.metal.shadow);
    px(ctx, cx + 5, top, 4, 19, p.metal.light);
    px(ctx, cx - 1, top + 2, 2, 15, p.metal.hi);
    // Tabard in the class colour, so the silhouette still reads as "red knight".
    px(ctx, cx - 4, top + 8, 8, 14, p.cloth.base);
    px(ctx, cx - 4, top + 8, 2, 14, p.cloth.shadow);
    // Belt
    px(ctx, cx - 9, top + 18, 18, 3, p.cloth.shadow);
    px(ctx, cx - 2, top + 18, 4, 3, p.accent);
    // Pauldrons — the shape that makes a knight read at a glance.
    pxPair(ctx, cx, 8, top - 2, 7, 8, p.metal.light);
    pxPair(ctx, cx, 8, top - 2, 7, 2, p.metal.hi);
    pxPair(ctx, cx, 8, top + 4, 7, 2, p.metal.shadow);
    return;
  }

  if (cls === 'archer') {
    // Leather jerkin, narrower than the knight — speed reads through silhouette.
    px(ctx, cx - 7, top, 14, 18, p.cloth.base);
    px(ctx, cx - 7, top, 3, 18, p.cloth.shadow);
    px(ctx, cx + 4, top, 3, 18, p.cloth.light);
    // Cross strap for the quiver.
    for (let i = 0; i < 14; i++) px(ctx, cx - 6 + i, top + 2 + i, 2, 1, p.metal.base);
    // Quiver over the right shoulder, arrows fanned.
    px(ctx, cx + 6, top - 3, 5, 12, p.metal.shadow);
    px(ctx, cx + 6, top - 3, 2, 12, p.metal.base);
    for (let i = 0; i < 3; i++) {
      px(ctx, cx + 7 + i, top - 8 + i, 1, 6, p.metal.light);
      px(ctx, cx + 7 + i, top - 9 + i, 1, 2, p.accent);
    }
    px(ctx, cx - 7, top + 16, 14, 3, p.metal.shadow);
    return;
  }

  // Mage and healer share a robed upper body; the trim tells them apart.
  px(ctx, cx - 8, top, 16, 20, p.cloth.base);
  px(ctx, cx - 8, top, 3, 20, p.cloth.shadow);
  px(ctx, cx + 5, top, 3, 20, p.cloth.light);
  // Collar — narrower on the feminine silhouettes.
  const narrow = FEMININE.has(cls);
  px(ctx, cx - (narrow ? 5 : 6), top - 1, narrow ? 10 : 12, 3, p.cloth.light);
  // Vertical trim down the front.
  px(ctx, cx - 1, top + 2, 2, 18, cls === 'healer' ? p.metal.light : p.accent);
  if (cls === 'healer') {
    // A cross at the chest; the one piece of iconography on the card.
    px(ctx, cx - 1, top + 5, 2, 7, p.metal.hi);
    px(ctx, cx - 3, top + 7, 6, 2, p.metal.hi);
  }
}

// ── arms and weapons ─────────────────────────────────────────────────────

function drawArmsAndWeapon(
  ctx: CanvasRenderingContext2D, cls: PortraitClass, cx: number, p: PortraitPalette,
  dy: number, t: number,
): void {
  const top = 24 + dy;

  if (cls === 'warrior') {
    // Left arm holds the shield forward, right arm the raised sword.
    px(ctx, cx - 13, top + 4, 5, 12, p.metal.base);
    px(ctx, cx + 8, top + 4, 5, 11, p.metal.base);

    // Tower shield, angled and lit from the left.
    px(ctx, cx - 20, top + 1, 10, 18, p.cloth.base);
    px(ctx, cx - 20, top + 1, 10, 2, p.metal.light);
    px(ctx, cx - 20, top + 17, 10, 2, p.metal.shadow);
    px(ctx, cx - 20, top + 1, 2, 18, p.metal.light);
    // Emblem
    px(ctx, cx - 16, top + 5, 2, 10, p.accent);
    px(ctx, cx - 18, top + 8, 6, 2, p.accent);

    // Sword raised over the right shoulder: a tapered blade with a fuller down
    // the centre, a real crossguard and a pommel.
    const bladeX = cx + 12;
    px(ctx, bladeX, top - 18, 5, 23, p.metal.base);
    px(ctx, bladeX, top - 18, 2, 23, p.metal.hi);      // lit edge
    px(ctx, bladeX + 4, top - 18, 1, 23, p.metal.shadow); // shaded edge
    px(ctx, bladeX + 2, top - 16, 1, 19, p.metal.light);  // fuller
    px(ctx, bladeX + 1, top - 21, 3, 3, p.metal.hi);      // point
    px(ctx, bladeX - 3, top + 5, 11, 2, p.accent);        // crossguard
    px(ctx, bladeX - 3, top + 5, 11, 1, p.metal.hi);
    px(ctx, bladeX + 1, top + 7, 3, 5, p.cloth.shadow);   // grip
    px(ctx, bladeX + 1, top + 12, 3, 2, p.accent);        // pommel
    const glint = (t * 26) % 44;
    if (glint < 23) {
      px(ctx, bladeX, top - 18 + glint, 5, 2, '#ffffff');
    }
    return;
  }

  if (cls === 'archer') {
    px(ctx, cx - 11, top + 4, 4, 11, p.cloth.light);
    px(ctx, cx + 7, top + 4, 4, 11, p.cloth.light);
    // A recurve bow held out to the left: two limbs meeting at a wrapped grip,
    // with the string running straight between the tips.
    const bowX = cx - 14;
    const bowMidY = top + 8;
    for (let i = -14; i <= 14; i++) {
      const k = Math.abs(i) / 14;
      // Belly of the bow bows away from the archer, tips curl back.
      const bend = Math.round(Math.cos((i / 14) * 1.35) * 5) - Math.round(k * k * 3);
      const y = bowMidY + i;
      px(ctx, bowX - bend, y, 2, 1, p.metal.base);
      px(ctx, bowX - bend, y, 1, 1, p.metal.light);
    }
    // Tip caps and the wrapped grip.
    px(ctx, bowX - 1, bowMidY - 15, 2, 2, p.metal.hi);
    px(ctx, bowX - 1, bowMidY + 14, 2, 2, p.metal.hi);
    px(ctx, bowX - 6, bowMidY - 3, 3, 7, p.cloth.shadow);
    px(ctx, bowX - 6, bowMidY - 3, 1, 7, p.cloth.light);
    // String, taut from tip to tip.
    px(ctx, bowX, bowMidY - 14, 1, 29, p.metal.hi);
    // A nocked arrow, so the bow is clearly in use.
    px(ctx, bowX + 1, bowMidY, 12, 1, p.metal.light);
    px(ctx, bowX + 1, bowMidY - 1, 3, 3, p.accent);
    return;
  }

  // Mage / healer: one arm across the body, the other holding a staff.
  px(ctx, cx - 11, top + 5, 4, 12, p.cloth.light);
  px(ctx, cx + 7, top + 5, 4, 12, p.cloth.light);

  const staffX = cx + 13;
  px(ctx, staffX, top - 14, 2, 34, p.metal.base);
  px(ctx, staffX, top - 14, 1, 34, p.metal.light);

  // The head of the staff: a floating, pulsing focus.
  const pulse = 1 + Math.sin(t * 3) * 0.25;
  const orbY = top - 18;
  ctx.save();
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = p.accentGlow;
  ctx.beginPath();
  ctx.arc(staffX + 1, orbY, 5 * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (cls === 'healer') {
    // A ring rather than a gem — reads as a halo at a glance.
    ctx.save();
    ctx.strokeStyle = p.metal.hi;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(staffX + 1, orbY, 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    px(ctx, staffX, orbY - 1, 2, 2, p.accent);
  } else {
    px(ctx, staffX - 1, orbY - 2, 4, 4, p.accent);
    px(ctx, staffX, orbY - 1, 2, 2, '#ffffff');
  }
}

// ── head ─────────────────────────────────────────────────────────────────

function drawHead(
  ctx: CanvasRenderingContext2D, cls: PortraitClass, cx: number, p: PortraitPalette,
  dy: number, t: number,
): void {
  const top = 6 + dy;

  // Neck
  px(ctx, cx - 3, top + 15, 6, 4, p.skin.shadow);

  // Face — a rounded box. Wide for the anime read, with the jaw tapering in.
  // The feminine faces taper harder and one row sooner, which is most of what
  // separates them at this size.
  const soft = FEMININE.has(cls);
  px(ctx, cx - 7, top + 2, 14, soft ? 12 : 13, p.skin.base);
  px(ctx, cx - (soft ? 5 : 6), top + (soft ? 14 : 15), soft ? 10 : 12, 2, p.skin.base);
  px(ctx, cx - (soft ? 3 : 5), top + (soft ? 16 : 17), soft ? 6 : 10, 1, p.skin.shadow);
  // Key light from the upper left, shade down the right cheek.
  px(ctx, cx - 7, top + 2, 5, 13, p.skin.light);
  px(ctx, cx + 4, top + 4, 3, 12, p.skin.shadow);

  if (cls === 'warrior') {
    // Open-faced helm: brow band, cheek guards, crest.
    px(ctx, cx - 8, top, 16, 6, p.metal.base);
    px(ctx, cx - 8, top, 16, 2, p.metal.light);
    px(ctx, cx - 8, top + 5, 16, 2, p.metal.shadow);
    pxPair(ctx, cx, 6, top + 6, 2, 9, p.metal.base);   // cheek guards
    px(ctx, cx - 1, top - 4, 2, 5, p.cloth.base);       // crest
    px(ctx, cx - 3, top - 5, 6, 2, p.cloth.light);
  } else if (cls === 'archer') {
    // Hood: a peak with the face in its opening.
    px(ctx, cx - 9, top - 1, 18, 7, p.cloth.base);
    px(ctx, cx - 9, top - 1, 18, 2, p.cloth.light);
    px(ctx, cx - 9, top + 5, 4, 12, p.cloth.shadow);
    px(ctx, cx + 5, top + 5, 4, 12, p.cloth.shadow);
    px(ctx, cx - 2, top - 4, 4, 4, p.cloth.base);
    // The hood casts a band of shade across the brow.
    px(ctx, cx - 7, top + 5, 14, 2, p.skin.shadow);
  } else if (cls === 'mage') {
    // Wide-brimmed pointed hat. The brim shadow across the eyes is the whole look.
    const tip = Math.round(Math.sin(t * 1.3) * 2);
    px(ctx, cx - 12, top + 1, 24, 3, p.cloth.base);
    px(ctx, cx - 12, top + 1, 24, 1, p.cloth.light);
    for (let i = 0; i < 12; i++) {
      const w = 12 - i;
      px(ctx, cx - w / 2 + Math.round((i / 12) * tip), top - i, w, 1, i > 8 ? p.cloth.shadow : p.cloth.base);
    }
    px(ctx, cx - 12, top + 4, 24, 2, p.cloth.shadow);
    px(ctx, cx - 7, top + 4, 14, 2, p.skin.shadow);
    px(ctx, cx - 3, top + 1, 6, 3, p.accent); // hat band
  } else {
    // Healer: a soft hood with gold trim, face left open and lit.
    px(ctx, cx - 9, top - 1, 18, 6, p.cloth.light);
    px(ctx, cx - 9, top - 1, 18, 2, p.cloth.hi);
    px(ctx, cx - 9, top + 4, 18, 1, p.metal.light);
    px(ctx, cx - 9, top + 5, 3, 12, p.cloth.base);
    px(ctx, cx + 6, top + 5, 3, 12, p.cloth.shadow);
  }

  // Hair showing under the headwear.
  if (soft) {
    // A parted fringe plus locks framing the cheeks.
    px(ctx, cx - 7, top + 4, 6, 3, p.hair.base);
    px(ctx, cx + 1, top + 4, 6, 3, p.hair.base);
    px(ctx, cx - 7, top + 4, 6, 1, p.hair.light);
    px(ctx, cx - 8, top + 5, 2, 11, p.hair.base);
    px(ctx, cx + 6, top + 5, 2, 11, p.hair.shadow);
  } else if (cls !== 'mage') {
    px(ctx, cx - 7, top + 6, 3, 5, p.hair.base);
    px(ctx, cx + 4, top + 6, 3, 5, p.hair.shadow);
  }

  // --- the face itself ---
  const eyeY = top + 8;
  // Lash line: a dark band above each eye. This one row does most of the
  // work in making a pixel face read as a face rather than as two dots.
  pxPair(ctx, cx, 1, eyeY - 1, 4, 1, p.hair.shadow);
  // Whites — taller on the feminine faces, which is the last of the three cues.
  pxPair(ctx, cx, 1, eyeY, 4, soft ? 5 : 4, '#ffffff');
  if (soft) pxPair(ctx, cx, 1, eyeY - 2, 4, 1, p.hair.shadow);
  // Iris
  pxPair(ctx, cx, 2, eyeY + 1, 2, 3, p.eye);
  // Pupil
  pxPair(ctx, cx, 2, eyeY + 2, 2, 2, '#1a1526');
  // Specular highlight, offset to the key-light side — the "alive" pixel.
  px(ctx, cx - 5, eyeY, 1, 1, '#ffffff');
  px(ctx, cx + 2, eyeY, 1, 1, '#ffffff');

  // Blink: a long hold open, one quick close.
  const blink = (t % 4.4) > 4.25;
  if (blink) {
    pxPair(ctx, cx, 1, eyeY, 4, 4, p.skin.base);
    pxPair(ctx, cx, 1, eyeY + 1, 4, 1, p.skin.shadow);
  }

  // Brow, nose and mouth: three marks, each one pixel tall.
  pxPair(ctx, cx, 1, eyeY - 3, 4, 1, p.hair.base);
  px(ctx, cx - 1, eyeY + 4, 1, 1, p.skin.shadow);
  px(ctx, cx - 2, eyeY + 7, 4, 1, p.skin.shadow);
}

// ── rim light ────────────────────────────────────────────────────────────

/**
 * A cool edge down the right of the figure.
 *
 * This is the single biggest thing separating these from the flat sprites: a
 * one-pixel light along the silhouette makes the character sit in front of the
 * card instead of on it.
 */
function drawRimLight(
  ctx: CanvasRenderingContext2D, cls: PortraitClass, cx: number, p: PortraitPalette, dy: number,
): void {
  ctx.save();
  ctx.globalAlpha = 0.55;
  const top = 24 + dy;
  const headTop = 6 + dy;

  px(ctx, cx + 6, headTop + 3, 1, 13, p.rim);        // cheek
  px(ctx, cx + 7, top + 1, 1, 18, p.rim);            // torso
  if (cls === 'warrior') px(ctx, cx + 14, top - 2, 1, 8, p.rim);
  if (cls === 'archer') px(ctx, cx + 10, top - 3, 1, 12, p.rim);
  if (cls === 'mage' || cls === 'healer') {
    for (let i = 0; i < 26; i++) {
      const y = 32 + i;
      if (y > 58) break;
      px(ctx, cx + 6 + i * 0.55, y, 1, 1, p.rim);
    }
  }
  ctx.restore();
}

// ── per-class atmosphere ─────────────────────────────────────────────────

function drawFx(
  ctx: CanvasRenderingContext2D, cls: PortraitClass, cx: number, p: PortraitPalette, t: number,
): void {
  ctx.save();
  if (cls === 'mage' || cls === 'healer') {
    // Motes rising around the staff. Deterministic per index so they drift
    // rather than flicker.
    for (let i = 0; i < 7; i++) {
      const phase = (t * 0.5 + i * 0.37) % 1;
      const x = cx + 8 + Math.sin(t * 1.4 + i * 2.1) * 6 + i;
      const y = 46 - phase * 34;
      ctx.globalAlpha = (1 - phase) * 0.75;
      px(ctx, x, y, 1, 1, p.accent);
    }
  } else if (cls === 'warrior') {
    // Sparks off the blade, only while the glint is passing.
    const glint = (t * 26) % 44;
    if (glint < 8) {
      ctx.globalAlpha = 0.7 - glint / 12;
      for (let i = 0; i < 4; i++) {
        px(ctx, cx + 12 + i * 2, 10 + glint + i, 1, 1, '#ffffff');
      }
    }
  } else {
    // Leaves on the wind for the ranger.
    for (let i = 0; i < 4; i++) {
      const phase = (t * 0.32 + i * 0.29) % 1;
      ctx.globalAlpha = Math.sin(phase * Math.PI) * 0.6;
      px(ctx, 6 + phase * 36 + i * 2, 20 + Math.sin(t + i * 2) * 8 + i * 6, 2, 1, p.accent);
    }
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

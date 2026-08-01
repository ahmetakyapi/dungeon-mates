// ==========================================
// Dungeon Mates — 3×5 Bitmap Font
//
// The renderer drew its in-world text with `ctx.font = 'bold 4px monospace'` and
// friends. At 4-6px the browser anti-aliases glyphs into grey mush, which on a
// 480×270 pixel-art canvas is the most visible possible violation of the art
// style — every other pixel in the game is placed deliberately.
//
// This is a hand-authored 3×5 bitmap face: each glyph is five rows of three bits,
// drawn as integer-aligned rects at an integer scale. Same approach as the rest
// of the game's art — nothing is sampled, nothing is filtered.
// ==========================================

const GLYPH_W = 3;
const GLYPH_H = 5;
/** One blank column between glyphs, at scale 1. */
const TRACKING = 1;

/** Rows are top→bottom; within a row bit 2 is the leftmost pixel. */
const GLYPHS: Record<string, readonly [number, number, number, number, number]> = {
  '0': [0b111, 0b101, 0b101, 0b101, 0b111],
  '1': [0b010, 0b110, 0b010, 0b010, 0b111],
  '2': [0b111, 0b001, 0b111, 0b100, 0b111],
  '3': [0b111, 0b001, 0b111, 0b001, 0b111],
  '4': [0b101, 0b101, 0b111, 0b001, 0b001],
  '5': [0b111, 0b100, 0b111, 0b001, 0b111],
  '6': [0b111, 0b100, 0b111, 0b101, 0b111],
  '7': [0b111, 0b001, 0b001, 0b001, 0b001],
  '8': [0b111, 0b101, 0b111, 0b101, 0b111],
  '9': [0b111, 0b101, 0b111, 0b001, 0b111],

  A: [0b111, 0b101, 0b111, 0b101, 0b101],
  B: [0b110, 0b101, 0b110, 0b101, 0b110],
  C: [0b111, 0b100, 0b100, 0b100, 0b111],
  D: [0b110, 0b101, 0b101, 0b101, 0b110],
  E: [0b111, 0b100, 0b111, 0b100, 0b111],
  F: [0b111, 0b100, 0b111, 0b100, 0b100],
  G: [0b111, 0b100, 0b101, 0b101, 0b111],
  H: [0b101, 0b101, 0b111, 0b101, 0b101],
  I: [0b111, 0b010, 0b010, 0b010, 0b111],
  J: [0b001, 0b001, 0b001, 0b101, 0b111],
  K: [0b101, 0b101, 0b110, 0b101, 0b101],
  L: [0b100, 0b100, 0b100, 0b100, 0b111],
  M: [0b101, 0b111, 0b111, 0b101, 0b101],
  N: [0b110, 0b101, 0b101, 0b101, 0b101],
  O: [0b111, 0b101, 0b101, 0b101, 0b111],
  P: [0b111, 0b101, 0b111, 0b100, 0b100],
  Q: [0b111, 0b101, 0b101, 0b111, 0b011],
  R: [0b111, 0b101, 0b111, 0b110, 0b101],
  S: [0b111, 0b100, 0b111, 0b001, 0b111],
  T: [0b111, 0b010, 0b010, 0b010, 0b010],
  U: [0b101, 0b101, 0b101, 0b101, 0b111],
  V: [0b101, 0b101, 0b101, 0b101, 0b010],
  W: [0b101, 0b101, 0b111, 0b111, 0b101],
  X: [0b101, 0b101, 0b010, 0b101, 0b101],
  Y: [0b101, 0b101, 0b010, 0b010, 0b010],
  Z: [0b111, 0b001, 0b010, 0b100, 0b111],

  '+': [0b000, 0b010, 0b111, 0b010, 0b000],
  '-': [0b000, 0b000, 0b111, 0b000, 0b000],
  '!': [0b010, 0b010, 0b010, 0b000, 0b010],
  '.': [0b000, 0b000, 0b000, 0b000, 0b010],
  ',': [0b000, 0b000, 0b000, 0b010, 0b100],
  ':': [0b000, 0b010, 0b000, 0b010, 0b000],
  '/': [0b001, 0b001, 0b010, 0b100, 0b100],
  '%': [0b101, 0b001, 0b010, 0b100, 0b101],
  '?': [0b111, 0b001, 0b011, 0b000, 0b010],
  '*': [0b101, 0b010, 0b111, 0b010, 0b101],
  '(': [0b001, 0b010, 0b010, 0b010, 0b001],
  ')': [0b100, 0b010, 0b010, 0b010, 0b100],
  ' ': [0b000, 0b000, 0b000, 0b000, 0b000],
};

/**
 * Turkish letters fold onto their ASCII bases. In-world text is short labels and
 * numbers; a diacritic is unreadable at 3px wide, so folding is more legible than
 * rendering a smudge.
 */
const FOLD: Record<string, string> = {
  Ç: 'C', Ğ: 'G', İ: 'I', I: 'I', Ö: 'O', Ş: 'S', Ü: 'U',
  ç: 'C', ğ: 'G', ı: 'I', ö: 'O', ş: 'S', ü: 'U',
};

function glyphFor(ch: string): readonly [number, number, number, number, number] | null {
  const up = FOLD[ch] ?? ch.toUpperCase();
  return GLYPHS[up] ?? null;
}

/** Rendered width in pixels, so callers can centre without measureText. */
export function measurePixelText(text: string, scale = 1): number {
  if (text.length === 0) return 0;
  return (text.length * (GLYPH_W + TRACKING) - TRACKING) * scale;
}

export const PIXEL_FONT_HEIGHT = GLYPH_H;

/**
 * Draw text as pixels. `x`/`y` are the top-left of the first glyph and are floored,
 * so output always lands on the pixel grid regardless of caller sub-pixel drift.
 */
export function drawPixelText(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  color: string,
  scale = 1,
): void {
  const ox = Math.floor(x);
  const oy = Math.floor(y);
  const step = (GLYPH_W + TRACKING) * scale;

  ctx.fillStyle = color;
  for (let i = 0; i < text.length; i++) {
    const rows = glyphFor(text[i]);
    if (!rows) continue;
    const gx = ox + i * step;
    for (let r = 0; r < GLYPH_H; r++) {
      const bits = rows[r];
      if (bits === 0) continue;
      // Merge horizontally adjacent lit pixels into one rect — at most 3 wide, but
      // it halves the fill calls for solid rows, which dominate this face.
      let runStart = -1;
      for (let c = 0; c <= GLYPH_W; c++) {
        const lit = c < GLYPH_W && (bits & (1 << (GLYPH_W - 1 - c))) !== 0;
        if (lit && runStart < 0) runStart = c;
        if (!lit && runStart >= 0) {
          ctx.fillRect(gx + runStart * scale, oy + r * scale, (c - runStart) * scale, scale);
          runStart = -1;
        }
      }
    }
  }
}

/** Draw text with a 1px dark outline so it stays readable over any tile. */
export function drawPixelTextOutlined(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  color: string,
  scale = 1,
  outline = '#0b0910',
): void {
  const ox = Math.floor(x);
  const oy = Math.floor(y);
  drawPixelText(ctx, ox - scale, oy, text, outline, scale);
  drawPixelText(ctx, ox + scale, oy, text, outline, scale);
  drawPixelText(ctx, ox, oy - scale, text, outline, scale);
  drawPixelText(ctx, ox, oy + scale, text, outline, scale);
  drawPixelText(ctx, ox, oy, text, color, scale);
}

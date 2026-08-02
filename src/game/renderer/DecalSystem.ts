/**
 * Persistent ground marks.
 *
 * Particles vanish in under a second, so a fight left no trace: you could clear
 * a room and the floor looked exactly as it did before anything happened. Decals
 * are the memory of the fight — blood where things died, scorch where fire
 * landed, frost where the mage froze something, craters where a boss slammed.
 *
 * They sit between the tile pass and the entity pass, so entities walk over
 * them, and they are pooled and camera-culled like everything else in the
 * render loop: fixed array, no allocation per spawn, oldest-first eviction when
 * the pool is full.
 */

export const DECAL_BLOOD = 0;
export const DECAL_SCORCH = 1;
export const DECAL_FROST = 2;
export const DECAL_CRATER = 3;
export type DecalKind =
  | typeof DECAL_BLOOD | typeof DECAL_SCORCH | typeof DECAL_FROST | typeof DECAL_CRATER;

/**
 * Enough to cover a busy room without the floor turning into soup. At 96 the
 * oldest mark is evicted roughly when it would have faded anyway.
 */
const MAX_DECALS = 96;

/** Seconds. Long enough that a cleared room still reads as fought-in. */
const LIFETIME: Record<DecalKind, number> = {
  [DECAL_BLOOD]: 26,
  [DECAL_SCORCH]: 20,
  [DECAL_FROST]: 9,   // frost is the one that should visibly thaw
  [DECAL_CRATER]: 34, // stone does not heal
};

/** Fraction of the lifetime spent fading out at the end. */
const FADE_TAIL = 0.35;

type Decal = {
  active: boolean;
  x: number;
  y: number;
  kind: DecalKind;
  life: number;
  maxLife: number;
  scale: number;
  seed: number;
  color: string;
};

/** Deterministic per-decal noise, so a mark never shimmers between frames. */
function rnd(seed: number, i: number): number {
  const n = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

export class DecalSystem {
  private readonly pool: Decal[] = [];
  private nextIndex = 0;

  constructor() {
    for (let i = 0; i < MAX_DECALS; i++) {
      this.pool.push({
        active: false, x: 0, y: 0, kind: DECAL_BLOOD,
        life: 0, maxLife: 1, scale: 1, seed: 0, color: '#7f1d1d',
      });
    }
  }

  /**
   * Place a mark at a world-pixel position.
   *
   * `color` only matters for blood — monsters bleed their own colour, and a
   * green slime leaving a red puddle was the sort of detail that reads as wrong
   * without the viewer being able to say why.
   */
  spawn(x: number, y: number, kind: DecalKind, scale = 1, color = '#7f1d1d'): void {
    // Oldest-first: the ring pointer means the pool always evicts the mark that
    // has been on the floor longest, never a fresh one.
    const d = this.pool[this.nextIndex];
    this.nextIndex = (this.nextIndex + 1) % MAX_DECALS;

    d.active = true;
    d.x = Math.round(x);
    d.y = Math.round(y);
    d.kind = kind;
    d.maxLife = LIFETIME[kind];
    d.life = d.maxLife;
    d.scale = scale;
    d.seed = (x * 31 + y * 17 + kind * 7) % 997;
    d.color = color;
  }

  update(dt: number): void {
    for (let i = 0; i < MAX_DECALS; i++) {
      const d = this.pool[i];
      if (!d.active) continue;
      d.life -= dt;
      if (d.life <= 0) d.active = false;
    }
  }

  clear(): void {
    for (let i = 0; i < MAX_DECALS; i++) this.pool[i].active = false;
    this.nextIndex = 0;
  }

  /** Live decal count — used by the render stats overlay. */
  get count(): number {
    let n = 0;
    for (let i = 0; i < MAX_DECALS; i++) if (this.pool[i].active) n++;
    return n;
  }

  render(ctx: CanvasRenderingContext2D, camX: number, camY: number, viewW: number, viewH: number): void {
    ctx.save();
    for (let i = 0; i < MAX_DECALS; i++) {
      const d = this.pool[i];
      if (!d.active) continue;

      const sx = d.x - camX;
      const sy = d.y - camY;
      const r = 12 * d.scale;
      if (sx < -r || sy < -r || sx > viewW + r || sy > viewH + r) continue;

      const t = d.life / d.maxLife;
      const alpha = t > FADE_TAIL ? 1 : t / FADE_TAIL;

      switch (d.kind) {
        case DECAL_BLOOD: this.drawBlood(ctx, sx, sy, d, alpha); break;
        case DECAL_SCORCH: this.drawScorch(ctx, sx, sy, d, alpha); break;
        case DECAL_FROST: this.drawFrost(ctx, sx, sy, d, alpha); break;
        case DECAL_CRATER: this.drawCrater(ctx, sx, sy, d, alpha); break;
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  /** A splatter: one body and a scatter of droplets, all pixel-aligned. */
  private drawBlood(ctx: CanvasRenderingContext2D, sx: number, sy: number, d: Decal, alpha: number): void {
    ctx.globalAlpha = alpha * 0.5;
    ctx.fillStyle = d.color;
    const s = d.scale;
    for (let i = 0; i < 5; i++) {
      const a = rnd(d.seed, i) * Math.PI * 2;
      const dist = rnd(d.seed, i + 20) * 3.5 * s;
      const w = Math.round((2 + rnd(d.seed, i + 40) * 3) * s);
      ctx.fillRect(Math.round(sx + Math.cos(a) * dist), Math.round(sy + Math.sin(a) * dist * 0.6), w, Math.max(1, Math.round(w * 0.7)));
    }
    ctx.globalAlpha = alpha * 0.32;
    for (let i = 0; i < 6; i++) {
      const a = rnd(d.seed, i + 60) * Math.PI * 2;
      const dist = (4 + rnd(d.seed, i + 80) * 7) * s;
      ctx.fillRect(Math.round(sx + Math.cos(a) * dist), Math.round(sy + Math.sin(a) * dist * 0.55), 1, 1);
    }
  }

  /** A burn: dark centre, ash ring, a couple of embers that outlive the flame. */
  private drawScorch(ctx: CanvasRenderingContext2D, sx: number, sy: number, d: Decal, alpha: number): void {
    const s = d.scale;
    ctx.globalAlpha = alpha * 0.42;
    ctx.fillStyle = '#18120f';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + rnd(d.seed, i) * 0.9;
      const dist = (1 + rnd(d.seed, i + 10) * 3) * s;
      const w = Math.round((3 + rnd(d.seed, i + 30) * 3) * s);
      ctx.fillRect(Math.round(sx + Math.cos(a) * dist), Math.round(sy + Math.sin(a) * dist * 0.6), w, Math.max(1, Math.round(w * 0.6)));
    }
    ctx.globalAlpha = alpha * 0.25;
    ctx.fillStyle = '#3d2a1c';
    for (let i = 0; i < 5; i++) {
      const a = rnd(d.seed, i + 50) * Math.PI * 2;
      const dist = (5 + rnd(d.seed, i + 70) * 5) * s;
      ctx.fillRect(Math.round(sx + Math.cos(a) * dist), Math.round(sy + Math.sin(a) * dist * 0.55), 1, 1);
    }
    // Embers only glow while the mark is fresh.
    const heat = Math.max(0, (d.life / d.maxLife - 0.72) / 0.28);
    if (heat > 0) {
      ctx.globalAlpha = heat * 0.7;
      ctx.fillStyle = '#f97316';
      for (let i = 0; i < 3; i++) {
        const a = rnd(d.seed, i + 90) * Math.PI * 2;
        const dist = (2 + rnd(d.seed, i + 95) * 4) * s;
        ctx.fillRect(Math.round(sx + Math.cos(a) * dist), Math.round(sy + Math.sin(a) * dist * 0.6), 1, 1);
      }
    }
  }

  /** A frost patch: pale sheet plus radiating crystal spurs. */
  private drawFrost(ctx: CanvasRenderingContext2D, sx: number, sy: number, d: Decal, alpha: number): void {
    const s = d.scale;
    ctx.globalAlpha = alpha * 0.3;
    ctx.fillStyle = '#bae6fd';
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + rnd(d.seed, i) * 0.7;
      const dist = (1 + rnd(d.seed, i + 12) * 3) * s;
      const w = Math.round((3 + rnd(d.seed, i + 24) * 2) * s);
      ctx.fillRect(Math.round(sx + Math.cos(a) * dist), Math.round(sy + Math.sin(a) * dist * 0.6), w, Math.max(1, Math.round(w * 0.55)));
    }
    ctx.globalAlpha = alpha * 0.55;
    ctx.fillStyle = '#e0f2fe';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const dist = (4 + rnd(d.seed, i + 36) * 4) * s;
      ctx.fillRect(Math.round(sx + Math.cos(a) * dist), Math.round(sy + Math.sin(a) * dist * 0.6), 1, 1);
    }
  }

  /** An impact: dark pit with a lit rim on the side the light comes from. */
  private drawCrater(ctx: CanvasRenderingContext2D, sx: number, sy: number, d: Decal, alpha: number): void {
    const s = d.scale;
    const r = Math.round(5 * s);
    ctx.globalAlpha = alpha * 0.4;
    ctx.fillStyle = '#0d0b12';
    ctx.beginPath();
    ctx.ellipse(Math.round(sx), Math.round(sy), r, Math.round(r * 0.6), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = alpha * 0.3;
    ctx.strokeStyle = '#6b7280';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(Math.round(sx), Math.round(sy) - 1, r, Math.round(r * 0.6), 0, Math.PI, Math.PI * 2);
    ctx.stroke();
    // Radial cracks.
    ctx.globalAlpha = alpha * 0.22;
    ctx.fillStyle = '#0d0b12';
    for (let i = 0; i < 5; i++) {
      const a = rnd(d.seed, i) * Math.PI * 2;
      const len = (r + 2) + rnd(d.seed, i + 15) * 4 * s;
      ctx.fillRect(Math.round(sx + Math.cos(a) * len), Math.round(sy + Math.sin(a) * len * 0.6), 1, 1);
    }
  }
}

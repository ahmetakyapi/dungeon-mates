'use client';

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactElement } from 'react';
import { cameThroughTransition } from '@/components/fx/PageTransition';
import { floorTheme } from '../../../../shared/types';
import { setScrollLocked } from './SmoothScroll';

/**
 * The way in.
 *
 * A wall torch catches in the dark, its light finds a stone archway, the
 * portcullis grinds up in chunky steps, the name drops onto the keystone and
 * the camera walks through the gate into the page. Everything is pixel art on
 * a 200×125 grid (SVG rects, crisp edges), in the first floor's own stone
 * palette — "Yıkık Kapılar" is literally the ruined gates.
 *
 * The whole sequence is CSS keyframes, so it starts on first paint from the
 * server HTML, before React hydrates, and ends on its own (opacity → 0,
 * visibility hidden) even if JavaScript never runs. JS only decides whether it
 * should play at all, locks scroll and tells the hero when to start.
 *
 * Plays once per browser session. An inline script in front of the overlay
 * reads sessionStorage and prefers-reduced-motion before the first paint and
 * marks <html data-dm-intro="skip">, which hides the overlay in CSS — later
 * visits never see a flash of it.
 */

const SEEN_KEY = 'dm-intro-seen';
/** Matches the .dm-gate fade-out keyframe (delay + duration) in landing.css. */
const TOTAL_MS = 2100;
/** When the hero starts revealing — just as the gate begins to fade. */
const HERO_AT_MS = 1760;

const PRE_PAINT = `try{var d=document.documentElement,s=sessionStorage.getItem('${SEEN_KEY}')==='1',r=matchMedia('(prefers-reduced-motion: reduce)').matches;d.setAttribute('data-dm-intro',s||r?'skip':'play');if(!s&&!r)sessionStorage.setItem('${SEEN_KEY}','1')}catch(e){}`;

// Decided once per page load and kept at module level: React's dev
// double-mount re-runs the effect, and a client-side navigation back to "/"
// must not replay the gate. Cleared once the gate has played out.
let decided: boolean | null = null;

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

// ── Pixel helpers ──────────────────────────────────────────

type Rect = readonly [x: number, y: number, w: number, h: number, fill: string];

/** Turns a character grid into rects, merging horizontal runs. */
function sprite(rows: readonly string[], palette: Record<string, string>, ox = 0, oy = 0): Rect[] {
  const out: Rect[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      const fill = palette[ch];
      if (!fill) { x++; continue; }
      let w = 1;
      while (x + w < row.length && row[x + w] === ch) w++;
      out.push([ox + x, oy + y, w, 1, fill]);
      x += w;
    }
  });
  return out;
}

function Rects({ rects }: { rects: readonly Rect[] }) {
  return <>{rects.map(([x, y, w, h, f], i) => <rect key={i} x={x} y={y} width={w} height={h} fill={f} />)}</>;
}

const STONE = floorTheme(1);
const [WALL_DARK, WALL, WALL_LIGHT, WALL_EDGE] = STONE.wall;
const [FLOOR_DARK, FLOOR, FLOOR_LIGHT, FLOOR_EDGE] = STONE.floor;
const IRON = '#23262f';
const IRON_LIGHT = '#4a5167';
const EMBER = '#ff8a3d';
const FLAME = '#ffb85c';
const CORE = '#fff1c2';
const DEEP_RED = '#c2410c';

// Arch geometry, in grid units (stage is 200 × 125).
const OPEN_X = 84;
const OPEN_Y = 52;
const OPEN_W = 32;
const OPEN_H = 48;
const GROUND = OPEN_Y + OPEN_H; // 100
/** Left edges of the two 6-wide torch flames. */
const TORCH_L = 66;
const TORCH_R = 128;

/** Rows of [y0, y1, x0, x1] — unions of these make the stepped arch shapes. */
type Row = readonly [number, number, number, number];
const rowsPath = (rows: readonly Row[]) => rows.map(([y0, y1, x0, x1]) => `M${x0} ${y0}H${x1}V${y1}H${x0}Z`).join('');

const OUTER: readonly Row[] = [
  [40, 42, 94, 106], [42, 44, 90, 110], [44, 46, 86, 114], [46, 48, 83, 117], [48, 50, 80, 120], [50, GROUND, 77, 123],
];
const OPENING: readonly Row[] = [
  [OPEN_Y, OPEN_Y + 2, 92, 108], [OPEN_Y + 2, OPEN_Y + 4, 88, 112], [OPEN_Y + 4, OPEN_Y + 6, 86, 114], [OPEN_Y + 6, GROUND, OPEN_X, OPEN_X + OPEN_W],
];
/** The arch ring: outer minus the opening (even-odd). */
const RING_PATH = rowsPath(OUTER) + rowsPath(OPENING);

/** Deterministic 0..1 noise so the wall dressing is stable across SSR/CSR. */
const noise = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

const ARCH_DETAIL: Rect[] = (() => {
  const r: Rect[] = [];
  // Jamb joints: stone courses every 6 rows, staggered between the two sides.
  for (let y = 56; y < GROUND; y += 6) {
    r.push([77, y, 7, 1, STONE.mortar], [116, y + 3, 7, 1, STONE.mortar]);
    r.push([77, y + 1, 7, 1, WALL_EDGE], [116, y + 4, 7, 1, WALL_EDGE]);
    r.push([80 + (y % 12 === 2 ? 1 : 3), y - 5, 1, 5, STONE.mortar]);
  }
  // Inner reveal shadow down both sides and under the arch.
  r.push([OPEN_X - 1, OPEN_Y + 6, 1, OPEN_H - 6, WALL_DARK], [OPEN_X + OPEN_W, OPEN_Y + 6, 1, OPEN_H - 6, WALL_DARK]);
  // Voussoir joints round the head.
  r.push([88, 44, 1, 4, STONE.mortar], [84, 48, 1, 6, STONE.mortar], [111, 44, 1, 4, STONE.mortar], [115, 48, 1, 6, STONE.mortar]);
  // Keystone.
  r.push([96, 38, 8, 14, STONE.mortar], [97, 39, 6, 12, WALL_EDGE], [97, 39, 6, 1, '#8590ab'], [97, 50, 6, 1, WALL]);
  // A carved skull on the keystone.
  r.push(...sprite(['.bbbb.', 'bbbbbb', 'b.bb.b', 'bbbbbb', '.b.bb.', '.bbbb.'], { b: '#c9c2ae' }, 97, 42));
  r.push([98, 44, 1, 1, '#14161e'], [101, 44, 1, 1, '#14161e']);
  // Top highlight of the ring.
  r.push([94, 40, 2, 1, WALL_EDGE], [104, 40, 2, 1, WALL_EDGE], [90, 42, 4, 1, WALL_EDGE], [106, 42, 4, 1, WALL_EDGE], [86, 44, 4, 1, WALL_EDGE], [110, 44, 4, 1, WALL_EDGE]);
  // Moss creeping out of the joints, and a crack in the right jamb.
  r.push([78, 92, 3, 1, STONE.growth], [77, 93, 2, 2, STONE.growth], [121, 80, 2, 1, STONE.growth], [85, 46, 2, 1, STONE.growth]);
  r.push([119, 60, 1, 3, WALL_DARK], [118, 63, 1, 2, WALL_DARK], [119, 65, 1, 2, WALL_DARK]);
  // Threshold step.
  r.push([75, GROUND, 50, 2, FLOOR_EDGE], [75, GROUND + 2, 50, 1, FLOOR_DARK]);
  return r;
})();

const WALL_DRESSING: Rect[] = (() => {
  const r: Rect[] = [];
  // A few bricks knocked darker or lighter so the wall doesn't read as tiled.
  for (let i = 0; i < 70; i++) {
    const row = Math.floor(noise(i + 7) * 30) - 5;
    const x = Math.floor(noise(i) * 26) * 8 - 4 + (row % 2 ? 4 : 0);
    const y = row * 4;
    if (y + 4 > GROUND || (x > 68 && x < 126 && y > 34) || (Math.abs(x - TORCH_L) < 10 && y > 44 && y < 66) || (Math.abs(x - TORCH_R) < 10 && y > 44 && y < 66)) continue;
    r.push([x + 1, y + 1, 7, 3, noise(i + 3) > 0.45 ? WALL_DARK : WALL_LIGHT]);
  }
  return r;
})();

// Torch flame: three 6×8 frames side by side, stepped through in CSS.
const FLAME_PAL = { r: DEEP_RED, o: EMBER, m: FLAME, c: CORE };
const FLAME_FRAMES = [
  ['..r...', '..or..', '.ror..', '.omor.', 'romoor', 'omcmor', 'rmccmo', '.rmmr.'],
  ['...r..', '..ro..', '..oor.', '.romo.', '.omcor', 'romcmo', 'omccmr', '.rmmr.'],
  ['......', '..r...', '.roo..', '.oomr.', 'romcor', 'omccmo', 'rmccmo', '.rmmr.'],
];
const FLAME_STRIP: Rect[] = FLAME_FRAMES.flatMap((f, i) => sprite(f, FLAME_PAL, i * 6, 0));

const SCONCE_ROWS = ['.hhhh.', '.iiii.', '..ww..', '..ww..', '..ww..', 'iiiiii'];
const SCONCE_PAL = { h: IRON_LIGHT, i: IRON, w: '#5a3a22' };
const SCONCES: Rect[] = [...sprite(SCONCE_ROWS, SCONCE_PAL, TORCH_L, 58), ...sprite(SCONCE_ROWS, SCONCE_PAL, TORCH_R, 58)];

// Portcullis: 32 × 48 iron grid with spiked feet.
const PORTCULLIS: Rect[] = (() => {
  const r: Rect[] = [];
  for (const x of [3, 9, 15, 21, 27]) {
    r.push([x, 0, 2, 45, IRON], [x, 0, 1, 45, IRON_LIGHT], [x, 45, 2, 2, IRON], [x + (x < 16 ? 1 : 0), 47, 1, 1, IRON_LIGHT]);
  }
  for (const y of [6, 16, 26, 36]) {
    r.push([0, y, 32, 2, IRON], [0, y, 32, 1, IRON_LIGHT]);
    for (const x of [3, 9, 15, 21, 27]) r.push([x, y, 1, 1, WALL_EDGE]);
  }
  return r;
})();

// The way down beyond the gate: steps narrowing into the dark.
const STAIRS: Rect[] = (() => {
  const r: Rect[] = [[OPEN_X, OPEN_Y, OPEN_W, OPEN_H, '#05060b']];
  const bands: ReadonlyArray<readonly [number, number, number, string, string]> = [
    [93, 7, 0, FLOOR_DARK, FLOOR], [88, 5, 2, '#1d2029', FLOOR_DARK], [84, 4, 4, '#14161e', '#1d2029'], [81, 3, 6, '#0d0f15', '#14161e'],
  ];
  for (const [y, h, m, fill, edge] of bands) r.push([OPEN_X + m, y, OPEN_W - m * 2, h, fill], [OPEN_X + m, y, OPEN_W - m * 2, 1, edge]);
  return r;
})();

/** Embers off the two torches, dust shaken loose by the gate. */
type Mote = { x: number; y: number; dx: number; dy: number; d: number; t: number; c: string; k: 'ember' | 'dust' };
const MOTES: Mote[] = [
  { x: 69, y: 51, dx: -3, dy: -16, d: 260, t: 1000, c: FLAME, k: 'ember' },
  { x: 70, y: 52, dx: 4, dy: -20, d: 480, t: 1100, c: EMBER, k: 'ember' },
  { x: 68, y: 52, dx: -5, dy: -13, d: 760, t: 900, c: FLAME, k: 'ember' },
  { x: 131, y: 51, dx: 3, dy: -17, d: 420, t: 1000, c: FLAME, k: 'ember' },
  { x: 130, y: 52, dx: -4, dy: -21, d: 640, t: 1100, c: EMBER, k: 'ember' },
  { x: 132, y: 52, dx: 5, dy: -14, d: 900, t: 900, c: FLAME, k: 'ember' },
  { x: 89, y: 47, dx: -1, dy: 14, d: 720, t: 620, c: WALL_EDGE, k: 'dust' },
  { x: 95, y: 45, dx: 1, dy: 18, d: 780, t: 680, c: WALL_LIGHT, k: 'dust' },
  { x: 104, y: 45, dx: -1, dy: 16, d: 760, t: 640, c: WALL_EDGE, k: 'dust' },
  { x: 111, y: 47, dx: 1, dy: 15, d: 820, t: 600, c: WALL_LIGHT, k: 'dust' },
  { x: 99, y: 44, dx: 0, dy: 20, d: 900, t: 700, c: WALL_EDGE, k: 'dust' },
  { x: 86, y: 98, dx: -9, dy: -3, d: 720, t: 520, c: FLOOR_EDGE, k: 'dust' },
  { x: 113, y: 98, dx: 9, dy: -3, d: 720, t: 520, c: FLOOR_EDGE, k: 'dust' },
  { x: 90, y: 99, dx: -6, dy: -5, d: 760, t: 560, c: FLOOR_LIGHT, k: 'dust' },
  { x: 109, y: 99, dx: 6, dy: -5, d: 760, t: 560, c: FLOOR_LIGHT, k: 'dust' },
];

const at = (x: number, y: number, w: number, h: number): CSSProperties => ({
  left: `calc(${x} * var(--u))`, top: `calc(${y} * var(--u))`, width: `calc(${w} * var(--u))`, height: `calc(${h} * var(--u))`,
});

function Torch({ x, delay }: { x: number; delay: number }): ReactElement {
  const vars = { ['--d' as string]: `${delay}ms` } as CSSProperties;
  return (
    <>
      <span className="dm-gate-glow" style={{ ...at(x - 22, 32, 50, 44), ...vars }} />
      <span className="dm-gate-flame" style={{ ...at(x, 50, 6, 8), ...vars }}>
        <svg viewBox="0 0 18 8" shapeRendering="crispEdges" preserveAspectRatio="none"><Rects rects={FLAME_STRIP} /></svg>
      </span>
    </>
  );
}

export function DungeonGate({ onDone }: { onDone: () => void }) {
  const [show, setShow] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  useIsoLayoutEffect(() => {
    const html = document.documentElement;
    const attr = html.getAttribute('data-dm-intro');
    let seen = false;
    try { seen = sessionStorage.getItem(SEEN_KEY) === '1'; } catch { /* private mode */ }
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    // 'play' means the pre-paint script ran on this hard load and already
    // marked the session; no attribute means it was blocked, so decide here.
    if (decided === null) {
      decided = !cameThroughTransition() && !reduced && attr !== 'skip' && (attr === 'play' || !seen);
    }
    const play = decided;
    if (!play) {
      html.setAttribute('data-dm-intro', 'skip');
      setShow(false);
      onDone();
      return;
    }
    try { sessionStorage.setItem(SEEN_KEY, '1'); } catch { /* ignore */ }
    setScrollLocked(true);
    window.scrollTo(0, 0);

    // The keyframes started at first paint, maybe well before hydration on a
    // slow phone, so time the rest from where the CSS clock actually is.
    const anim = ref.current?.getAnimations?.().find((a) => (a as CSSAnimation).animationName === 'dm-gate-out');
    const elapsed = typeof anim?.currentTime === 'number' ? anim.currentTime : 0;
    const heroT = window.setTimeout(() => { setScrollLocked(false); onDone(); }, Math.max(0, HERO_AT_MS - elapsed));
    const endT = window.setTimeout(() => {
      decided = false;
      html.setAttribute('data-dm-intro', 'done');
      setShow(false);
    }, Math.max(0, TOTAL_MS - elapsed) + 60);
    return () => { window.clearTimeout(heroT); window.clearTimeout(endT); setScrollLocked(false); };
    // onDone is stable for the page's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!show) return null;

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: PRE_PAINT }} />
      <div ref={ref} className="dm-gate" role="presentation" aria-hidden>
        <div className="dm-gate-stage">
          <div className="dm-gate-cam">
            {/* Wall and floor */}
            <svg className="dm-gate-layer" viewBox="0 0 200 125" shapeRendering="crispEdges" preserveAspectRatio="none">
              <defs>
                <pattern id="dm-gate-bricks" width="16" height="8" patternUnits="userSpaceOnUse">
                  <rect width="16" height="8" fill={WALL} />
                  <rect x="1" y="1" width="7" height="1" fill={WALL_LIGHT} />
                  <rect x="9" y="1" width="7" height="1" fill={WALL_LIGHT} />
                  <rect x="5" y="5" width="7" height="1" fill={WALL_LIGHT} />
                  <rect x="13" y="5" width="3" height="1" fill={WALL_LIGHT} />
                  <rect x="0" y="5" width="4" height="1" fill={WALL_LIGHT} />
                  <rect x="1" y="3" width="7" height="1" fill={WALL_DARK} />
                  <rect x="9" y="3" width="7" height="1" fill={WALL_DARK} />
                  <rect x="5" y="7" width="7" height="1" fill={WALL_DARK} />
                  <rect x="13" y="7" width="3" height="1" fill={WALL_DARK} />
                  <rect x="0" y="7" width="4" height="1" fill={WALL_DARK} />
                  <rect width="16" height="1" fill={STONE.mortar} />
                  <rect y="4" width="16" height="1" fill={STONE.mortar} />
                  <rect x="0" width="1" height="4" fill={STONE.mortar} />
                  <rect x="8" width="1" height="4" fill={STONE.mortar} />
                  <rect x="4" y="4" width="1" height="4" fill={STONE.mortar} />
                  <rect x="12" y="4" width="1" height="4" fill={STONE.mortar} />
                </pattern>
                <pattern id="dm-gate-slabs" width="12" height="6" patternUnits="userSpaceOnUse">
                  <rect width="12" height="6" fill={FLOOR} />
                  <rect width="12" height="1" fill={FLOOR_DARK} />
                  <rect y="3" width="12" height="1" fill={FLOOR_DARK} />
                  <rect x="0" y="0" width="1" height="3" fill={FLOOR_DARK} />
                  <rect x="6" y="3" width="1" height="3" fill={FLOOR_DARK} />
                  <rect x="1" y="1" width="5" height="1" fill={FLOOR_LIGHT} />
                  <rect x="7" y="4" width="5" height="1" fill={FLOOR_LIGHT} />
                </pattern>
              </defs>
              {/* Runs well past the stage so no edge shows on tall or wide screens. */}
              <rect x="-104" y="-80" width="408" height={GROUND + 80} fill="url(#dm-gate-bricks)" />
              <Rects rects={WALL_DRESSING} />
              <rect x="-104" y={GROUND} width="408" height="100" fill="url(#dm-gate-slabs)" />
            </svg>

            {/* What waits beyond the gate */}
            <svg className="dm-gate-layer" viewBox="0 0 200 125" shapeRendering="crispEdges" preserveAspectRatio="none">
              <Rects rects={STAIRS} />
            </svg>
            <span className="dm-gate-deep" style={at(OPEN_X, OPEN_Y, OPEN_W, OPEN_H)} />

            {/* Portcullis, clipped to the opening */}
            <div className="dm-gate-well" style={at(OPEN_X, OPEN_Y, OPEN_W, OPEN_H)}>
              <svg className="dm-gate-bars" viewBox="0 0 32 48" shapeRendering="crispEdges" preserveAspectRatio="none">
                <Rects rects={PORTCULLIS} />
              </svg>
            </div>

            {/* Arch ring + sconces, in front of the bars */}
            <svg className="dm-gate-layer" viewBox="0 0 200 125" shapeRendering="crispEdges" preserveAspectRatio="none">
              <path d={RING_PATH} fill={WALL_LIGHT} fillRule="evenodd" />
              <Rects rects={ARCH_DETAIL} />
              <Rects rects={SCONCES} />
            </svg>

            {/* Torchlight: banded, like the game's own light falloff */}
            <span className="dm-gate-dark" />
            <span className="dm-gate-black" />

            <Torch x={TORCH_L} delay={140} />
            <Torch x={TORCH_R} delay={300} />

            {MOTES.map((m, i) => (
              <span
                key={i}
                className={`dm-gate-mote dm-gate-mote--${m.k}`}
                style={{
                  ...at(m.x, m.y, 1, 1),
                  background: m.c,
                  ['--dx' as string]: m.dx,
                  ['--dy' as string]: m.dy,
                  ['--d' as string]: `${m.d}ms`,
                  ['--t' as string]: `${m.t}ms`,
                } as CSSProperties}
              />
            ))}

            <p className="dm-gate-logo" style={at(0, 18, 200, 14)}>
              <span className="dm-gate-logo-drop">
                <span className="dm-gate-logo-land"><span>Dungeon</span><span>Mates</span></span>
              </span>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

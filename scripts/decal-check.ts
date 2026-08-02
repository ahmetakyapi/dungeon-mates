/**
 * DecalSystem checks. Runs the real class against a recording stub of
 * CanvasRenderingContext2D, so it verifies drawing behaviour without a browser.
 *
 *   npx tsx scripts/decal-check.ts
 */
import {
  DecalSystem, DECAL_BLOOD, DECAL_SCORCH, DECAL_FROST, DECAL_CRATER,
} from '../src/game/renderer/DecalSystem';

type Call = { op: string; args: unknown[] };

/** Records every draw op and the alpha in force when it happened. */
function stubCtx() {
  const calls: Call[] = [];
  const state = { globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1 };
  const rec = (op: string) => (...args: unknown[]) => {
    calls.push({ op, args: [...args, { alpha: state.globalAlpha, fill: state.fillStyle }] });
  };
  const ctx = {
    get globalAlpha() { return state.globalAlpha; },
    set globalAlpha(v: number) { state.globalAlpha = v; },
    get fillStyle() { return state.fillStyle; },
    set fillStyle(v: string) { state.fillStyle = v; },
    get strokeStyle() { return state.strokeStyle; },
    set strokeStyle(v: string) { state.strokeStyle = v; },
    get lineWidth() { return state.lineWidth; },
    set lineWidth(v: number) { state.lineWidth = v; },
    save: rec('save'), restore: rec('restore'),
    fillRect: rec('fillRect'), beginPath: rec('beginPath'),
    ellipse: rec('ellipse'), fill: rec('fill'), stroke: rec('stroke'),
  } as unknown as CanvasRenderingContext2D;
  return { ctx, calls, drawOps: () => calls.filter((c) => c.op === 'fillRect' || c.op === 'fill' || c.op === 'stroke') };
}

let failures = 0;
const check = (name: string, cond: boolean, detail = '') => {
  if (cond) { console.log(`  ok   ${name}`); return; }
  failures++;
  console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`);
};

console.log('\nDecalSystem');

// --- each kind draws something ---
for (const [label, kind] of [
  ['blood', DECAL_BLOOD], ['scorch', DECAL_SCORCH],
  ['frost', DECAL_FROST], ['crater', DECAL_CRATER],
] as const) {
  const d = new DecalSystem();
  d.spawn(100, 100, kind, 1, '#4ade80');
  const { ctx, drawOps } = stubCtx();
  d.render(ctx, 0, 0, 480, 270);
  check(`${label} draws`, drawOps().length > 0, `${drawOps().length} ops`);
}

// --- blood uses the colour it was given ---
{
  const d = new DecalSystem();
  d.spawn(50, 50, DECAL_BLOOD, 1, '#4ade80');
  const { ctx, calls } = stubCtx();
  d.render(ctx, 0, 0, 480, 270);
  const usedGreen = calls.some((c) => (c.args.at(-1) as { fill: string }).fill === '#4ade80');
  check('blood honours the monster colour', usedGreen);
}

// --- off-camera decals are culled ---
{
  const d = new DecalSystem();
  d.spawn(5000, 5000, DECAL_BLOOD);
  const { ctx, drawOps } = stubCtx();
  d.render(ctx, 0, 0, 480, 270);
  check('off-camera decal is culled', drawOps().length === 0, `${drawOps().length} ops`);
}

// --- lifetime: fades then expires ---
{
  const d = new DecalSystem();
  d.spawn(20, 20, DECAL_FROST);
  const alphaAt = (sys: DecalSystem) => {
    const { ctx, drawOps } = stubCtx();
    sys.render(ctx, 0, 0, 480, 270);
    const ops = drawOps();
    if (!ops.length) return 0;
    return Math.max(...ops.map((c) => (c.args.at(-1) as { alpha: number }).alpha));
  };
  const fresh = alphaAt(d);
  d.update(7.5); // frost lives 9s; 7.5 is inside the 35% fade tail
  const faded = alphaAt(d);
  d.update(3);
  const gone = alphaAt(d);
  check('decal fades before expiring', faded < fresh && faded > 0, `fresh=${fresh.toFixed(2)} faded=${faded.toFixed(2)}`);
  check('decal expires', gone === 0);
  check('expired decal leaves the pool', d.count === 0, `count=${d.count}`);
}

// --- pool is bounded and evicts oldest-first ---
{
  const d = new DecalSystem();
  for (let i = 0; i < 400; i++) d.spawn(i, i, DECAL_BLOOD);
  check('pool is capped', d.count <= 96, `count=${d.count}`);

  // The first spawn is long gone; the most recent must still be alive. The
  // survivors sit at (304,304)..(399,399), so put the camera origin just below
  // that band — screen pos is world minus camera.
  const near = stubCtx();
  d.render(near.ctx, 300, 300, 480, 270);
  check('newest decals survive eviction', near.drawOps().length > 0);

  // ...and the oldest are genuinely gone, not merely off-screen.
  const far = stubCtx();
  d.render(far.ctx, 0, 0, 480, 270); // would cover (0,0)..(480,270) incl. spawn #0
  const drewAtOrigin = far.drawOps().some((c) => {
    const [x, y] = c.args as number[];
    return typeof x === 'number' && x < 60 && typeof y === 'number' && y < 60;
  });
  check('evicted decals stop drawing', !drewAtOrigin);
}

// --- clear empties it ---
{
  const d = new DecalSystem();
  for (let i = 0; i < 10; i++) d.spawn(i * 4, i * 4, DECAL_SCORCH);
  d.clear();
  check('clear() empties the pool', d.count === 0, `count=${d.count}`);
}

// --- determinism: the same decal draws identically across frames ---
{
  const d = new DecalSystem();
  d.spawn(64, 64, DECAL_SCORCH);
  const sig = () => {
    const { ctx, drawOps } = stubCtx();
    d.render(ctx, 0, 0, 480, 270);
    return JSON.stringify(drawOps().map((c) => c.args.slice(0, 4)));
  };
  check('decal geometry is stable between frames', sig() === sig());
}

console.log(failures === 0 ? '\nAll decal checks passed.\n' : `\n${failures} decal check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);

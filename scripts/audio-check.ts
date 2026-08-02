/**
 * Audio bus checks.
 *
 * Runs the real SoundManager against a stub Web Audio API and asserts the
 * signal path and ducking behave. No browser, no speakers — this verifies the
 * graph is wired the way the mix depends on.
 *
 *   npx tsx scripts/audio-check.ts
 */
type AudioParamStub = { value: number; min: number };

type StubNode = { kind: string; connectedTo: StubNode[]; params: Record<string, AudioParamStub> };

const created: StubNode[] = [];
function mkNode(kind: string, params: Record<string, number> = {}): StubNode {
  const p: Record<string, AudioParamStub> = {};
  for (const [k, v] of Object.entries(params)) {
    // Declared first so `this` inside the methods is the param, not `{}`.
    const param: AudioParamStub = { value: v, min: v };
    const set = (x: number) => { param.value = x; param.min = Math.min(param.min, x); };
    Object.assign(param, {
      cancelScheduledValues() {},
      setValueAtTime: set,
      linearRampToValueAtTime: set,
      exponentialRampToValueAtTime: set,
      setTargetAtTime: set,
    });
    p[k] = param;
  }
  const n: StubNode = { kind, connectedTo: [], params: p };
  created.push(n);
  return Object.assign(n, {
    connect(dest: StubNode) { n.connectedTo.push(dest); return dest; },
    disconnect() {},
    start() {}, stop() {},
    ...p,
  }) as unknown as StubNode;
}

class StubCtx {
  currentTime = 0;
  sampleRate = 48000;
  state = 'running';
  destination = mkNode('destination');
  createGain() { return mkNode('gain', { gain: 1 }); }
  createDynamicsCompressor() { return mkNode('compressor', { threshold: 0, knee: 0, ratio: 1, attack: 0, release: 0 }); }
  createBiquadFilter() { return Object.assign(mkNode('biquad', { frequency: 350, gain: 0, Q: 1 }), { type: 'lowpass' }); }
  createOscillator() { return Object.assign(mkNode('osc', { frequency: 440, detune: 0 }), { type: 'sine' }); }
  createBufferSource() { return Object.assign(mkNode('bufsrc', { playbackRate: 1 }), { buffer: null, loop: false }); }
  createBuffer() { return { getChannelData: () => new Float32Array(1024), length: 1024 }; }
  createStereoPanner() { return mkNode('panner', { pan: 0 }); }
  createWaveShaper() { return Object.assign(mkNode('shaper'), { curve: null, oversample: 'none' }); }
  createConvolver() { return Object.assign(mkNode('convolver'), { buffer: null }); }
  createDelay() { return mkNode('delay', { delayTime: 0 }); }
  resume() {}
}

(globalThis as unknown as { AudioContext: unknown }).AudioContext = StubCtx;
(globalThis as unknown as { window: unknown }).window = globalThis;

let failures = 0;
const check = (name: string, cond: boolean, detail = '') => {
  if (cond) { console.log(`  ok   ${name}`); return; }
  failures++;
  console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`);
};

console.log('\nAudio bus');

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { SoundManager } = require('../src/game/audio/SoundManager') as typeof import('../src/game/audio/SoundManager');
const sm = SoundManager.getInstance();
// Any call forces the graph to build.
sm.playHit();

const byKind = (k: string) => created.filter((n) => n.kind === k);

check('a limiter exists on the bus', byKind('compressor').length > 0);
{
  const lim = byKind('compressor')[0];
  check('limiter threshold is below full scale', lim && lim.params.threshold.value < 0,
    lim ? String(lim.params.threshold.value) : 'none');
  check('limiter ratio actually limits', lim && lim.params.ratio.value >= 8,
    lim ? String(lim.params.ratio.value) : 'none');
  check('limiter attack is fast enough for transients', lim && lim.params.attack.value <= 0.01,
    lim ? String(lim.params.attack.value) : 'none');
}
{
  const shelf = byKind('biquad').find((n) => (n as unknown as { type: string }).type === 'highshelf');
  check('harshness shelf exists', Boolean(shelf));
  check('shelf cuts rather than boosts', Boolean(shelf) && shelf!.params.gain.value < 0,
    shelf ? String(shelf.params.gain.value) : 'none');
}

// --- ducking ---
{
  const gains = byKind('gain');
  for (const g of gains) g.params.gain.min = g.params.gain.value;
  sm.playBossAppear();
  const dipped = gains.filter((g) => g.params.gain.min < g.params.gain.value).length;
  check('a loud cue ducks the score', dipped > 0,
    `${dipped} gains dipped; mins=${gains.map((g) => g.params.gain.min.toFixed(2)).join(',')}`);
}
{
  // A footstep is configured to duck nothing; the score must not flinch.
  const gains = byKind('gain');
  for (const g of gains) g.params.gain.min = g.params.gain.value;
  sm.playFootstep(1);
  const dipped = gains.filter((g) => g.params.gain.min < g.params.gain.value).length;
  check('footsteps do not duck the score', dipped === 0, `${dipped} gains dipped`);
}

// --- the first play of a throttled sound must not be swallowed ---
//
// canPlay defaulted the last-play time to 0 while performance.now() counts from
// navigation start, so for the first second of a page every sound with a 1s
// cooldown was silently dropped. This is that regression.
{
  const fresh = new (SoundManager as unknown as { new (): typeof sm })();
  const before = created.length;
  (fresh as unknown as { playBossAppear(): void }).playBossAppear();
  check('first play of a throttled sound is audible', created.length > before,
    `${created.length - before} nodes created`);
}

console.log(failures === 0 ? '\nAll audio checks passed.\n' : `\n${failures} audio check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);

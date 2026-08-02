// ==========================================
// Dungeon Mates — Main Canvas Renderer
// Pixel-art style, logical resolution scaled up
// Mobile-optimized with auto-quality, fog caching
// Visual effects: vignette, screen flash, ambient particles
// ==========================================

import type { GameState, PlayerState, MonsterState, ProjectileState, LootState, TileType, DamageType, Direction, MonsterType, Vec2 } from '../../../shared/types';
import { TILE_SIZE, CLASS_STATS, MONSTER_STATS, LOOT_TABLE, ELITE_AFFIXES, floorTheme, TELEGRAPH_NONE, TELEGRAPH_CONE, TELEGRAPH_LINE } from '../../../shared/types';
import { Camera } from './Camera';
import { SpriteRenderer, isTorchWall, TORCH_ANCHOR_X, TORCH_ANCHOR_Y } from './SpriteRenderer';
import { drawPixelText, drawPixelTextOutlined, measurePixelText, PIXEL_FONT_HEIGHT } from './PixelFont';
import { ParticleSystem } from './ParticleSystem';
import { DecalSystem, DECAL_BLOOD, DECAL_SCORCH, DECAL_FROST, DECAL_CRATER } from './DecalSystem';

// Logical render resolution
const LOGICAL_WIDTH_DESKTOP = 480;
const LOGICAL_HEIGHT_DESKTOP = 270;
const LOGICAL_WIDTH_MOBILE = 360;
const LOGICAL_HEIGHT_MOBILE = 240;

// Quality presets — tuned for smooth 60fps / minimal eye strain
const QUALITY_PRESETS = {
  low: {
    particles: false, fogSimple: true, fpsCap: 30, particleMax: 0, effects: false,
    bloom: 0, colorGrade: false, torchFlicker: false, shadowDynamic: false,
  },
  medium: {
    particles: true, fogSimple: false, fpsCap: 60, particleMax: 384, effects: true,
    bloom: 0.22, colorGrade: true, torchFlicker: true, shadowDynamic: false,
  },
  high: {
    particles: true, fogSimple: false, fpsCap: 120, particleMax: 1024, effects: true,
    bloom: 0.38, colorGrade: true, torchFlicker: true, shadowDynamic: true,
  },
} as const;

type QualityLevel = keyof typeof QUALITY_PRESETS;

// Bloom resolution — 1/4 of logical render size
const BLOOM_SCALE = 0.25;

// Damage number floating text
type DamageNumberKind = 'damage' | 'heal' | 'gold' | 'critical' | 'fire' | 'ice' | 'poison' | 'holy';

type DamageNumber = {
  x: number;
  y: number;
  vy: number; // upward velocity
  text: string;
  rawValue: number;     // accumulated numeric value (for merging)
  color: string;
  glow: string;
  life: number;
  maxLife: number;
  kind: DamageNumberKind;
  scale: number;
  shake: number; // small x-wobble for crit
  mergeBumpTimer: number; // brief 0..1 bump when merged
};

const DAMAGE_NUMBER_DURATION = 0.75;
const MAX_DAMAGE_NUMBERS = 14;
// Merge window: if a new damage number is <8px + same entity within 200ms → add to existing
const DMG_MERGE_RADIUS = 8;
const DMG_MERGE_WINDOW = 0.20;

// Color palette per damage type — softened for eye comfort (lower saturation, less glow)
const DMG_COLOR: Record<DamageNumberKind, { color: string; glow: string; prefix: string; suffix: string }> = {
  damage:   { color: '#f5f5f5', glow: 'rgba(245,245,245,0.4)',  prefix: '', suffix: '' },
  critical: { color: '#fcd34d', glow: 'rgba(252,211,77,0.7)',   prefix: '', suffix: '!' },
  heal:     { color: '#86efac', glow: 'rgba(134,239,172,0.55)', prefix: '+', suffix: '' },
  gold:     { color: '#fde68a', glow: 'rgba(253,230,138,0.55)', prefix: '+', suffix: 'g' },
  fire:     { color: '#fb923c', glow: 'rgba(251,146,60,0.6)',   prefix: '', suffix: '' },
  ice:      { color: '#bae6fd', glow: 'rgba(186,230,253,0.6)',  prefix: '', suffix: '' },
  poison:   { color: '#c4b5fd', glow: 'rgba(196,181,253,0.6)',  prefix: '', suffix: '' },
  holy:     { color: '#fef3c7', glow: 'rgba(254,243,199,0.65)', prefix: '', suffix: '' },
};

// Fog of war tile cache
type FogState = 0 | 1 | 2; // 0 = hidden, 1 = explored, 2 = visible

// Performance monitor
const PERF_SAMPLE_COUNT = 30;
const PERF_CHECK_INTERVAL = 2000; // ms

// Vision radius for fog (reduced with darkness modifier)
// Matches AIM_SNAP_TOLERANCE on the server (~35°) so the highlighted target is
// exactly the one the shot will resolve against.
const AIM_SNAP_COS = Math.cos(0.61);

/**
 * Is this entity actually walking?
 *
 * The server zeroes velocity the moment input stops, so this is an exact
 * answer rather than a guess from position deltas. The threshold only exists to
 * ignore the residue of a decaying knockback.
 */
function isEntityMoving(v: Vec2 | undefined): boolean {
  if (!v) return false;
  return Math.abs(v.x) > 0.02 || Math.abs(v.y) > 0.02;
}

const VISION_RADIUS = 10;
const VISION_RADIUS_DARKNESS = 6;

export class GameRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly offscreen: HTMLCanvasElement;
  private readonly offCtx: CanvasRenderingContext2D;
  private readonly camera: Camera;
  private readonly sprites: SpriteRenderer;
  private readonly particles: ParticleSystem;
  private readonly damageNumbers: DamageNumber[] = [];
  private fogGrid: FogState[][] = [];
  private animFrame = 0;
  private animTimer = 0;
  private lastTime = 0;
  private firstRender = true;

  // Mobile detection
  private readonly isMobile: boolean;
  private readonly logicalWidth: number;
  private readonly logicalHeight: number;
  private readonly devicePixelRatio: number;

  // Quality system
  private quality: QualityLevel = 'high';
  private readonly frameTimes: number[] = [];
  private lastPerfCheck = 0;

  // Fog cache
  private fogCacheCanvas: HTMLCanvasElement | null = null;
  private fogCacheCtx: CanvasRenderingContext2D | null = null;
  private fogCachePlayerTileX = -1;
  private fogCachePlayerTileY = -1;
  private fogCacheDirty = true;

  // Cache to track entity states for flash effects
  private readonly prevHp: Map<string, number> = new Map();

  // Server-provided damage metadata keyed by targetId — consumed once then cleared
  private readonly pendingDamageMeta: Map<string, { isCrit?: boolean; isHeal?: boolean; damageType?: DamageType; kx?: number; ky?: number; shake?: number; value?: number; _ts: number }> = new Map();

  // Frame timing for FPS cap
  private lastFrameTime = 0;

  // Screen flash effect
  // Hybrid aim — set each frame by the game loop; null = auto-targeting.
  private aimAngle: number | null = null;

  // Accessibility
  private shakeScale = 1;
  private flashEnabled = true;
  private ambientEnabled = true;
  private highContrastTelegraph = false;

  private screenFlashAlpha = 0;
  private screenFlashColor = '#ffffff';

  // Boss room state
  private wasBossPhase = false;

  // Ambient dust timer
  private dustSpawnTimer = 0;

  // Torch positions cache (rebuilt when fog changes)
  private torchPositions: Array<{ x: number; y: number }> = [];
  private torchCacheTick = -1;

  // Film grain noise canvases (pre-generated pool, cycled to avoid per-frame createImageData)
  private grainCanvases: HTMLCanvasElement[] = [];
  private grainCanvas: HTMLCanvasElement | null = null;
  private grainIndex = 0;
  private grainPhase = 0;

  // Low HP vignette pulse timer
  private lowHpPulseTimer = 0;

  // Torch flame animation frame
  private torchFlameFrame = 0;
  private torchFlameTimer = 0;

  // Cached vignette canvases (avoid creating gradients every frame)
  private vignetteCanvas: HTMLCanvasElement | null = null;
  private redVignetteCanvas: HTMLCanvasElement | null = null;
  private lastRedVignetteIntensity = -1;

  // Cleanup counter to avoid checking prevHp/prevEntityPositions every frame
  private entityCleanupCounter = 0;

  // Pre-rendered torch light canvas (avoids createRadialGradient per torch per frame)
  private _torchLightCanvas: HTMLCanvasElement | null = null;

  // Circular buffer write index for perf monitoring
  private _perfWriteIdx = 0;

  // Pre-created radial gradient canvas for fog (avoids creating gradients per-frame)
  private fogGradientCanvas: HTMLCanvasElement | null = null;

  // Soft-fog buffer: one pixel per tile, upscaled with smoothing on. See renderFogSoft.
  private fogBuffer: HTMLCanvasElement | null = null;
  private fogBufferCtx: CanvasRenderingContext2D | null = null;
  private fogBufferImage: ImageData | null = null;
  private fogBufferW = 0;
  private fogBufferH = 0;

  // Pre-rendered vision falloff canvas (avoids createRadialGradient per player per frame)
  private visionFalloffCanvas: HTMLCanvasElement | null = null;
  private visionFalloffRadius = -1;

  // Environmental decorations. Blood used to be a separate circular buffer that
  // drew the same four pixels in the same colour and never faded; DecalSystem
  // replaces it and covers scorch, frost and craters too.
  private readonly decals = new DecalSystem();
  private boneFragments: Array<{ x: number; y: number; seed: number }> = [];
  private cobwebPositions: Array<{ x: number; y: number; corner: number }> = [];
  private floorCracks: Array<{ x: number; y: number; seed: number }> = [];
  private decorCacheFloor = -1; // track floor changes for clearing
  private waterDripTimer = 0;

  // Boss room entrance effect
  private bossEntranceFlash = 0;
  private bossEntranceShake = false;

  // Loot pickup flash
  private lootFlashAlpha = 0;
  private lootFlashColor = '#fbbf24';

  // Current vision radius (may be reduced by darkness modifier)
  private currentVisionRadius = VISION_RADIUS;

  // Fog noise animation timer
  private fogNoiseTimer = 0;
  private fogNoiseCanvas: HTMLCanvasElement | null = null;

  // Freeze frame (hitstop) system
  private freezeFrameMs = 0;
  private prevEntityPositions: Map<string, { x: number; y: number }> = new Map();

  // Fog invalidation hash (tracks all player positions + vision radius)
  private _fogHash = 0;

  // Bloom post-processing: two-pass ping-pong canvases at 1/4 resolution
  private bloomA: HTMLCanvasElement | null = null;
  private bloomACtx: CanvasRenderingContext2D | null = null;
  private bloomB: HTMLCanvasElement | null = null;
  private bloomBCtx: CanvasRenderingContext2D | null = null;

  // Torch flicker: deterministic noise lookup (60 frames)
  private readonly torchFlicker: Float32Array = (() => {
    const arr = new Float32Array(60);
    for (let i = 0; i < arr.length; i++) {
      // Multi-octave noise for organic flicker
      const a = Math.sin(i * 0.73) * 0.5;
      const b = Math.sin(i * 1.37 + 1.1) * 0.3;
      const c = Math.sin(i * 2.1 + 0.3) * 0.2;
      arr[i] = a + b + c; // range ~[-1, 1]
    }
    return arr;
  })();

  // Ambient floor theme — computed per floor for themed atmosphere
  private ambientThemeFloor = -1;

  // Reusable light source object for nearest-torch calc (avoids allocation)
  private readonly _lightSrc: { dx: number; dy: number; strength: number } = { dx: 0, dy: 0, strength: 0 };

  /** Find nearest torch direction from entity world-space center. Mutates & returns reusable object (or null). */
  private computeNearestTorchLight(wx: number, wy: number): { dx: number; dy: number; strength: number } | null {
    if (this.torchPositions.length === 0) return null;
    let bestD2 = Infinity;
    let bestX = 0;
    let bestY = 0;
    for (let i = 0; i < this.torchPositions.length; i++) {
      const t = this.torchPositions[i];
      const dx = t.x - wx;
      const dy = t.y - wy;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) {
        bestD2 = d2;
        bestX = dx;
        bestY = dy;
      }
    }
    // 80px radius max effect
    if (bestD2 > 80 * 80) return null;
    const s = 1 - Math.sqrt(bestD2) / 80;
    this._lightSrc.dx = bestX;
    this._lightSrc.dy = bestY;
    this._lightSrc.strength = s;
    return this._lightSrc;
  }

  // Last known monster position+color — used to emit death FX when server drops a dead monster from state
  // Previous-frame flags for edge-triggered VFX. See detectStateTransitions.
  private readonly prevPlayerFlags: Map<string, {
    dodging: boolean; alive: boolean; abilityCd: number; stun: number;
    abilityActive: boolean; comboTier: number;
  }> = new Map();
  /** Throttles elemental ground marks — see queueDamageMeta's consumer. */
  private elementalHitCount = 0;

  private readonly prevMonsterFlags: Map<string, {
    enraged: boolean; shield: boolean; phased: boolean; stun: number; casting: boolean;
    phase: string;
  }> = new Map();

  private readonly prevMonsterSnapshot: Map<string, { x: number; y: number; type: string; isBoss: boolean; facing: Direction; isElite: boolean }> = new Map();
  // Client-side dying entities for squash+spin animation (2 ticks ~100ms)
  private readonly dyingEntities: Array<{
    x: number; y: number; type: string; color: string;
    elapsed: number; duration: number; isBoss: boolean;
    facing: Direction; isElite: boolean; tipDir: number;
  }> = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context');
    this.ctx = ctx;

    // Detect mobile and DPR
    this.isMobile = typeof window !== 'undefined' && (
      window.innerWidth < 768 || ('ontouchstart' in window && navigator.maxTouchPoints > 0)
    );
    this.devicePixelRatio = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 3) : 1;

    // Set logical resolution based on device
    this.logicalWidth = this.isMobile ? LOGICAL_WIDTH_MOBILE : LOGICAL_WIDTH_DESKTOP;
    this.logicalHeight = this.isMobile ? LOGICAL_HEIGHT_MOBILE : LOGICAL_HEIGHT_DESKTOP;

    // Offscreen canvas for logical resolution rendering
    this.offscreen = document.createElement('canvas');
    this.offscreen.width = this.logicalWidth;
    this.offscreen.height = this.logicalHeight;
    const offCtx = this.offscreen.getContext('2d');
    if (!offCtx) throw new Error('Could not get offscreen 2D context');
    this.offCtx = offCtx;

    this.camera = new Camera(this.logicalWidth, this.logicalHeight);
    this.sprites = new SpriteRenderer();
    this.particles = new ParticleSystem();

    // Auto-detect quality on mobile + set default zoom
    if (this.isMobile) {
      this.quality = 'medium';
      this.camera.setZoom(1.15); // Closer zoom for better visibility on small screens
    }

    // Pre-create fog gradient canvas
    this.createFogGradientCanvas();

    // Pre-create film grain canvas
    this.createGrainCanvas();

    // Pre-create bloom canvases (1/4 resolution)
    this.createBloomCanvases();
  }

  private createBloomCanvases(): void {
    const bw = Math.max(32, Math.floor(this.logicalWidth * BLOOM_SCALE));
    const bh = Math.max(24, Math.floor(this.logicalHeight * BLOOM_SCALE));
    this.bloomA = document.createElement('canvas');
    this.bloomA.width = bw; this.bloomA.height = bh;
    const a = this.bloomA.getContext('2d', { alpha: true });
    if (!a) return;
    this.bloomACtx = a;
    this.bloomB = document.createElement('canvas');
    this.bloomB.width = bw; this.bloomB.height = bh;
    const b = this.bloomB.getContext('2d', { alpha: true });
    if (!b) return;
    this.bloomBCtx = b;
  }

  /** Render bloom post-processing: bright-pass extract + 2-pass Gaussian blur + screen composite */
  private renderBloom(ctx: CanvasRenderingContext2D, sourceCanvas: HTMLCanvasElement, strength: number): void {
    if (!this.bloomA || !this.bloomACtx || !this.bloomB || !this.bloomBCtx) return;
    if (strength <= 0) return;

    const bw = this.bloomA.width;
    const bh = this.bloomA.height;
    const a = this.bloomACtx;
    const b = this.bloomBCtx;

    // 1. Downsample source to bloomA
    a.globalCompositeOperation = 'source-over';
    a.globalAlpha = 1;
    a.clearRect(0, 0, bw, bh);
    a.drawImage(sourceCanvas, 0, 0, bw, bh);

    // 2. Bright-pass: darken non-bright areas. Use 'multiply' with a dark grey to crush mid-tones, keep bright.
    a.globalCompositeOperation = 'multiply';
    a.globalAlpha = 1;
    a.fillStyle = '#2b2b2b'; // threshold — lower = more bleed, higher = only very bright
    a.fillRect(0, 0, bw, bh);
    a.globalCompositeOperation = 'source-over';

    // 3. Horizontal blur (bloomA → bloomB) — use filter blur for performance on Canvas 2D
    b.clearRect(0, 0, bw, bh);
    b.filter = 'blur(2px)';
    b.drawImage(this.bloomA, 0, 0);
    b.filter = 'none';

    // 4. Vertical blur (bloomB → bloomA) — cheap second pass (approx gaussian)
    a.clearRect(0, 0, bw, bh);
    a.filter = 'blur(3px)';
    a.drawImage(this.bloomB, 0, 0);
    a.filter = 'none';

    // 5. Composite back with additive-like 'screen' for glow
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = strength;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.bloomA, 0, 0, this.logicalWidth, this.logicalHeight);
    ctx.restore();
  }

  /** Apply color grading tint — boss rooms and themed floors get atmospheric shift */
  private renderColorGrade(ctx: CanvasRenderingContext2D, floor: number, inBossRoom: boolean): void {
    ctx.save();
    // The tiles themselves now carry each floor's palette, so this pass is only a
    // light unifying wash. It used to be the ONLY per-floor differentiation, and at
    // full strength on top of themed tiles it just muddied them.
    const theme = floorTheme(floor);
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = theme.light;
    ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);
    // Boss-room warm/danger overlay on top
    if (inBossRoom) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);
    }
    ctx.restore();
  }

  /** Get the camera instance (for external zoom control, etc.) */
  get cameraInstance(): Camera {
    return this.camera;
  }

  /** Get current quality level */
  get qualityLevel(): QualityLevel {
    return this.quality;
  }

  /** Manually set quality */
  /**
   * Accessibility toggles. Screen shake and full-screen flashes are the two
   * effects most likely to cause trouble (motion sickness, photosensitivity), so
   * both are user-controllable rather than baked in.
   */
  setAccessibility(opts: {
    screenShake: number;
    screenFlash: boolean;
    ambientEffects: boolean;
    highContrastTelegraph?: boolean;
  }): void {
    this.shakeScale = Math.max(0, Math.min(1, opts.screenShake));
    this.camera.setShakeMultiplier(this.shakeScale);
    this.flashEnabled = opts.screenFlash;
    this.ambientEnabled = opts.ambientEffects;
    this.highContrastTelegraph = opts.highContrastTelegraph ?? false;
  }

  /** Manual aim angle in radians, or null when the server is auto-targeting. */
  setAimAngle(angle: number | null): void {
    this.aimAngle = angle;
  }

  setQuality(level: QualityLevel): void {
    this.quality = level;
    const preset = QUALITY_PRESETS[level];
    this.particles.setMaxParticles(preset.particleMax);
  }

  /** Add a floating damage number */
  addDamageNumber(x: number, y: number, amount: number, isHealing: boolean, kind?: DamageNumberKind): void {
    if (this.damageNumbers.length >= MAX_DAMAGE_NUMBERS) {
      // Find oldest (lowest life) and overwrite it — O(n) scan but avoids O(n) shift
      let oldestIdx = 0;
      let oldestLife = this.damageNumbers[0].life;
      for (let i = 1; i < this.damageNumbers.length; i++) {
        if (this.damageNumbers[i].life < oldestLife) {
          oldestLife = this.damageNumbers[i].life;
          oldestIdx = i;
        }
      }
      // Remove oldest by swap-with-last
      this.damageNumbers[oldestIdx] = this.damageNumbers[this.damageNumbers.length - 1];
      this.damageNumbers.pop();
    }

    // Always round to integer for clean display
    const rounded = Math.round(amount);
    if (rounded === 0) return;

    const resolvedKind: DamageNumberKind = kind ?? (isHealing ? 'heal' : 'damage');
    const palette = DMG_COLOR[resolvedKind];

    // Merge window: if a fresh number of same kind is very close, add to its value
    // (reduces clutter on rapid hits while keeping visual feedback)
    const mergeAge = DAMAGE_NUMBER_DURATION - DMG_MERGE_WINDOW;
    for (let i = 0; i < this.damageNumbers.length; i++) {
      const dn = this.damageNumbers[i];
      if (dn.kind !== resolvedKind) continue;
      if (dn.life < mergeAge) continue;
      const dx = Math.abs(dn.x - x);
      const dy = Math.abs(dn.y - y);
      if (dx < DMG_MERGE_RADIUS && dy < DMG_MERGE_RADIUS) {
        dn.rawValue += rounded;
        dn.text = `${palette.prefix}${dn.rawValue}${palette.suffix}`;
        dn.life = DAMAGE_NUMBER_DURATION; // refresh
        dn.mergeBumpTimer = 1;            // trigger bump
        return;
      }
    }

    const scale = resolvedKind === 'critical' ? 1.45 : resolvedKind === 'holy' || resolvedKind === 'fire' ? 1.1 : 1;
    const text = `${palette.prefix}${rounded}${palette.suffix}`;

    // Stack nearby (different kind) numbers: offset Y
    for (let i = 0; i < this.damageNumbers.length; i++) {
      const dn = this.damageNumbers[i];
      const dx = Math.abs(dn.x - x);
      const dy = Math.abs(dn.y - y);
      if (dx < 8 && dy < 8 && dn.life > dn.maxLife * 0.7) {
        y -= 6;
      }
    }

    this.damageNumbers.push({
      x,
      y,
      vy: resolvedKind === 'critical' ? -55 : -42,
      text,
      rawValue: rounded,
      color: palette.color,
      glow: palette.glow,
      life: DAMAGE_NUMBER_DURATION,
      maxLife: DAMAGE_NUMBER_DURATION,
      kind: resolvedKind,
      scale,
      shake: resolvedKind === 'critical' ? 1.2 : 0,
      mergeBumpTimer: 0,
    });
  }

  /** Queue server-side damage metadata to be used on next HP change detection */
  queueDamageMeta(targetId: string, meta: { isCrit?: boolean; isHeal?: boolean; damageType?: DamageType; kx?: number; ky?: number; shake?: number; value?: number }): void {
    this.pendingDamageMeta.set(targetId, { ...meta, _ts: performance.now() });
  }

  /** Consume a server-side damage event (richer metadata than HP delta detection) */
  consumeDamageEvent(
    targetWx: number,
    targetWy: number,
    amount: number,
    meta: { isCrit?: boolean; isHeal?: boolean; damageType?: DamageType; shake?: number; kx?: number; ky?: number },
    isLocalPlayer: boolean,
  ): void {
    // Resolve kind: heal > crit > damageType > plain damage
    let kind: DamageNumberKind;
    if (meta.isHeal) kind = 'heal';
    else if (meta.isCrit) kind = 'critical';
    else if (meta.damageType === 'fire') kind = 'fire';
    else if (meta.damageType === 'ice') kind = 'ice';
    else if (meta.damageType === 'poison') kind = 'poison';
    else if (meta.damageType === 'holy') kind = 'holy';
    else kind = 'damage';

    this.addDamageNumber(targetWx, targetWy, amount, !!meta.isHeal, kind);

    const preset = QUALITY_PRESETS[this.quality];
    if (!preset.particles) return;

    // Elemental particles per type
    this.elementalHitCount++;
    const marks = this.elementalHitCount % 3 === 0;
    switch (meta.damageType) {
      case 'fire':
        this.particles.emitFireTrail(targetWx, targetWy);
        if (marks) this.addScorch(targetWx, targetWy, 0.8);
        break;
      case 'ice':
        this.particles.emitIceStorm(targetWx, targetWy);
        if (marks) this.addFrost(targetWx, targetWy, 0.9);
        break;
      case 'poison':
        this.particles.emitPoisonCloud(targetWx, targetWy);
        break;
      case 'holy':
        this.particles.emitHealEffect(targetWx, targetWy);
        break;
    }

    // Crit = extra sparkle + shake
    if (meta.isCrit) {
      this.particles.emitCriticalHit(targetWx, targetWy);
      this.camera.shakeCrit();
      if (isLocalPlayer) {
        this.triggerScreenFlash('#fbbf24', 0.2);
      }
    }

    // Strong hit feedback: shake intensity from metadata
    const shake = meta.shake ?? 0;
    if (shake > 0) {
      // Scale 0..1 → amplitude 1..7, duration 80..350
      this.camera.shake(1 + shake * 6, 80 + shake * 270);
      if (isLocalPlayer && shake > 0.7) {
        this.freezeFrame(60);
      }
    }
  }

  /** Access the particle system for external effects */
  get particleSystem(): ParticleSystem {
    return this.particles;
  }

  /** Trigger camera shake */
  shake(intensity: number, duration: number): void {
    if (this.shakeScale <= 0) return;
    this.camera.shake(intensity, duration);
  }

  /** Trigger a freeze frame (hitstop) for the given duration in ms */
  public freezeFrame(durationMs: number): void {
    this.freezeFrameMs = Math.max(this.freezeFrameMs, durationMs);
  }

  /** Trigger a screen flash (white flash on big damage, etc.) */
  triggerScreenFlash(color = '#ffffff', intensity = 0.6): void {
    if (!this.flashEnabled) return;
    this.screenFlashAlpha = intensity;
    this.screenFlashColor = color;
  }

  /** Trigger an ultimate activation burst at player position — class-colored flash + particles */
  triggerUltimateBurst(wx: number, wy: number, kind: string, playerClass: string): void {
    const classColor: Record<string, string> = {
      warrior: '#ef4444',
      mage: '#a78bfa',
      archer: '#22c55e',
      healer: '#fde68a',
    };
    const color = classColor[playerClass] ?? '#ffffff';

    // Softened from 0.55 → 0.28 for eye comfort
    this.triggerScreenFlash(color, 0.28);
    this.freezeFrame(110);
    this.camera.shake(4, 300);
    this.particles.emitCriticalHit(wx, wy);
    this.particles.emitLevelUp(wx, wy); // reuse — rune+star burst

    // Kind-specific extra particles
    switch (kind) {
      case 'berserker_rush':
        this.particles.emitBossSlam(wx, wy);
        break;
      case 'arcane_nova':
        this.particles.emitIceStorm(wx, wy);
        this.particles.emitBurnFlare(wx, wy);
        this.particles.emitPoisonCloud(wx, wy);
        break;
      case 'piercing_volley':
        this.particles.emitBossSlam(wx, wy);
        break;
      case 'divine_intervention':
        this.particles.emitHealSparkles(wx, wy);
        break;
    }
  }

  /** Trigger boss phase transition visual — red flash + enrage particles at boss */
  triggerBossPhase(wx: number, wy: number, phase: number): void {
    // Softened from 0.55 → 0.3
    this.triggerScreenFlash('#dc2626', 0.3);
    this.freezeFrame(130);
    this.camera.shakeBossSlam();
    this.particles.emitBossSlam(wx, wy);
    this.particles.emitBurnFlare(wx, wy);
    if (phase >= 3) {
      // Final enrage — extra dramatic but still softened
      this.particles.emitDeathSoul(wx, wy, '#dc2626');
      this.particles.emitCriticalHit(wx, wy);
    }
  }

  /** Resize the output canvas */
  resize(_w: number, _h: number): void {
    this.resizeCanvas();
  }

  /** Main render method -- call each frame */
  render(state: GameState, localPlayerId: string, externalDt?: number): void {
    const now = performance.now();

    // FPS cap based on quality
    const minFrameTime = 1000 / QUALITY_PRESETS[this.quality].fpsCap;
    if (now - this.lastFrameTime < minFrameTime) return;
    this.lastFrameTime = now;

    const nowSec = now / 1000;
    const dt = externalDt ?? (this.lastTime === 0 ? 1 / 60 : Math.min(nowSec - this.lastTime, 0.1));
    this.lastTime = nowSec;

    // Track frame time for auto-quality
    const frameStart = now;

    // Update vision radius based on darkness modifier
    let hasDarkness = false;
    const mods = state.currentFloorModifiers;
    if (mods) {
      for (let i = 0; i < mods.length; i++) {
        if (mods[i].id === 'darkness') { hasDarkness = true; break; }
      }
    }
    this.currentVisionRadius = hasDarkness ? VISION_RADIUS_DARKNESS : VISION_RADIUS;

    // Cache Object.values() once per frame to avoid repeated array allocations
    const monstersArr = Object.values(state.monsters);
    const playersArr = Object.values(state.players);
    const lootArr = Object.values(state.loot);
    const projectilesArr = Object.values(state.projectiles);

    // Hitstop freeze frame
    if (this.freezeFrameMs > 0) {
      this.freezeFrameMs -= dt * 1000;
      if (this.freezeFrameMs > 0) {
        // Still render particles and effects but skip world update
        const preset = QUALITY_PRESETS[this.quality];
        if (preset.particles) {
          this.particles.update(dt);
        }
        // Continue to draw the frozen frame
      }
    }

    // Update animation frame (8 fps for pixel art)
    this.animTimer += dt;
    if (this.animTimer >= 0.125) {
      this.animTimer -= 0.125;
      this.animFrame++;
    }

    // Resize canvas to fill container
    this.resizeCanvas();

    const preset = QUALITY_PRESETS[this.quality];
    const localPlayer = state.players[localPlayerId];

    // Update camera to follow local player
    if (localPlayer) {
      this.camera.follow(localPlayer.position, localPlayer.facing);
      this.camera.setFacing(localPlayer.facing);
      if (this.firstRender) {
        this.camera.snapToTarget();
        this.firstRender = false;
      }
    }

    // Boss room detection
    const isBossPhase = state.phase === 'boss';
    if (isBossPhase && !this.wasBossPhase) {
      this.camera.enterBossRoom();
      // Boss entrance: red flash + screen shake
      this.bossEntranceFlash = 0.5;
      this.bossEntranceShake = true;
      this.camera.shake(6, 400);
      if (QUALITY_PRESETS[this.quality].particles) {
        this.particles.emitBossEntrance(this.logicalWidth, this.logicalHeight);
      }
    } else if (!isBossPhase && this.wasBossPhase) {
      this.camera.leaveBossRoom();
    }
    this.wasBossPhase = isBossPhase;

    // Update dungeon bounds
    this.camera.setBounds(state.dungeon.width, state.dungeon.height);
    this.camera.update(dt);

    // Update particles
    if (preset.particles) {
      this.particles.update(dt);

      // Spawn ambient dust particles (more frequent)
      this.dustSpawnTimer += dt;
      if (this.dustSpawnTimer >= 0.3) {
        this.dustSpawnTimer -= 0.3;
        const camX = this.camera.scrollX;
        const camY = this.camera.scrollY;
        this.particles.emitDustAmbient(camX, camY, this.logicalWidth, this.logicalHeight);

        // Occasional water drip in explored rooms
        if (Math.random() < 0.15) {
          const dripX = camX + Math.random() * this.logicalWidth;
          const dripY = camY + Math.random() * this.logicalHeight * 0.3;
          this.particles.emitDrip(dripX, dripY);
        }

        // Floor-themed ambient particle bursts (subtle, every 300ms)
        const floor = state.dungeon.currentFloor;
        const fx = camX + Math.random() * this.logicalWidth;
        const fy = camY + Math.random() * this.logicalHeight;
        if (floor === 5 && Math.random() < 0.6) {
          // Spider queen floor — violet gas wisps
          this.particles.emitPoisonCloud(fx, fy);
        } else if (floor === 8 && Math.random() < 0.5) {
          // Lava floor — upward-drifting embers
          this.particles.emitBurnFlare(fx, fy);
        } else if (floor === 9 && Math.random() < 0.4) {
          // Spirits floor — cold blue shimmer
          this.particles.emitFreezeShatter(fx, fy);
        } else if (floor === 10 && Math.random() < 0.5) {
          // Throne — downward drifting ash (reuse dust with gravity)
          this.particles.emitDrip(fx, fy - 40);
        }
      }

      // Boss aura particles
      if (isBossPhase) {
        for (let i = 0; i < monstersArr.length; i++) {
          const m = monstersArr[i];
          if (m.type === 'boss_demon' && m.alive) {
            const wx = m.position.x * TILE_SIZE + TILE_SIZE;
            const wy = m.position.y * TILE_SIZE + TILE_SIZE;
            this.particles.emitBossAura(wx, wy);
          }
        }
      }

      // Torch flame particles
      this.updateTorchParticles(state);

      // Projectile trail particles
      this.emitProjectileTrails(projectilesArr);
    }

    // Decay screen flash
    if (this.screenFlashAlpha > 0) {
      this.screenFlashAlpha = Math.max(0, this.screenFlashAlpha - dt * 6); // ~0.1s decay
    }

    // Decay boss entrance flash
    if (this.bossEntranceFlash > 0) {
      this.bossEntranceFlash = Math.max(0, this.bossEntranceFlash - dt * 3);
    }

    // Decay loot flash
    if (this.lootFlashAlpha > 0) {
      this.lootFlashAlpha = Math.max(0, this.lootFlashAlpha - dt * 4);
    }

    // Build environmental decorations (deterministic, only rebuilds on floor change)
    this.buildEnvironmentalDecor(state);

    // Check particle system screen flash request
    if (this.particles.screenFlashRequested) {
      this.particles.screenFlashRequested = false;
      // Subtle white micro-flash from hit sparks
      if (this.screenFlashAlpha < 0.1) {
        this.triggerScreenFlash('#ffffff', 0.15);
      }
    }

    // Detect HP changes for flash effects + damage numbers
    this.detectHpChanges(state, localPlayerId, playersArr, monstersArr);
    this.detectStateTransitions(playersArr, monstersArr, localPlayerId);

    // Update fog of war
    this.updateFog(state, localPlayerId, playersArr);

    // Update damage numbers
    this.updateDamageNumbers(dt);

    // --- Draw to offscreen at logical resolution ---
    const ctx = this.offCtx;
    ctx.imageSmoothingEnabled = false;

    // Apply zoom
    const zoom = this.camera.zoom;
    ctx.save();
    if (zoom !== 1) {
      const cx = this.logicalWidth / 2;
      const cy = this.logicalHeight / 2;
      ctx.translate(cx, cy);
      ctx.scale(zoom, zoom);
      ctx.translate(-cx, -cy);
    }

    // Clear
    ctx.fillStyle = '#000000';
    ctx.fillRect(
      -this.logicalWidth, -this.logicalHeight,
      this.logicalWidth * 3, this.logicalHeight * 3,
    );

    const camX = this.camera.scrollX;
    const camY = this.camera.scrollY;

    // Calculate visible tile range
    const effectiveW = this.logicalWidth / zoom;
    const effectiveH = this.logicalHeight / zoom;
    const startTileX = Math.max(0, Math.floor(camX / TILE_SIZE) - 1);
    const startTileY = Math.max(0, Math.floor(camY / TILE_SIZE) - 1);
    const endTileX = Math.min(state.dungeon.width, Math.ceil((camX + effectiveW) / TILE_SIZE) + 1);
    const endTileY = Math.min(state.dungeon.height, Math.ceil((camY + effectiveH) / TILE_SIZE) + 1);

    // 1. Render tiles
    this.renderTiles(ctx, state, camX, camY, startTileX, startTileY, endTileX, endTileY);

    // 2. Render environmental decorations (blood, bones, cobwebs, cracks, water)
    if (preset.effects) {
      this.renderEnvironmentalDecor(ctx, camX, camY, dt);
    }

    // 2b. Ground marks left by the fight. Under the torch glow, so a scorch in a
    // lit corner reads as lit, and under every entity.
    this.decals.update(dt);
    this.decals.render(ctx, camX, camY, this.logicalWidth / zoom, this.logicalHeight / zoom);

    // 2c. Render torch light sources on floor (additive glow on top)
    if (preset.effects) {
      this.renderTorchLights(ctx, camX, camY);
    }

    // 3. Highlight interactable tiles (chests, stairs) with pulsing glow
    this.renderInteractableHighlights(ctx, state, camX, camY, localPlayerId);

    // 4b. Attack telegraphs — drawn on the ground, under every entity, so an
    // incoming attack is readable even in a crowded room.
    this.renderTelegraphs(ctx, monstersArr, camX, camY);

    // 5. Render loot
    this.renderLoot(ctx, lootArr, camX, camY);

    // 6. Render monsters
    this.renderMonsters(ctx, monstersArr, camX, camY, dt);

    // 7. Render projectiles
    this.renderProjectiles(ctx, projectilesArr, camX, camY);

    // 8. Render players
    this.renderPlayers(ctx, playersArr, state, camX, camY, localPlayerId, dt);

    // 8c. Fog of war, now drawn OVER the entities.
    //
    // It used to run before them, with a comment saying entities "stay bright" —
    // but that meant every monster on the floor was visible at full brightness
    // through solid walls, in rooms the player had never entered. Occluding them
    // is both the correct read and a real gameplay change: scouting now requires
    // actually going there. Particles, damage numbers and UI still draw on top.
    this.renderFog(ctx, state, camX, camY, startTileX, startTileY, endTileX, endTileY, localPlayerId, playersArr);

    // 8b. Aim reticle + the enemy the shot will actually snap to. Without this the
    // player has no way to know whether manual aim or auto-target is in control.
    this.renderAimIndicator(ctx, playersArr, monstersArr, localPlayerId, camX, camY);

    // 9. Render particles
    if (preset.particles) {
      this.particles.render(ctx, camX, camY, this.logicalWidth, this.logicalHeight);
    }

    // 9b. Dying entity squash+spin animations (on top of particles)
    this.updateAndRenderDyingEntities(ctx, camX, camY, dt);

    // 10. Render damage numbers
    this.renderDamageNumbers(ctx, camX, camY);

    // Pop the zoom transform here — everything past this point is screen-space.
    // These passes all fillRect(0, 0, logicalW, logicalH); under the boss zoom of
    // 0.85 that covered only ~85% of the screen and left raw, ungraded borders.
    ctx.restore();

    // 10b. Boss health bar at top of screen
    if (isBossPhase) {
      this.drawBossHealthBar(ctx, monstersArr);
    }

    // 10c. Bloom post-processing — subtle glow for premium feel (before vignette/grain)
    if (preset.bloom > 0) {
      this.renderBloom(ctx, this.offscreen, preset.bloom);
    }

    // 10d. Color grading — floor theme + boss tint
    if (preset.colorGrade) {
      this.renderColorGrade(ctx, state.dungeon.currentFloor, isBossPhase);
    }

    // 11. Post-processing effects (drawn on top of everything)
    if (preset.effects) {
      // Low HP — gentler pulsing red vignette (reduced from 0.4 → 0.25 max)
      if (localPlayer && localPlayer.alive) {
        const hpRatio = localPlayer.hp / localPlayer.maxHp;
        if (hpRatio < 0.25) {
          this.lowHpPulseTimer += dt * 2.5;
          const pulse = 0.5 + Math.sin(this.lowHpPulseTimer) * 0.5;
          const baseIntensity = (1 - hpRatio / 0.25) * 0.25;
          const intensity = baseIntensity * (0.6 + pulse * 0.4);
          this.renderRedVignette(ctx, intensity);
        } else if (hpRatio < 0.5) {
          // Subtle warning between 25-50% (reduced)
          this.lowHpPulseTimer += dt * 1.5;
          const pulse = 0.5 + Math.sin(this.lowHpPulseTimer) * 0.5;
          const baseIntensity = (1 - hpRatio / 0.5) * 0.08;
          this.renderRedVignette(ctx, baseIntensity * (0.7 + pulse * 0.3));
        } else {
          this.lowHpPulseTimer = 0;
        }
      }

      // Boss room dramatic lighting (subtle red tint without excessive darkening)
      if (isBossPhase) {
        ctx.globalAlpha = 0.06;
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);
        ctx.globalAlpha = 0.04;
        ctx.fillStyle = '#7f1d1d';
        ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);
        ctx.globalAlpha = 1;

        // Heat distortion effect (subtle wave via shifting scanlines)
        if (this.ambientEnabled) this.renderHeatDistortion(ctx, nowSec);
      }

      // Vignette effect
      if (isBossPhase) {
        this.renderVignette(ctx, 0.18);
      } else {
        this.renderVignette(ctx, 0.04);
      }

      // Subtle film grain overlay
      if (this.ambientEnabled) this.renderFilmGrain(ctx, dt);
    }

    // Screen flash overlay
    if (this.screenFlashAlpha > 0.01) {
      ctx.globalAlpha = this.screenFlashAlpha;
      ctx.fillStyle = this.screenFlashColor;
      ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);
      ctx.globalAlpha = 1;
    }

    // Boss entrance red flash
    if (this.flashEnabled && this.bossEntranceFlash > 0.01) {
      ctx.globalAlpha = this.bossEntranceFlash * 0.4;
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);
      ctx.globalAlpha = 1;
    }

    // Loot pickup flash
    if (this.flashEnabled && this.lootFlashAlpha > 0.01) {
      ctx.globalAlpha = this.lootFlashAlpha;
      ctx.fillStyle = this.lootFlashColor;
      ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);
      ctx.globalAlpha = 1;
    }

    // --- Scale offscreen to main canvas ---
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.drawImage(this.offscreen, 0, 0, this.canvas.width, this.canvas.height);

    // Clean up stale entity positions every ~60 frames (prevent memory leak, skip hot path)
    if (++this.entityCleanupCounter >= 60) {
      this.entityCleanupCounter = 0;
      for (const id of this.prevEntityPositions.keys()) {
        if (!state.monsters[id] && !state.players[id]) {
          this.prevEntityPositions.delete(id);
        }
      }
      for (const id of this.prevHp.keys()) {
        if (!state.monsters[id] && !state.players[id]) {
          this.prevHp.delete(id);
        }
      }
    }

    // Auto-quality adjustment
    const frameTime = performance.now() - frameStart;
    this.monitorPerformance(frameTime);
  }

  // ===== VISUAL EFFECTS =====

  /** Render dark vignette (dark corners) — uses cached offscreen canvas */
  private renderVignette(ctx: CanvasRenderingContext2D, intensity: number): void {
    // Build cache once (intensity is always 0.4 in normal use)
    if (!this.vignetteCanvas) {
      const w = this.logicalWidth;
      const h = this.logicalHeight;
      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.max(cx, cy);
      this.vignetteCanvas = document.createElement('canvas');
      this.vignetteCanvas.width = w;
      this.vignetteCanvas.height = h;
      const vCtx = this.vignetteCanvas.getContext('2d');
      if (vCtx) {
        const gradient = vCtx.createRadialGradient(cx, cy, radius * 0.4, cx, cy, radius * 1.2);
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(1, 'rgba(0,0,0,1)');
        vCtx.fillStyle = gradient;
        vCtx.fillRect(0, 0, w, h);
      }
    }
    ctx.globalAlpha = intensity;
    ctx.drawImage(this.vignetteCanvas, 0, 0);
    ctx.globalAlpha = 1;
  }

  /** Render pulsing red vignette for low HP — cached canvas, intensity via globalAlpha */
  private renderRedVignette(ctx: CanvasRenderingContext2D, intensity: number): void {
    // Rebuild red vignette cache only when needed (shape is fixed, intensity changes)
    if (!this.redVignetteCanvas) {
      const w = this.logicalWidth;
      const h = this.logicalHeight;
      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.max(cx, cy);
      this.redVignetteCanvas = document.createElement('canvas');
      this.redVignetteCanvas.width = w;
      this.redVignetteCanvas.height = h;
      const rCtx = this.redVignetteCanvas.getContext('2d');
      if (rCtx) {
        const gradient = rCtx.createRadialGradient(cx, cy, radius * 0.3, cx, cy, radius * 1.1);
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(0.5, 'rgba(127,29,29,0)');
        gradient.addColorStop(1, 'rgba(220,38,38,1)');
        rCtx.fillStyle = gradient;
        rCtx.fillRect(0, 0, w, h);
      }
    }
    ctx.globalAlpha = intensity;
    ctx.drawImage(this.redVignetteCanvas, 0, 0);
    ctx.globalAlpha = 1;
  }

  /** Render subtle film grain noise overlay */
  private renderFilmGrain(ctx: CanvasRenderingContext2D, dt: number): void {
    if (!this.grainCanvas) return;
    this.grainPhase += dt;
    // Cycle grain every ~0.1s by shifting the source
    if (this.grainPhase > 0.1) {
      this.grainPhase -= 0.1;
      this.createGrainCanvas(); // regenerate noise
    }
    ctx.globalAlpha = 0.015; // very subtle
    ctx.drawImage(this.grainCanvas, 0, 0, this.logicalWidth, this.logicalHeight);
    ctx.globalAlpha = 1;
  }

  /** Create grain noise canvas pool (pre-generate multiple frames to avoid per-frame createImageData) */
  private createGrainCanvas(): void {
    const size = 64;
    const GRAIN_POOL_SIZE = 8;

    // Only build pool once
    if (this.grainCanvases.length === 0) {
      for (let f = 0; f < GRAIN_POOL_SIZE; f++) {
        const c = document.createElement('canvas');
        c.width = size;
        c.height = size;
        const gCtx = c.getContext('2d');
        if (!gCtx) continue;
        const imageData = gCtx.createImageData(size, size);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          const v = Math.random() * 255;
          data[i] = v;
          data[i + 1] = v;
          data[i + 2] = v;
          data[i + 3] = 255;
        }
        gCtx.putImageData(imageData, 0, 0);
        this.grainCanvases.push(c);
      }
    }

    // Cycle to next pre-generated canvas (O(1), no allocation)
    this.grainIndex = (this.grainIndex + 1) % this.grainCanvases.length;
    this.grainCanvas = this.grainCanvases[this.grainIndex];
  }

  /** Render heat distortion for boss room (subtle horizontal scanline shift) */
  private renderHeatDistortion(ctx: CanvasRenderingContext2D, time: number): void {
    // Very subtle: shift a few scanlines horizontally by 1px based on sine wave
    // Step size adapts to quality: fewer drawImage calls on lower quality
    const w = this.logicalWidth;
    const h = this.logicalHeight;
    const step = this.quality === 'high' ? 6 : 10;
    ctx.globalAlpha = 0.04;
    for (let y = 0; y < h; y += step) {
      const shift = Math.sin(time * 2 + y * 0.15) * 1.5;
      ctx.drawImage(this.offscreen, 0, y, w, 3, shift, y, w, 3);
    }
    ctx.globalAlpha = 1;
  }

  // ===== ENVIRONMENTAL DECORATIONS =====

  /** Public: add blood splatter when a monster dies (call from game logic) */
  /**
   * Ground mark where something died. `color` is the monster's own colour, so a
   * slime leaves green and a skeleton leaves bone dust.
   */
  addBloodSplatter(worldX: number, worldY: number, color = '#7f1d1d', scale = 1): void {
    this.decals.spawn(worldX, worldY, DECAL_BLOOD, scale, color);
  }

  /** Burn mark — fire damage, explosions, lava. */
  addScorch(worldX: number, worldY: number, scale = 1): void {
    this.decals.spawn(worldX, worldY, DECAL_SCORCH, scale);
  }

  /** Frost patch — freeze effects. Thaws faster than the other marks. */
  addFrost(worldX: number, worldY: number, scale = 1): void {
    this.decals.spawn(worldX, worldY, DECAL_FROST, scale);
  }

  /** Impact pit — boss slams and heavy landings. */
  addCrater(worldX: number, worldY: number, scale = 1): void {
    this.decals.spawn(worldX, worldY, DECAL_CRATER, scale);
  }

  /** Trigger loot pickup screen flash */
  /**
   * Sparkle burst where loot was picked up. emitGoldPickup and emitLootPickup were
   * authored and never called — pickups only ever got a full-screen colour flash,
   * with nothing happening at the actual pickup point.
   */
  /**
   * Burst at a room's doorways when its seal lifts. Rooms lock during combat, and
   * nothing told the player when they had opened again — emitDoorOpen was written
   * for this and never called.
   */
  emitRoomUnlock(room: { x: number; y: number; width: number; height: number }): void {
    if (!QUALITY_PRESETS[this.quality].particles) return;
    const cx = (room.x + room.width / 2) * TILE_SIZE;
    const midY = (room.y + room.height / 2) * TILE_SIZE;
    this.particles.emitDoorOpen(room.x * TILE_SIZE, midY);
    this.particles.emitDoorOpen((room.x + room.width) * TILE_SIZE, midY);
    this.particles.emitDoorOpen(cx, room.y * TILE_SIZE);
  }

  emitPickupBurst(worldX: number, worldY: number, lootType: string): void {
    if (!QUALITY_PRESETS[this.quality].particles) return;
    const x = worldX * TILE_SIZE + TILE_SIZE / 2;
    const y = worldY * TILE_SIZE + TILE_SIZE / 2;
    if (lootType === 'gold') this.particles.emitGoldPickup(x, y);
    else this.particles.emitLootPickup(x, y);
  }

  triggerLootFlash(color: string): void {
    this.lootFlashAlpha = 0.25;
    this.lootFlashColor = color;
  }

  /** Clear all decorations (called on floor change) */
  clearDecorations(): void {
    this.decals.clear();
    this.boneFragments = [];
    this.cobwebPositions = [];
    this.floorCracks = [];
  }

  /** Build environmental decorations for the current floor layout */
  /** Burst when the party arrives on a new floor. */
  private emitFloorArrival(state: GameState, players: PlayerState[]): void {
    if (!QUALITY_PRESETS[this.quality].particles) return;
    for (let i = 0; i < players.length; i++) {
      if (!players[i].alive) continue;
      this.particles.emitFloorTransition(
        players[i].position.x * TILE_SIZE + TILE_SIZE / 2,
        players[i].position.y * TILE_SIZE + TILE_SIZE / 2,
      );
    }
  }

  private buildEnvironmentalDecor(state: GameState): void {
    const floorId = state.dungeon.currentFloor ?? 0;
    if (this.decorCacheFloor === floorId) return;
    const isFloorChange = this.decorCacheFloor !== -1;
    this.decorCacheFloor = floorId;
    if (isFloorChange) this.emitFloorArrival(state, Object.values(state.players));
    this.clearDecorations();

    const tiles = state.dungeon.tiles;
    const dw = state.dungeon.width;
    const dh = state.dungeon.height;

    // Generate bone fragments in rooms (2-3 per room)
    for (const room of state.dungeon.rooms) {
      const boneCount = 2 + Math.floor(this.tileHash(room.id, 777) % 2);
      for (let b = 0; b < boneCount; b++) {
        const seed = this.tileHash(room.id * 10 + b, 1234);
        const rx = room.x + 1 + (seed % Math.max(1, room.width - 2));
        const ry = room.y + 1 + ((seed >> 8) % Math.max(1, room.height - 2));
        if (rx < dw && ry < dh && tiles[ry] && tiles[ry][rx] === 'floor') {
          this.boneFragments.push({ x: rx * TILE_SIZE + (seed % 10), y: ry * TILE_SIZE + ((seed >> 4) % 10), seed });
        }
      }
    }

    // Find cobweb corners (where 2+ walls meet in L-shape)
    for (let ty = 1; ty < dh - 1; ty++) {
      const row = tiles[ty];
      if (!row) continue;
      for (let tx = 1; tx < dw - 1; tx++) {
        if (row[tx] !== 'floor') continue;
        const above = tiles[ty - 1]?.[tx] === 'wall';
        const below = tiles[ty + 1]?.[tx] === 'wall';
        const left = row[tx - 1] === 'wall';
        const right = row[tx + 1] === 'wall';

        // Only add cobwebs at some corners (hash-based so it's deterministic)
        const h = this.tileHash(tx * 13, ty * 29);
        if (h % 5 !== 0) continue;

        if (above && left) this.cobwebPositions.push({ x: tx * TILE_SIZE, y: ty * TILE_SIZE, corner: 0 });
        else if (above && right) this.cobwebPositions.push({ x: tx * TILE_SIZE + TILE_SIZE, y: ty * TILE_SIZE, corner: 1 });
        else if (below && left) this.cobwebPositions.push({ x: tx * TILE_SIZE, y: ty * TILE_SIZE + TILE_SIZE, corner: 2 });
        else if (below && right) this.cobwebPositions.push({ x: tx * TILE_SIZE + TILE_SIZE, y: ty * TILE_SIZE + TILE_SIZE, corner: 3 });
      }
    }

    // Floor cracks near boss room
    const bossRoom = state.dungeon.rooms.find(r => r.isBossRoom);
    if (bossRoom) {
      for (let i = 0; i < 6; i++) {
        const seed = this.tileHash(i * 37, 5555);
        const cx = bossRoom.x + (seed % bossRoom.width);
        const cy = bossRoom.y + ((seed >> 8) % bossRoom.height);
        if (cx < dw && cy < dh) {
          this.floorCracks.push({ x: cx * TILE_SIZE, y: cy * TILE_SIZE, seed });
        }
      }
    }
  }

  /** Render environmental decorations (blood, bones, cobwebs, cracks, water drips) */
  private renderEnvironmentalDecor(ctx: CanvasRenderingContext2D, camX: number, camY: number, dt: number): void {
    // Bone fragments (tiny white/gray pixels)
    for (let i = 0; i < this.boneFragments.length; i++) {
      const bone = this.boneFragments[i];
      const sx = Math.floor(bone.x - camX);
      const sy = Math.floor(bone.y - camY);
      if (sx < -4 || sx > this.logicalWidth + 4 || sy < -4 || sy > this.logicalHeight + 4) continue;

      ctx.globalAlpha = 0.35;
      ctx.fillStyle = (bone.seed % 2 === 0) ? '#d6d3d1' : '#a8a29e';
      ctx.fillRect(sx, sy, 2, 1);
      ctx.fillRect(sx + 1, sy + 1, 1, 1);
      ctx.globalAlpha = 1;
    }

    // Cobwebs in corners
    for (let i = 0; i < this.cobwebPositions.length; i++) {
      const cw = this.cobwebPositions[i];
      const sx = Math.floor(cw.x - camX);
      const sy = Math.floor(cw.y - camY);
      if (sx < -8 || sx > this.logicalWidth + 8 || sy < -8 || sy > this.logicalHeight + 8) continue;

      ctx.globalAlpha = 0.2;
      ctx.fillStyle = '#d1d5db';
      // Draw small L-shaped web based on corner
      switch (cw.corner) {
        case 0: // top-left
          ctx.fillRect(sx, sy, 4, 1);
          ctx.fillRect(sx, sy + 1, 1, 3);
          ctx.fillRect(sx + 1, sy + 1, 1, 1);
          break;
        case 1: // top-right
          ctx.fillRect(sx - 4, sy, 4, 1);
          ctx.fillRect(sx - 1, sy + 1, 1, 3);
          ctx.fillRect(sx - 2, sy + 1, 1, 1);
          break;
        case 2: // bottom-left
          ctx.fillRect(sx, sy - 1, 4, 1);
          ctx.fillRect(sx, sy - 4, 1, 3);
          ctx.fillRect(sx + 1, sy - 2, 1, 1);
          break;
        case 3: // bottom-right
          ctx.fillRect(sx - 4, sy - 1, 4, 1);
          ctx.fillRect(sx - 1, sy - 4, 1, 3);
          ctx.fillRect(sx - 2, sy - 2, 1, 1);
          break;
      }
      ctx.globalAlpha = 1;
    }

    // Floor cracks near boss room
    for (let i = 0; i < this.floorCracks.length; i++) {
      const crack = this.floorCracks[i];
      const sx = Math.floor(crack.x - camX);
      const sy = Math.floor(crack.y - camY);
      if (sx < -16 || sx > this.logicalWidth + 16 || sy < -16 || sy > this.logicalHeight + 16) continue;

      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#1c1917';
      // Crack pattern based on seed
      const s = crack.seed;
      ctx.fillRect(sx + (s % 5), sy + ((s >> 3) % 5), 3, 1);
      ctx.fillRect(sx + (s % 5) + 1, sy + ((s >> 3) % 5) + 1, 1, 2);
      ctx.fillRect(sx + (s % 5) + 2, sy + ((s >> 3) % 5) + 2, 2, 1);
      ctx.globalAlpha = 1;
    }

    // Water drips (periodic 1px blue drops from ceiling)
    this.waterDripTimer += dt;
    if (this.waterDripTimer > 0.4) {
      this.waterDripTimer -= 0.4;
      // Random drip position near camera
      if (Math.random() < 0.3) {
        const dripX = camX + Math.random() * this.logicalWidth;
        const dripY = camY + Math.random() * this.logicalHeight * 0.15;
        this.particles.emitWaterDrip(dripX, dripY);
      }
    }
  }

  /** Render warm light circles at torch positions with animated flame sprites */
  private renderTorchLights(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
    // Update torch flame animation (cycle 3 patterns at ~6fps)
    this.torchFlameTimer += 1;
    if (this.torchFlameTimer >= 2) {
      this.torchFlameTimer = 0;
      this.torchFlameFrame = (this.torchFlameFrame + 1) % 3;
    }

    const preset = QUALITY_PRESETS[this.quality];
    const flickerEnabled = preset.torchFlicker;

    for (let i = 0; i < this.torchPositions.length; i++) {
      const torch = this.torchPositions[i];
      const sx = torch.x - camX;
      const sy = torch.y - camY;

      // Skip off-screen torches
      if (sx < -30 || sx > this.logicalWidth + 30 || sy < -30 || sy > this.logicalHeight + 30) continue;

      // Warm-colored light circle — use cached torch light canvas
      const lightRadius = 30;
      // Organic flicker from multi-octave noise table, per-torch phase offset
      let flicker: number;
      if (flickerEnabled) {
        const lookupIdx = (this.animFrame + i * 7) % this.torchFlicker.length;
        const noise = this.torchFlicker[lookupIdx]; // range ~[-1, 1]
        flicker = 1 + noise * 0.18; // ±18% radius variation
      } else {
        flicker = 1 + Math.sin(this.animFrame * 0.7 + i * 1.3) * 0.1;
      }
      const r = lightRadius * flicker;
      if (!this._torchLightCanvas) {
        this._torchLightCanvas = document.createElement('canvas');
        const tlSize = 64;
        this._torchLightCanvas.width = tlSize;
        this._torchLightCanvas.height = tlSize;
        const tlCtx = this._torchLightCanvas.getContext('2d');
        if (tlCtx) {
          const gr = tlCtx.createRadialGradient(tlSize / 2, tlSize / 2, 0, tlSize / 2, tlSize / 2, tlSize / 2);
          // Warmer hot core, cooler fall-off for more depth
          gr.addColorStop(0, 'rgba(255,215,140,0.38)');
          gr.addColorStop(0.15, 'rgba(255,180,90,0.26)');
          gr.addColorStop(0.38, 'rgba(255,130,55,0.13)');
          gr.addColorStop(0.65, 'rgba(235,90,30,0.045)');
          gr.addColorStop(1, 'rgba(180,60,15,0)');
          tlCtx.fillStyle = gr;
          tlCtx.fillRect(0, 0, tlSize, tlSize);
        }
      }
      // Alpha pulse with flicker — slightly dim during low-flicker phase
      const alphaPulse = flickerEnabled ? (0.88 + (flicker - 1) * 1.2) : 1;
      ctx.globalAlpha = Math.max(0.5, Math.min(1.1, alphaPulse));
      ctx.drawImage(this._torchLightCanvas, sx - r, sy - r, r * 2, r * 2);
      ctx.globalAlpha = 1;

      // Enhanced flame sprite (5x7px, animated 3 patterns). Sits on the bracket that
      // drawWallTorch painted — the old -8 offset floated it clear of the tile.
      this.drawEnhancedFlame(ctx, Math.floor(sx) - 2, Math.floor(sy) - 4, this.torchFlameFrame, i);

      // Heat haze above the flame. Previously mid-grey (#6b7280) at 0.2-0.3 alpha,
      // which read as solid grey streaks smeared up the wall rather than smoke —
      // a warm, much fainter tone dissipating with height reads as rising heat.
      const smokeAlpha = 0.09 + Math.sin(this.animFrame * 0.5 + i * 2) * 0.04;
      ctx.fillStyle = '#8a7a6a';
      ctx.globalAlpha = smokeAlpha;
      ctx.fillRect(Math.floor(sx) + (this.torchFlameFrame % 2), Math.floor(sy) - 7, 1, 1);
      ctx.globalAlpha = smokeAlpha * 0.6;
      ctx.fillRect(Math.floor(sx) - 1 + ((this.torchFlameFrame + 1) % 2), Math.floor(sy) - 9, 1, 1);
      ctx.globalAlpha = 1;

      // Occasional torch spark particle during bright flicker peaks
      if (flickerEnabled && preset.particles && flicker > 1.12 && (this.animFrame + i * 11) % 7 === 0) {
        this.particles.emitTorchSpark(torch.x, torch.y - 8);
      }
    }
  }

  /** Draw an enhanced flame sprite (5x8px) with 3 animation frames */
  private drawEnhancedFlame(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number, seed: number): void {
    // Core white (hottest center)
    // Mid yellow
    // Outer orange
    // Tip red
    switch (frame) {
      case 0:
        // Tall narrow flame
        ctx.fillStyle = '#ef4444'; // Red tip
        ctx.fillRect(x + 1, y, 3, 2);
        ctx.fillStyle = '#f97316'; // Orange outer
        ctx.fillRect(x + 1, y + 2, 3, 2);
        ctx.fillStyle = '#fbbf24'; // Yellow mid
        ctx.fillRect(x + 1, y + 4, 3, 2);
        ctx.fillStyle = '#fef3c7'; // White core
        ctx.fillRect(x + 2, y + 3, 1, 3);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 2, y + 5, 1, 2);
        break;
      case 1:
        // Wide swaying flame
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(x, y + 1, 2, 1);
        ctx.fillRect(x + 3, y, 2, 1);
        ctx.fillStyle = '#f97316';
        ctx.fillRect(x, y + 2, 5, 2);
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(x + 1, y + 4, 3, 2);
        ctx.fillStyle = '#fef3c7';
        ctx.fillRect(x + 2, y + 4, 1, 2);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 2, y + 5, 1, 2);
        break;
      case 2:
        // Flickering split flame
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(x + 1, y, 1, 2);
        ctx.fillRect(x + 3, y, 1, 2);
        ctx.fillStyle = '#f97316';
        ctx.fillRect(x, y + 2, 5, 2);
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(x + 1, y + 4, 3, 2);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 2, y + 4, 1, 3);
        break;
    }
  }

  /** Emit trail particles for active projectiles */
  private emitProjectileTrails(projectiles: ProjectileState[]): void {
    for (let i = 0; i < projectiles.length; i++) {
      const proj = projectiles[i];
      const wx = proj.position.x * TILE_SIZE;
      const wy = proj.position.y * TILE_SIZE;

      if (proj.type === 'arrow') {
        this.particles.emitArrowTrail(wx, wy);
      } else if (proj.type === 'fireball') {
        this.particles.emitFireTrail(wx, wy);
      }
    }
  }

  /** Update torch particle effects */
  private updateTorchParticles(state: GameState): void {
    // Rebuild torch positions cache every few ticks
    if (state.tick !== this.torchCacheTick) {
      this.torchCacheTick = state.tick;
      this.rebuildTorchCache(state);
    }

    // Emit torch flame particles (only for visible torches, throttled)
    if (this.animFrame % 2 === 0) {
      const camX = this.camera.scrollX;
      const camY = this.camera.scrollY;
      for (let i = 0; i < this.torchPositions.length; i++) {
        const torch = this.torchPositions[i];
        const sx = torch.x - camX;
        const sy = torch.y - camY;
        if (sx >= -16 && sx <= this.logicalWidth + 16 && sy >= -16 && sy <= this.logicalHeight + 16) {
          this.particles.emitTorchFlame(torch.x, torch.y);
        }
      }
    }
  }

  /** Scan visible wall tiles for torch positions (uses tileHash like SpriteRenderer) */
  private rebuildTorchCache(state: GameState): void {
    this.torchPositions = [];
    const tiles = state.dungeon.tiles;
    const camX = this.camera.scrollX;
    const camY = this.camera.scrollY;
    const startX = Math.max(0, Math.floor(camX / TILE_SIZE) - 2);
    const startY = Math.max(0, Math.floor(camY / TILE_SIZE) - 2);
    const endX = Math.min(state.dungeon.width, Math.ceil((camX + this.logicalWidth) / TILE_SIZE) + 2);
    const endY = Math.min(state.dungeon.height, Math.ceil((camY + this.logicalHeight) / TILE_SIZE) + 2);

    for (let ty = startY; ty < endY; ty++) {
      const row = tiles[ty];
      if (!row) continue;
      for (let tx = startX; tx < endX; tx++) {
        if (row[tx] !== 'wall') continue;
        // Placement comes from SpriteRenderer so lights can never drift away from the
        // painted torches (this used to re-derive it with a different modulo).
        if (isTorchWall(tx, ty)) {
          this.torchPositions.push({
            x: tx * TILE_SIZE + TORCH_ANCHOR_X,
            y: ty * TILE_SIZE + TORCH_ANCHOR_Y,
          });
        }
      }
    }
  }

  /** Simple position hash (matches SpriteRenderer) */
  private tileHash(tx: number, ty: number): number {
    let h = tx * 374761393 + ty * 668265263;
    h = (h ^ (h >> 13)) * 1274126177;
    return (h ^ (h >> 16)) & 0x7fffffff;
  }

  /** Create pre-rendered fog gradient canvas */
  private createFogGradientCanvas(): void {
    const size = TILE_SIZE * 3; // gradient extends beyond tile
    this.fogGradientCanvas = document.createElement('canvas');
    this.fogGradientCanvas.width = size;
    this.fogGradientCanvas.height = size;
    const fCtx = this.fogGradientCanvas.getContext('2d');
    if (!fCtx) return;

    const cx = size / 2;
    const cy = size / 2;
    const gradient = fCtx.createRadialGradient(cx, cy, 0, cx, cy, size / 2);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(0.6, 'rgba(0,0,0,0.15)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.5)');
    fCtx.fillStyle = gradient;
    fCtx.fillRect(0, 0, size, size);
  }

  private resizeCanvas(): void {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const w = parent.clientWidth;
    const h = parent.clientHeight;

    if (this.isMobile) {
      const dpr = Math.min(this.devicePixelRatio, 2);
      const newW = Math.floor(w * dpr);
      const newH = Math.floor(h * dpr);
      if (this.canvas.width !== newW || this.canvas.height !== newH) {
        this.canvas.width = newW;
        this.canvas.height = newH;
        this.canvas.style.width = `${w}px`;
        this.canvas.style.height = `${h}px`;
      }
    } else {
      const newW = w;
      const newH = h;
      if (this.canvas.width !== newW || this.canvas.height !== newH) {
        this.canvas.width = newW;
        this.canvas.height = newH;
        this.canvas.style.width = `${newW}px`;
        this.canvas.style.height = `${newH}px`;
      }
    }
  }

  private monitorPerformance(frameTimeMs: number): void {
    // Circular buffer for frame times — avoids shift() which is O(n)
    if (this.frameTimes.length < PERF_SAMPLE_COUNT) {
      this.frameTimes.push(frameTimeMs);
    } else {
      this.frameTimes[this._perfWriteIdx % PERF_SAMPLE_COUNT] = frameTimeMs;
    }
    this._perfWriteIdx++;

    const now = performance.now();
    if (now - this.lastPerfCheck < PERF_CHECK_INTERVAL) return;
    this.lastPerfCheck = now;

    if (this.frameTimes.length < PERF_SAMPLE_COUNT) return;

    let sum = 0;
    for (let i = 0; i < this.frameTimes.length; i++) sum += this.frameTimes[i];
    const avg = sum / this.frameTimes.length;

    // Adaptive quality — quick downgrade on jank, slow upgrade on stable perf
    // High → Medium: avg > 22ms (~45fps sustained)
    // Medium → Low: avg > 33ms (~30fps sustained)
    // Low → Medium: avg < 18ms (~55fps stable)
    // Medium → High: avg < 11ms (~90fps stable — only on powerful hardware)
    if (avg > 22 && this.quality === 'high') {
      this.setQuality('medium');
      this.goodSamples = 0;
    } else if (avg > 33 && this.quality === 'medium') {
      this.setQuality('low');
      this.goodSamples = 0;
    } else if (avg < 11 && this.quality === 'medium') {
      this.goodSamples++;
      if (this.goodSamples >= 3) { // require 3 good checks before upgrading
        this.setQuality('high');
        this.goodSamples = 0;
      }
    } else if (avg < 18 && this.quality === 'low') {
      this.goodSamples++;
      if (this.goodSamples >= 2) {
        this.setQuality('medium');
        this.goodSamples = 0;
      }
    } else {
      this.goodSamples = 0;
    }
  }

  private goodSamples = 0;

  private renderTiles(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    camX: number,
    camY: number,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
  ): void {
    const tiles = state.dungeon.tiles;
    // Palette follows the floor. setFloorTheme is a no-op unless the floor actually
    // changed, and it clears the tile cache so nothing carries over between themes.
    this.sprites.setFloorTheme(state.dungeon.currentFloor);
    // Check if current room is cleared (avoid .find() per frame)
    const rooms = state.dungeon.rooms;
    let roomCleared = false;
    for (let i = 0; i < rooms.length; i++) {
      if (rooms[i].id === state.currentRoomId) {
        roomCleared = rooms[i].cleared;
        break;
      }
    }

    for (let ty = startY; ty < endY; ty++) {
      const row = tiles[ty];
      if (!row) continue;
      for (let tx = startX; tx < endX; tx++) {
        const tile = row[tx];
        if (tile === undefined || tile === 'void') continue;

        const sx = tx * TILE_SIZE - camX;
        const sy = ty * TILE_SIZE - camY;

        this.sprites.drawTile(
          ctx, sx, sy, tile as TileType, roomCleared, tx, ty,
          tiles, state.dungeon.width, state.dungeon.height,
          this.animFrame,
        );
      }
    }
  }

  /**
   * Draw the aim reticle and highlight the enemy the attack will resolve against.
   * Mirrors the server's snap tolerance so what is highlighted is what gets hit.
   */
  private renderAimIndicator(
    ctx: CanvasRenderingContext2D,
    players: PlayerState[],
    monsters: MonsterState[],
    localPlayerId: string,
    camX: number,
    camY: number,
  ): void {
    if (this.aimAngle === null) return;
    let me: PlayerState | null = null;
    for (let i = 0; i < players.length; i++) {
      if (players[i].id === localPlayerId) { me = players[i]; break; }
    }
    if (!me || !me.alive) return;

    const range = CLASS_STATS[me.class].attackRange;
    const ax = Math.cos(this.aimAngle);
    const ay = Math.sin(this.aimAngle);
    const px0 = me.position.x * TILE_SIZE - camX;
    const py0 = me.position.y * TILE_SIZE - camY;

    // Find the monster the server would snap onto (same 35° tolerance).
    let lockX = 0;
    let lockY = 0;
    let lockSize = 0;
    let bestDot = AIM_SNAP_COS;
    const maxDist = range * 1.5;
    for (let i = 0; i < monsters.length; i++) {
      const m = monsters[i];
      if (!m.alive) continue;
      const dx = m.position.x - me.position.x;
      const dy = m.position.y - me.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > maxDist || dist < 0.01) continue;
      const dot = (dx / dist) * ax + (dy / dist) * ay;
      if (dot > bestDot) {
        bestDot = dot;
        lockX = m.position.x * TILE_SIZE - camX;
        lockY = m.position.y * TILE_SIZE - camY;
        lockSize = TILE_SIZE * MONSTER_STATS[m.type].size;
      }
    }

    ctx.save();
    // Aim line — short dashed guide from the player toward the cursor.
    const lineLen = Math.min(range, 4) * TILE_SIZE;
    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(Math.round(px0 + ax * 6), Math.round(py0 + ay * 6));
    ctx.lineTo(Math.round(px0 + ax * lineLen), Math.round(py0 + ay * lineLen));
    ctx.stroke();
    ctx.setLineDash([]);

    if (lockSize > 0) {
      // Locked target — corner brackets, which read better than a full box at 16px.
      const h = lockSize / 2 + 2;
      const cx = Math.round(lockX);
      const cy = Math.round(lockY);
      const b = 3;
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = '#fbbf24';
      ctx.beginPath();
      ctx.moveTo(cx - h, cy - h + b); ctx.lineTo(cx - h, cy - h); ctx.lineTo(cx - h + b, cy - h);
      ctx.moveTo(cx + h - b, cy - h); ctx.lineTo(cx + h, cy - h); ctx.lineTo(cx + h, cy - h + b);
      ctx.moveTo(cx - h, cy + h - b); ctx.lineTo(cx - h, cy + h); ctx.lineTo(cx - h + b, cy + h);
      ctx.moveTo(cx + h - b, cy + h); ctx.lineTo(cx + h, cy + h); ctx.lineTo(cx + h, cy + h - b);
      ctx.stroke();
    } else {
      // Free aim — small crosshair at the end of the guide.
      const rx = Math.round(px0 + ax * lineLen);
      const ry = Math.round(py0 + ay * lineLen);
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(rx - 3, ry, 2, 1);
      ctx.fillRect(rx + 2, ry, 2, 1);
      ctx.fillRect(rx, ry - 3, 1, 2);
      ctx.fillRect(rx, ry + 2, 1, 2);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  /**
   * Draw ground danger indicators for monsters currently winding up.
   *
   * The shape shown is exactly the shape the server will test at resolution time,
   * so "step outside the red" is a promise the game actually keeps. Fill opacity
   * tracks windup progress, and the outline snaps bright right before impact.
   */
  private renderTelegraphs(
    ctx: CanvasRenderingContext2D,
    monsters: MonsterState[],
    camX: number,
    camY: number,
  ): void {
    for (let i = 0; i < monsters.length; i++) {
      const m = monsters[i];
      if (!m.alive || m.telegraphKind === TELEGRAPH_NONE) continue;
      if (!this.camera.isVisible(m.position.x * TILE_SIZE, m.position.y * TILE_SIZE, 128, 128)) continue;

      const sx = Math.round(m.position.x * TILE_SIZE - camX);
      const sy = Math.round(m.position.y * TILE_SIZE - camY);
      const r = m.telegraphRadius * TILE_SIZE;
      const p = Math.max(0, Math.min(1, m.attackProgress));
      // Ramp hard at the end so the last ~20% reads as "now".
      const imminent = p > 0.8;
      const fillAlpha = 0.10 + p * 0.22;
      const edgeAlpha = imminent ? 0.95 : 0.45 + p * 0.35;
      // Red on dark stone is the hardest pairing for red-green colour blindness,
      // and this is the one colour in the game the player must read to survive.
      // The alternative is a blue/amber pair, which stays separable on every
      // common type of colour vision deficiency.
      const color = this.highContrastTelegraph
        ? (imminent ? '#fde047' : '#38bdf8')
        : (imminent ? '#fca5a5' : '#ef4444');

      ctx.save();
      if (m.telegraphKind === TELEGRAPH_CONE) {
        const angle = Math.atan2(m.telegraphDirY, m.telegraphDirX);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.arc(sx, sy, r, angle - m.telegraphArc, angle + m.telegraphArc);
        ctx.closePath();
        ctx.globalAlpha = fillAlpha;
        ctx.fillStyle = color;
        ctx.fill();
        ctx.globalAlpha = edgeAlpha;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.stroke();
      } else if (m.telegraphKind === TELEGRAPH_LINE) {
        const angle = Math.atan2(m.telegraphDirY, m.telegraphDirX);
        const halfW = Math.max(2, m.telegraphArc * TILE_SIZE);
        ctx.translate(sx, sy);
        ctx.rotate(angle);
        ctx.globalAlpha = fillAlpha;
        ctx.fillStyle = color;
        ctx.fillRect(0, -halfW, r, halfW * 2);
        ctx.globalAlpha = edgeAlpha;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.strokeRect(0, -halfW, r, halfW * 2);
      } else {
        // Circle — the ring fills inward as the windup completes.
        ctx.globalAlpha = fillAlpha;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();
        // Inner disc grows to meet the outline at the moment of impact.
        ctx.globalAlpha = fillAlpha + 0.18;
        ctx.beginPath();
        ctx.arc(sx, sy, r * p, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = edgeAlpha;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  private renderInteractableHighlights(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    camX: number,
    camY: number,
    localPlayerId: string,
  ): void {
    const localPlayer = state.players[localPlayerId];
    if (!localPlayer?.alive) return;

    const tiles = state.dungeon.tiles;
    const ppx = localPlayer.position.x;
    const ppy = localPlayer.position.y;
    const HIGHLIGHT_RADIUS = 5; // Show glow within 5 tiles

    const startX = Math.max(0, Math.floor(ppx - HIGHLIGHT_RADIUS));
    const endX = Math.min(state.dungeon.width - 1, Math.floor(ppx + HIGHLIGHT_RADIUS));
    const startY = Math.max(0, Math.floor(ppy - HIGHLIGHT_RADIUS));
    const endY = Math.min(state.dungeon.height - 1, Math.floor(ppy + HIGHLIGHT_RADIUS));

    const pulse = 0.25 + Math.sin(this.animFrame * 0.3) * 0.15;

    for (let ty = startY; ty <= endY; ty++) {
      const row = tiles[ty];
      if (!row) continue;
      for (let tx = startX; tx <= endX; tx++) {
        const tile = row[tx];
        if (tile !== 'chest' && tile !== 'stairs') continue;

        const dx = ppx - (tx + 0.5);
        const dy = ppy - (ty + 0.5);
        const distSq = dx * dx + dy * dy;
        if (distSq > HIGHLIGHT_RADIUS * HIGHLIGHT_RADIUS) continue;

        const sx = tx * TILE_SIZE - camX;
        const sy = ty * TILE_SIZE - camY;

        // Distance-based alpha falloff (sqrt only for visible interactables — few per frame)
        const dist = Math.sqrt(distSq);
        const distAlpha = 1 - (dist / HIGHLIGHT_RADIUS);
        const alpha = pulse * distAlpha;

        const isChest = tile === 'chest';
        const glowColor = isChest ? '#fbbf24' : '#38bdf8';

        // Outer glow
        ctx.globalAlpha = alpha * 0.6;
        ctx.fillStyle = glowColor;
        ctx.fillRect(sx - 4, sy - 4, TILE_SIZE + 8, TILE_SIZE + 8);

        // Inner glow border
        ctx.globalAlpha = alpha * 0.9;
        ctx.strokeStyle = glowColor;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(sx - 0.5, sy - 0.5, TILE_SIZE + 1, TILE_SIZE + 1);

        ctx.globalAlpha = 1;
      }
    }
  }

  private renderLoot(
    ctx: CanvasRenderingContext2D,
    lootEntries: LootState[],
    camX: number,
    camY: number,
  ): void {
    const preset = QUALITY_PRESETS[this.quality];
    for (let i = 0; i < lootEntries.length; i++) {
      const loot: LootState = lootEntries[i];
      const wx = loot.position.x * TILE_SIZE;
      const wy = loot.position.y * TILE_SIZE;
      if (!this.camera.isVisible(wx, wy, TILE_SIZE, TILE_SIZE)) continue;
      this.sprites.drawLoot(ctx, wx - camX, wy - camY, loot.type, this.animFrame);

      // Floating label above loot for clarity
      const lootInfo = LOOT_TABLE[loot.type];
      if (lootInfo) {
        const labelX = Math.floor(wx - camX + TILE_SIZE / 2);
        const labelY = Math.floor(wy - camY - 4);
        const bobY = Math.sin(this.animFrame * 0.15 + i * 1.5) * 1.5;

        ctx.save();
        const lootW = measurePixelText(lootInfo.label);
        drawPixelTextOutlined(
          ctx,
          labelX - lootW / 2,
          labelY + bobY - PIXEL_FONT_HEIGHT,
          lootInfo.label,
          lootInfo.color,
        );
        ctx.restore();
      }

      // Loot glow particle (throttled: 1 per loot every 4 anim frames)
      if (preset.particles && this.animFrame % 4 === i % 4) {
        const lootColor = lootInfo?.color ?? '#fbbf24';
        this.particles.emitLootGlow(wx + TILE_SIZE / 2, wy, lootColor);
      }
    }
  }

  private renderMonsters(
    ctx: CanvasRenderingContext2D,
    monsters: MonsterState[],
    camX: number,
    camY: number,
    dt: number,
  ): void {
    const isFrozen = this.freezeFrameMs > 0;
    const preset = QUALITY_PRESETS[this.quality];
    for (let i = 0; i < monsters.length; i++) {
      const monster: MonsterState = monsters[i];
      if (!monster.alive) continue;

      // Smooth position interpolation (skip during freeze frame)
      const prevMonPos = this.prevEntityPositions.get(monster.id);
      let monRenderX: number;
      let monRenderY: number;
      if (isFrozen && prevMonPos) {
        monRenderX = prevMonPos.x;
        monRenderY = prevMonPos.y;
      } else {
        const targetX = monster.position.x;
        const targetY = monster.position.y;
        if (prevMonPos) {
          // dt-aware exponential smoothing: 1 - (1-base)^(dt*60)
          const t = 1 - Math.pow(0.35, dt * 60);
          monRenderX = prevMonPos.x + (targetX - prevMonPos.x) * t;
          monRenderY = prevMonPos.y + (targetY - prevMonPos.y) * t;
          prevMonPos.x = monRenderX;
          prevMonPos.y = monRenderY;
        } else {
          monRenderX = targetX;
          monRenderY = targetY;
          this.prevEntityPositions.set(monster.id, { x: targetX, y: targetY });
        }
      }

      const wx = monRenderX * TILE_SIZE;
      const wy = monRenderY * TILE_SIZE;
      const stats = MONSTER_STATS[monster.type];
      const renderSize = TILE_SIZE * stats.size;

      if (!this.camera.isVisible(wx, wy, renderSize, renderSize)) continue;

      const sx = Math.floor(wx - camX);
      const sy = Math.floor(wy - camY);

      const prevHp = this.prevHp.get(monster.id);
      const flashWhite = prevHp !== undefined && prevHp > monster.hp;

      // Attack pose now comes from authoritative server state instead of the old
      // "has a target and is barely moving" guess, which fired on any monster that
      // happened to pause and never fired for one that attacked while closing.
      const isAttacking = monster.attackPhase === 'active' || monster.attackPhase === 'recovery';
      const isWindingUp = monster.attackPhase === 'windup';

      // Elite glow, tinted by affix so the threat is identifiable before it acts —
      // a vampiric elite and a volatile one demand very different play.
      if (monster.isElite) {
        const affixColor = monster.eliteAffix
          ? (ELITE_AFFIXES[monster.eliteAffix]?.color ?? '#fbbf24')
          : '#fbbf24';
        const glowAlpha = 0.3 + Math.sin(this.animFrame * 0.15) * 0.15;
        ctx.save();
        ctx.globalAlpha = glowAlpha;
        ctx.shadowColor = affixColor;
        ctx.shadowBlur = 12;
        ctx.fillStyle = 'rgba(251, 191, 36, 0.15)';
        ctx.beginPath();
        ctx.arc(sx + renderSize / 2, sy + renderSize / 2, renderSize * 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Dynamic shadow source (high quality only)
      if (preset.shadowDynamic) {
        const wcx = monster.position.x * TILE_SIZE + TILE_SIZE / 2;
        const wcy = monster.position.y * TILE_SIZE + TILE_SIZE / 2;
        this.sprites.setCurrentLightSource(this.computeNearestTorchLight(wcx, wcy));
      } else {
        this.sprites.setCurrentLightSource(null);
      }

      // Hit squash: if hitStopTicks > 0 apply temporary scale pulse (compressed vertically)
      const hitStopT = (monster.hitStopTicks ?? 0) / 4; // 0..1 where 1 = fresh hit
      // Windup anticipation: the sprite coils — rears back and compresses — so the
      // incoming attack reads on the monster itself, not only from the ground
      // telegraph. Classic squash-and-stretch anticipation.
      const windupT = isWindingUp ? Math.max(0, Math.min(1, monster.attackProgress)) : 0;
      // Lean into the knockback direction. The state has carried knockbackVx/Vy
      // since the hit-feel work but nothing ever visualised it, so a hit had no
      // directional read on the sprite itself.
      const kbx = monster.knockbackVx ?? 0;
      const kby = monster.knockbackVy ?? 0;
      const kbMag = Math.min(1, (Math.abs(kbx) + Math.abs(kby)) / 6);
      const applyHitSquash = hitStopT > 0 || windupT > 0 || kbMag > 0.01;
      if (applyHitSquash) {
        const sq = (1 - hitStopT * 0.15) * (1 - windupT * 0.12);
        const st = (1 + hitStopT * 0.1) * (1 + windupT * 0.14);
        const cx = sx + renderSize / 2;
        const cy = sy + renderSize;
        ctx.save();
        ctx.translate(cx, cy);
        // Lean away from the target during the coil, then the attack snaps forward.
        if (windupT > 0) {
          ctx.translate(-monster.telegraphDirX * windupT * 2, -monster.telegraphDirY * windupT * 2);
        }
        if (kbMag > 0.01) {
          ctx.translate(kbx * 0.35, kby * 0.35);
          ctx.rotate(kbx * 0.02);
        }
        ctx.scale(st, sq);
        ctx.translate(-cx, -cy);
      }
      this.sprites.drawMonster(
        ctx, sx, sy, monster.type, monster.facing, this.animFrame,
        flashWhite, isAttacking, monster.isElite,
        monster.shieldActive, monster.phased, monster.enraged,
        monster.burnTicks ?? 0,
        monster.freezeTicks ?? 0,
        monster.poisonTicks ?? 0,
        isEntityMoving(monster.velocity),
      );
      if (applyHitSquash) ctx.restore();

      // Elite crown indicator above sprite
      if (monster.isElite && !flashWhite) {
        ctx.save();
        ctx.fillStyle = '#fbbf24';
        ctx.font = `${Math.max(8, Math.floor(renderSize * 0.35))}px serif`;
        ctx.textAlign = 'center';
        ctx.fillText('♛', sx + renderSize / 2, sy - 2);
        ctx.restore();
      }

      // Monster-specific particle effects (throttled)
      if (monster.type === 'mushroom' && this.animFrame % 6 === 0) {
        this.particles.emitPoisonCloud(sx + renderSize / 2, sy + renderSize * 0.3);
      } else if (monster.type === 'spider' && this.animFrame % 4 === 0) {
        this.particles.emitSpiderLegs(sx + renderSize / 2, sy + renderSize);
      }

      if (monster.hp < monster.maxHp && !monster.type.startsWith('boss_')) {
        this.drawHealthBar(ctx, sx, sy - 3, Math.floor(renderSize), monster.hp, monster.maxHp, monster.id);
      }
    }
  }

  private renderProjectiles(
    ctx: CanvasRenderingContext2D,
    projectiles: ProjectileState[],
    camX: number,
    camY: number,
  ): void {
    for (let i = 0; i < projectiles.length; i++) {
      const proj: ProjectileState = projectiles[i];
      const wx = proj.position.x * TILE_SIZE;
      const wy = proj.position.y * TILE_SIZE;
      if (!this.camera.isVisible(wx - 8, wy - 8, 16, 16)) continue;

      const sx = Math.floor(wx - camX);
      const sy = Math.floor(wy - camY);

      const dirX = proj.direction?.x ?? proj.velocity.x;
      const dirY = proj.direction?.y ?? proj.velocity.y;

      // Trail effect (skip on low quality)
      if (this.quality !== 'low') {
        ctx.globalAlpha = 0.3;
        this.sprites.drawProjectile(
          ctx,
          sx - Math.floor(proj.velocity.x * 0.05),
          sy - Math.floor(proj.velocity.y * 0.05),
          proj.type,
          this.animFrame,
          proj.velocity.x,
          proj.velocity.y,
          dirX,
          dirY,
        );
        ctx.globalAlpha = 1;
      }

      this.sprites.drawProjectile(ctx, sx, sy, proj.type, this.animFrame, proj.velocity.x, proj.velocity.y, dirX, dirY);
    }
  }

  /**
   * Marker over a downed teammate, plus the revive channel's progress.
   *
   * The ring fills as an ally holds interact and drains when they step away, so
   * the whole party can read whether the rescue is actually happening.
   */
  private renderDownedMarker(
    ctx: CanvasRenderingContext2D, player: PlayerState, camX: number, camY: number,
  ): void {
    const wx = player.position.x * TILE_SIZE;
    const wy = player.position.y * TILE_SIZE;
    if (!this.camera.isVisible(wx, wy, TILE_SIZE, TILE_SIZE)) return;

    const cx = Math.floor(wx - camX) + TILE_SIZE / 2;
    const cy = Math.floor(wy - camY) + TILE_SIZE / 2;
    const pulse = 0.5 + Math.sin(this.animFrame * 0.35) * 0.2;
    const progress = player.reviveProgress ?? 0;

    ctx.save();
    // Body on the ground.
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#4b5563';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 3, 7, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Base ring: always visible, so the downed ally reads at a glance.
    ctx.globalAlpha = progress > 0 ? 0.35 : pulse * 0.7;
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 10, 0, Math.PI * 2);
    ctx.stroke();

    // Channel progress, sweeping clockwise from the top.
    if (progress > 0) {
      ctx.globalAlpha = 0.95;
      ctx.strokeStyle = '#4ade80';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 10, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;

    // Centred by hand — the font helper draws from the left edge.
    const label = player.name;
    const w = measurePixelText(label, 1);
    drawPixelTextOutlined(ctx, Math.round(cx - w / 2), Math.round(cy - 20), label, '#fca5a5', 1);
  }

  private renderPlayers(
    ctx: CanvasRenderingContext2D,
    players: PlayerState[],
    state: GameState,
    camX: number,
    camY: number,
    localPlayerId: string,
    dt: number,
  ): void {
    const isFrozen = this.freezeFrameMs > 0;
    for (let i = 0; i < players.length; i++) {
      const player: PlayerState = players[i];
      if (!player.alive) {
        // A downed ally is still worth drawing something for: without a marker
        // there is nothing on screen to walk towards, and no way to tell that
        // holding interact is doing anything.
        this.renderDownedMarker(ctx, player, camX, camY);
        continue;
      }

      // Smooth position interpolation (skip during freeze frame)
      const prevPlrPos = this.prevEntityPositions.get(player.id);
      let plrRenderX: number;
      let plrRenderY: number;
      if (isFrozen && prevPlrPos) {
        plrRenderX = prevPlrPos.x;
        plrRenderY = prevPlrPos.y;
      } else {
        const targetX = player.position.x;
        const targetY = player.position.y;
        if (prevPlrPos) {
          const t = 1 - Math.pow(0.35, dt * 60);
          plrRenderX = prevPlrPos.x + (targetX - prevPlrPos.x) * t;
          plrRenderY = prevPlrPos.y + (targetY - prevPlrPos.y) * t;
          prevPlrPos.x = plrRenderX;
          prevPlrPos.y = plrRenderY;
        } else {
          plrRenderX = targetX;
          plrRenderY = targetY;
          this.prevEntityPositions.set(player.id, { x: targetX, y: targetY });
        }
      }

      const wx = plrRenderX * TILE_SIZE;
      const wy = plrRenderY * TILE_SIZE;
      if (!this.camera.isVisible(wx, wy, TILE_SIZE, TILE_SIZE)) continue;

      const sx = Math.floor(wx - camX);
      const sy = Math.floor(wy - camY);

      const prevHp = this.prevHp.get(player.id);
      const flashWhite = prevHp !== undefined && prevHp > player.hp;

      // Local player pulsing ground indicator (bright golden circle)
      if (player.id === localPlayerId) {
        const indicatorPulse = 0.15 + Math.sin(this.animFrame * 0.2) * 0.06;
        ctx.globalAlpha = indicatorPulse;
        ctx.beginPath();
        ctx.arc(sx + TILE_SIZE / 2, sy + TILE_SIZE - 1, 7, 0, Math.PI * 2);
        ctx.fillStyle = '#fbbf24';
        ctx.fill();
        // Thin ring for extra visibility
        ctx.globalAlpha = indicatorPulse * 1.5;
        ctx.beginPath();
        ctx.arc(sx + TILE_SIZE / 2, sy + TILE_SIZE - 1, 7, 0, Math.PI * 2);
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 0.5;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Footstep dust particles when player is moving
      const isMoving = Math.abs(player.velocity.x) + Math.abs(player.velocity.y) > 0.02;
      if (isMoving && QUALITY_PRESETS[this.quality].particles && this.animFrame % 3 === 0) {
        this.particles.emitFootstepDust(wx + TILE_SIZE / 2, wy + TILE_SIZE);
      }

      // Ice storm ground circle for mage ability
      if (player.abilityActive && player.class === 'mage') {
        const cx = sx + TILE_SIZE / 2;
        const cy = sy + TILE_SIZE / 2;
        const iceRadius = 48; // ~3 tiles
        const pulse = 1 + Math.sin(this.animFrame * 0.6) * 0.08;
        ctx.globalAlpha = 0.12;
        ctx.beginPath();
        ctx.arc(cx, cy, iceRadius * pulse, 0, Math.PI * 2);
        ctx.fillStyle = '#3b82f6';
        ctx.fill();
        ctx.globalAlpha = 0.2;
        ctx.beginPath();
        ctx.arc(cx, cy, iceRadius * 0.6 * pulse, 0, Math.PI * 2);
        ctx.fillStyle = '#93c5fd';
        ctx.fill();
        ctx.globalAlpha = 1;
        this.particles.emitIceStorm(wx + TILE_SIZE / 2, wy + TILE_SIZE / 2);
      }

      // Dodge roll visual: cyan i-frame glow + double afterimage trail
      if (player.dodging) {
        // Cyan glow halo behind player
        const gcx = sx + TILE_SIZE / 2;
        const gcy = sy + TILE_SIZE / 2;
        const glowR = TILE_SIZE * 0.8;
        const iframePulse = 0.55 + Math.sin(this.animFrame * 1.2) * 0.1;
        ctx.save();
        ctx.globalAlpha = iframePulse * 0.35;
        ctx.fillStyle = '#22d3ee';
        ctx.beginPath();
        ctx.arc(gcx, gcy, glowR, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Two afterimages with graduated alpha
        const trailOffX = player.facing === 'left' ? 3 : player.facing === 'right' ? -3 : 0;
        const trailOffY = player.facing === 'up' ? 3 : player.facing === 'down' ? -3 : 0;
        ctx.globalAlpha = 0.2;
        this.sprites.drawPlayer(
          ctx, sx + trailOffX * 2, sy + trailOffY * 2,
          player.class, player.facing, false, this.animFrame,
          false, false, false, false, false, 0,
        );
        ctx.globalAlpha = 0.35;
        this.sprites.drawPlayer(
          ctx, sx + trailOffX, sy + trailOffY,
          player.class, player.facing, false, this.animFrame,
          false, false, false, false, false, 0,
        );
        // Main sprite slightly translucent to match i-frame feel
        ctx.globalAlpha = 0.7;
      }

      // Dynamic shadow source for player
      const playerQPreset = QUALITY_PRESETS[this.quality];
      if (playerQPreset.shadowDynamic) {
        const pwcx = player.position.x * TILE_SIZE + TILE_SIZE / 2;
        const pwcy = player.position.y * TILE_SIZE + TILE_SIZE / 2;
        this.sprites.setCurrentLightSource(this.computeNearestTorchLight(pwcx, pwcy));
      } else {
        this.sprites.setCurrentLightSource(null);
      }

      // Co-op aura rings — softer, slower rotation, single ring at a time fused per source
      const auraFrom = (player as PlayerState & { auraFrom?: string }).auraFrom ?? '';
      if (auraFrom.length > 0) {
        const fcx = sx + TILE_SIZE / 2;
        const fcy = sy + TILE_SIZE / 2 + 1;
        // Viewport cull — only draw if within view
        if (fcx >= -20 && fcx <= this.logicalWidth + 20 && fcy >= -20 && fcy <= this.logicalHeight + 20) {
          const sources = auraFrom.split(',');
          const auraColors: Record<string, string> = {
            warrior: '#f87171',
            mage: '#c4b5fd',
            archer: '#86efac',
            healer: '#fde68a',
          };
          const baseR = TILE_SIZE * 0.55;
          ctx.save();
          for (let ai = 0; ai < sources.length; ai++) {
            const c = auraColors[sources[ai]];
            if (!c) continue;
            const phase = this.animFrame * 0.05 + ai * 1.5; // slower pulse
            const pulse = Math.sin(phase) * 0.08;
            const r = baseR + ai * 1.6 + pulse * 2;
            // Softer: alpha reduced 0.35→0.22 and no dash animation jitter
            ctx.globalAlpha = 0.22 + pulse * 0.08;
            ctx.strokeStyle = c;
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 3]);
            ctx.lineDashOffset = -this.animFrame * 0.35; // slower
            ctx.beginPath();
            ctx.arc(fcx, fcy, r, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.setLineDash([]);
          ctx.restore();
        }
      }

      // Hit squash for player — same pattern
      const pHitStopT = ((player as PlayerState & { hitStopTicks?: number }).hitStopTicks ?? 0) / 4;
      const applyPSquash = pHitStopT > 0;
      if (applyPSquash) {
        const sq = 1 - pHitStopT * 0.18;
        const st = 1 + pHitStopT * 0.12;
        const pcx = sx + TILE_SIZE / 2;
        const pcy = sy + TILE_SIZE;
        ctx.save();
        ctx.translate(pcx, pcy);
        ctx.scale(st, sq);
        ctx.translate(-pcx, -pcy);
      }

      this.sprites.drawPlayer(
        ctx, sx, sy,
        player.class,
        player.facing,
        player.attacking,
        this.animFrame,
        flashWhite,
        player.abilityActive,
        player.shieldActive,
        player.poisoned,
        player.slowed,
        player.stunTicks,
        isEntityMoving(player.velocity),
      );
      if (applyPSquash) ctx.restore();

      if (player.dodging) {
        ctx.globalAlpha = 1;
        // Dodge dust particles
        if (QUALITY_PRESETS[this.quality].particles && this.animFrame % 2 === 0) {
          this.particles.emitFootstepDust(wx + TILE_SIZE / 2, wy + TILE_SIZE);
          this.particles.emitFootstepDust(wx + TILE_SIZE / 2, wy + TILE_SIZE);
        }
      }

      // Shield shimmer particles for warrior ability
      if (player.abilityActive && player.class === 'warrior') {
        this.particles.emitShieldShimmer(wx + TILE_SIZE / 2, wy + TILE_SIZE / 2);
      }

      // Healing wave glow for healer ability
      if (player.abilityActive && player.class === 'healer') {
        const cx = sx + TILE_SIZE / 2;
        const cy = sy + TILE_SIZE / 2;
        const pulse = 0.15 + Math.sin(this.animFrame * 0.4) * 0.08;
        ctx.globalAlpha = pulse;
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(cx, cy, TILE_SIZE * 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Speed boost trail particles
      if (player.speedBoosted) {
        this.particles.emitSpeedTrail(wx + TILE_SIZE / 2, wy + TILE_SIZE / 2);
      }

      this.drawNameTag(ctx, sx + TILE_SIZE / 2, sy - 6, player.name, player.id === localPlayerId, player.level);
      this.drawHealthBar(ctx, sx, sy + TILE_SIZE + 1, TILE_SIZE, player.hp, player.maxHp, player.id);
      this.drawManaBar(ctx, sx, sy + TILE_SIZE + 5, TILE_SIZE, player.mana, player.maxMana);

      // Interaction indicator for local player near chests/stairs
      if (player.id === localPlayerId) {
        const interactable = this.getNearbyInteractable(state, player.position.x, player.position.y);
        if (interactable) {
          this.drawInteractIndicator(ctx, sx + TILE_SIZE / 2, sy - 22, interactable);
        }
      }
    }
  }

  private drawNameTag(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    name: string,
    isLocal: boolean,
    level?: number,
  ): void {
    const displayText = level && level > 1 ? `${name} Lv${level}` : name;
    const textWidth = measurePixelText(displayText);
    const bgX = Math.floor(x - textWidth / 2 - 2);
    const bgY = Math.floor(y - 5);
    const bgW = Math.ceil(textWidth + 4);

    // Background pill with subtle border
    ctx.fillStyle = isLocal ? 'rgba(251,191,36,0.15)' : 'rgba(0,0,0,0.55)';
    ctx.fillRect(bgX, bgY, bgW, 6);
    ctx.fillStyle = isLocal ? 'rgba(251,191,36,0.3)' : 'rgba(148,163,184,0.15)';
    ctx.fillRect(bgX, bgY, bgW, 1); // top border highlight

    // Name text
    drawPixelText(
      ctx,
      Math.floor(x) - textWidth / 2,
      bgY + 1,
      displayText,
      isLocal ? '#fbbf24' : '#e5e7eb',
    );
  }

  private drawHealthBar(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    hp: number,
    maxHp: number,
    entityId?: string,
  ): void {
    const barHeight = 2; // thin 2px bars for monsters
    const ratio = Math.max(0, hp / maxHp);

    // 1px black outline
    ctx.fillStyle = '#000000';
    ctx.fillRect(x - 1, y - 1, width + 2, barHeight + 2);

    // Inner background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(x, y, width, barHeight);

    // Health fill with gradient coloring
    const filledWidth = Math.ceil(width * ratio);
    if (filledWidth > 0) {
      if (ratio > 0.6) {
        ctx.fillStyle = '#4ade80';
      } else if (ratio > 0.4) {
        ctx.fillStyle = '#facc15';
      } else if (ratio > 0.2) {
        ctx.fillStyle = '#f97316';
      } else {
        ctx.fillStyle = '#ef4444';
      }
      ctx.fillRect(x, y, filledWidth, barHeight);

      // Lighter top half for inner highlight
      ctx.globalAlpha = 0.3;
      if (ratio > 0.6) {
        ctx.fillStyle = '#86efac';
      } else if (ratio > 0.4) {
        ctx.fillStyle = '#fde68a';
      } else if (ratio > 0.2) {
        ctx.fillStyle = '#fdba74';
      } else {
        ctx.fillStyle = '#fca5a5';
      }
      ctx.fillRect(x, y, filledWidth, 1);
      ctx.globalAlpha = 1;
    }

    // Damage flash: white flash when HP just decreased (entityId tracked in prevHp)
    if (entityId) {
      const prev = this.prevHp.get(entityId);
      if (prev !== undefined && prev > hp) {
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x, y, width, barHeight);
        ctx.globalAlpha = 1;
      }
    }
  }

  /** Draw boss health bar centered at top of screen */
  private drawBossHealthBar(
    ctx: CanvasRenderingContext2D,
    monsters: MonsterState[],
  ): void {
    // Find ANY alive boss monster (not just boss_demon)
    const boss = monsters.find(m => m.type.startsWith('boss_') && m.alive);
    if (!boss) return;

    // Boss display names
    const BOSS_NAMES: Record<string, string> = {
      boss_spider_queen: 'ÖRÜMCEK KRALİÇE',
      boss_demon: 'MOR\'KHAN',
      boss_forge_guardian: 'DEMİR KORUYUCU',
      boss_stone_warden: 'TAŞ MUHAFIZ',
      boss_flame_knight: 'ALEV ŞÖVALYESİ',
    };
    const BOSS_COLORS: Record<string, string> = {
      boss_spider_queen: '#a855f7',
      boss_demon: '#ef4444',
      boss_forge_guardian: '#f97316',
      boss_stone_warden: '#78716c',
      boss_flame_knight: '#ef4444',
    };
    const bossName = BOSS_NAMES[boss.type] ?? boss.type.toUpperCase();
    const bossColor = BOSS_COLORS[boss.type] ?? '#ef4444';

    const barWidth = Math.floor(this.logicalWidth * 0.5);
    const barHeight = 6;
    const barX = Math.floor((this.logicalWidth - barWidth) / 2);
    const barY = 8;
    const ratio = Math.max(0, boss.hp / boss.maxHp);

    // Boss phase indicator (small dots under name)
    if (boss.bossPhase > 0) {
      const phaseCount = boss.bossPhase;
      const dotSpacing = 6;
      const dotsX = this.logicalWidth / 2 - ((phaseCount - 1) * dotSpacing) / 2;
      for (let p = 0; p < phaseCount; p++) {
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(dotsX + p * dotSpacing - 1, barY - 5, 2, 2);
      }
    }

    // Name label with boss-specific color
    const bossNameW = measurePixelText(bossName);
    drawPixelTextOutlined(
      ctx,
      this.logicalWidth / 2 - bossNameW / 2,
      barY - 2 - PIXEL_FONT_HEIGHT,
      bossName,
      bossColor,
    );

    // 1px black outline
    ctx.fillStyle = '#000000';
    ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);

    // Inner background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    // Health fill
    const filledWidth = Math.ceil(barWidth * ratio);
    if (filledWidth > 0) {
      if (ratio > 0.6) {
        ctx.fillStyle = '#ef4444';
      } else if (ratio > 0.3) {
        ctx.fillStyle = '#f97316';
      } else {
        ctx.fillStyle = '#dc2626';
      }
      ctx.fillRect(barX, barY, filledWidth, barHeight);

      // Top highlight
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#fca5a5';
      ctx.fillRect(barX, barY, filledWidth, Math.floor(barHeight / 2));
      ctx.globalAlpha = 1;
    }

    // 25% segment lines
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    for (let s = 1; s < 4; s++) {
      const sx = barX + Math.floor(barWidth * s / 4);
      ctx.fillRect(sx, barY, 1, barHeight);
    }

    // Pulsing glow when low
    if (ratio < 0.3 && ratio > 0) {
      const pulse = 0.08 + Math.sin(Date.now() * 0.005) * 0.05;
      ctx.globalAlpha = pulse;
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(barX - 2, barY - 2, barWidth + 4, barHeight + 4);
      ctx.globalAlpha = 1;
    }
  }

  /** Draw player mana bar (thin blue line below HP bar) */
  private drawManaBar(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    mana: number,
    maxMana: number,
  ): void {
    const barHeight = 1;

    // 1px black outline
    ctx.fillStyle = '#000000';
    ctx.fillRect(x - 1, y - 1, width + 2, barHeight + 2);

    // Background
    ctx.fillStyle = '#0a0a2e';
    ctx.fillRect(x, y, width, barHeight);

    // Mana fill
    const ratio = Math.max(0, mana / maxMana);
    const filledWidth = Math.ceil(width * ratio);
    if (filledWidth > 0) {
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(x, y, filledWidth, barHeight);
    }
  }

  private renderDamageNumbers(
    ctx: CanvasRenderingContext2D,
    camX: number,
    camY: number,
  ): void {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < this.damageNumbers.length; i++) {
      const dn = this.damageNumbers[i];
      const progress = 1 - dn.life / dn.maxLife;

      // Non-linear float: fast at start, decelerating (longer travel for crits)
      const floatY = Math.pow(progress, 0.6) * (dn.kind === 'critical' ? 32 : 22);

      // Scale-up animation: overshoot then settle
      const scaleProgress = Math.min(1, progress * 5); // first 20% of life
      const overshoot = scaleProgress < 0.5 ? 1 + scaleProgress * 0.35 : 1;
      const baseScale = dn.scale + (1 - dn.scale) * scaleProgress * overshoot;
      // Merge bump: +15% scale pulse when value increases
      const currentScale = baseScale * (1 + dn.mergeBumpTimer * 0.15);

      // Alpha: fade out in last 30%
      const alpha = progress < 0.7 ? 1 : Math.max(0, 1 - (progress - 0.7) / 0.3);
      ctx.globalAlpha = alpha;

      // Font size based on kind
      const isCrit = dn.kind === 'critical';
      const isHeal = dn.kind === 'heal';
      const isElement = dn.kind === 'fire' || dn.kind === 'ice' || dn.kind === 'poison' || dn.kind === 'holy';
      // Bitmap font scales in whole pixels only — a fractional scale would
      // resample the glyphs and reintroduce exactly the blur this replaces.
      const glyphScale = isCrit ? 2 : 1;
      const textScale = Math.max(1, Math.round(glyphScale * currentScale));
      const textW = measurePixelText(dn.text, textScale);

      // Slight x-wobble for crit
      const wobble = dn.shake > 0 ? Math.sin(progress * 30) * dn.shake : 0;
      const dx = Math.floor(dn.x - camX + wobble);
      const dy = Math.floor(dn.y - camY - floatY);

      // Soft outer glow (additive) — only in first 50% of life, reduced intensity
      if (progress < 0.5) {
        const glowAlpha = alpha * (1 - progress / 0.5) * (isCrit ? 0.55 : 0.35);
        ctx.globalAlpha = glowAlpha;
        ctx.shadowColor = dn.glow;
        ctx.shadowBlur = isCrit ? 8 : 4;
        drawPixelText(ctx, dx - textW / 2, dy, dn.text, dn.glow, textScale);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = alpha;
      }

      drawPixelTextOutlined(ctx, dx - textW / 2, dy, dn.text, dn.color, textScale);

      // Heal: upward green sparkle
      if (isHeal && progress < 0.3) {
        ctx.globalAlpha = alpha * 0.5;
        ctx.fillStyle = '#86efac';
        ctx.fillRect(dx - 1, dy - 3 - progress * 8, 2, 1);
        ctx.globalAlpha = alpha;
      }
    }
    ctx.globalAlpha = 1;
  }

  private updateDamageNumbers(dt: number): void {
    // Swap-with-last removal pattern — O(1) per removal instead of O(n) splice
    let i = 0;
    while (i < this.damageNumbers.length) {
      const dn = this.damageNumbers[i];
      dn.life -= dt;
      if (dn.mergeBumpTimer > 0) {
        dn.mergeBumpTimer = Math.max(0, dn.mergeBumpTimer - dt * 4);
      }
      if (dn.life <= 0) {
        // Swap with last element and pop (O(1))
        this.damageNumbers[i] = this.damageNumbers[this.damageNumbers.length - 1];
        this.damageNumbers.pop();
      } else {
        i++;
      }
    }
  }

  private updateFog(state: GameState, localPlayerId: string, playersArr: PlayerState[]): void {
    const dw = state.dungeon.width;
    const dh = state.dungeon.height;

    if (this.fogGrid.length !== dh || !this.fogGrid[0] || this.fogGrid[0].length !== dw) {
      this.fogGrid = [];
      for (let y = 0; y < dh; y++) {
        this.fogGrid[y] = new Array<FogState>(dw).fill(0);
      }
      this.fogCacheDirty = true;
    }

    // Reset all visible to explored
    for (let y = 0; y < dh; y++) {
      for (let x = 0; x < dw; x++) {
        if (this.fogGrid[y][x] === 2) {
          this.fogGrid[y][x] = 1;
        }
      }
    }

    // Fog cache invalidation: check ALL players + vision radius changes
    // Build a simple hash from all player tile positions + vision radius
    let fogHash = this.currentVisionRadius * 10000;
    for (let i = 0; i < playersArr.length; i++) {
      const p = playersArr[i];
      if (!p.alive) continue;
      fogHash += Math.floor(p.position.x) * 31 + Math.floor(p.position.y) * 997 + i * 7919;
    }
    const localPlayer = state.players[localPlayerId];
    if (localPlayer) {
      const ptx = Math.floor(localPlayer.position.x);
      const pty = Math.floor(localPlayer.position.y);
      if (ptx !== this.fogCachePlayerTileX || pty !== this.fogCachePlayerTileY || fogHash !== this._fogHash) {
        this.fogCacheDirty = true;
        this.fogCachePlayerTileX = ptx;
        this.fogCachePlayerTileY = pty;
      }
    }
    this._fogHash = fogHash;

    // Reveal around players
    for (let i = 0; i < playersArr.length; i++) {
      const p = playersArr[i];
      if (!p.alive) continue;
      const px = Math.floor(p.position.x);
      const py = Math.floor(p.position.y);

      const vr = this.currentVisionRadius;
      for (let dy = -vr; dy <= vr; dy++) {
        for (let dx = -vr; dx <= vr; dx++) {
          if (dx * dx + dy * dy > vr * vr) continue;
          const tx = px + dx;
          const ty = py + dy;
          if (tx >= 0 && tx < dw && ty >= 0 && ty < dh) {
            this.fogGrid[ty][tx] = 2;
          }
        }
      }
    }
  }

  private renderFog(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    camX: number,
    camY: number,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    localPlayerId: string,
    playersArr: PlayerState[],
  ): void {
    const isSimple = QUALITY_PRESETS[this.quality].fogSimple;

    // On medium/high, fog is rasterised one pixel per tile and scaled up with
    // interpolation, which feathers the boundary for free. The batched-fillRect
    // path below stays for `low`, where the extra buffer is not worth it.
    if (!isSimple) {
      this.renderFogSoft(ctx, camX, camY, startX, startY, endX, endY);
      this.renderFogGradientEdges(ctx, state, camX, camY, startX, startY, endX, endY, playersArr);
      return;
    }

    const exploredStyle = 'rgba(10,12,30,0.15)';

    // Batch consecutive same-state fog tiles per row into single wider fillRect calls
    for (let ty = startY; ty < endY; ty++) {
      const fogRow = this.fogGrid[ty];
      if (!fogRow) continue;
      const sy = ty * TILE_SIZE - camY;

      let runStart = -1;
      let runState: 0 | 1 = 0; // 0 = hidden, 1 = explored

      for (let tx = startX; tx <= endX; tx++) {
        const fog = tx < endX ? fogRow[tx] : 2; // sentinel to flush last run
        if (fog === 2 || (runStart >= 0 && fog !== runState)) {
          // Flush current run
          if (runStart >= 0) {
            const sx = runStart * TILE_SIZE - camX;
            const runW = (tx - runStart) * TILE_SIZE;
            if (runState === 0) {
              ctx.fillStyle = '#0a0e1a';
              ctx.fillRect(sx, sy, runW, TILE_SIZE);
            } else {
              ctx.fillStyle = exploredStyle;
              ctx.fillRect(sx, sy, runW, TILE_SIZE);
              ctx.globalAlpha = 0.04;
              ctx.fillStyle = '#1e3a5f';
              ctx.fillRect(sx, sy, runW, TILE_SIZE);
              ctx.globalAlpha = 1;
            }
            runStart = -1;
          }
        }
        if (fog === 0 || fog === 1) {
          if (runStart < 0) {
            runStart = tx;
            runState = fog as 0 | 1;
          }
        }
      }
    }

  }

  /**
   * Fog with soft edges.
   *
   * Fog used to be drawn as opaque 16px fillRects, so the boundary between
   * explored and unexplored space was a hard rectangular staircase — very visible
   * as black blocks along room edges. Here the fog field is rasterised at one
   * pixel per tile into a tiny buffer, then blitted up to full size with
   * imageSmoothingEnabled on: the browser's bilinear filter turns the step
   * function into a gradient. The buffer is a few hundred pixels, so this is
   * cheaper than the per-row batching it replaces.
   */
  private renderFogSoft(
    ctx: CanvasRenderingContext2D,
    camX: number,
    camY: number,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
  ): void {
    // One-tile margin so the gradient has somewhere to ramp at screen edges.
    const x0 = startX - 1;
    const y0 = startY - 1;
    const w = (endX - startX) + 3;
    const h = (endY - startY) + 3;
    if (w <= 0 || h <= 0) return;

    if (!this.fogBuffer || this.fogBufferW !== w || this.fogBufferH !== h) {
      this.fogBuffer = document.createElement('canvas');
      this.fogBuffer.width = w;
      this.fogBuffer.height = h;
      this.fogBufferCtx = this.fogBuffer.getContext('2d');
      this.fogBufferImage = this.fogBufferCtx?.createImageData(w, h) ?? null;
      this.fogBufferW = w;
      this.fogBufferH = h;
    }
    const bufCtx = this.fogBufferCtx;
    const img = this.fogBufferImage;
    if (!bufCtx || !img) return;

    const data = img.data;
    let i = 0;
    for (let ty = y0; ty < y0 + h; ty++) {
      const fogRow = this.fogGrid[ty];
      for (let tx = x0; tx < x0 + w; tx++) {
        // Off-map reads as unexplored so the edge ramps to black rather than
        // popping to transparent.
        const fog = fogRow ? (fogRow[tx] ?? 0) : 0;
        data[i] = 10;
        data[i + 1] = 12;
        data[i + 2] = 26;
        data[i + 3] = fog === 0 ? 255 : fog === 1 ? 48 : 0;
        i += 4;
      }
    }
    bufCtx.putImageData(img, 0, 0);

    // Half-tile offset puts each source pixel's centre on its tile's centre, so
    // the interpolated ramp straddles the tile boundary instead of lagging it.
    const dx = x0 * TILE_SIZE - camX + TILE_SIZE / 2;
    const dy = y0 * TILE_SIZE - camY + TILE_SIZE / 2;

    const prevSmoothing = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.fogBuffer, dx, dy, w * TILE_SIZE, h * TILE_SIZE);
    ctx.imageSmoothingEnabled = prevSmoothing;
  }

  /** Render soft gradient edges at the boundary of visible/explored fog tiles */
  private renderFogGradientEdges(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    camX: number,
    camY: number,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    playersArr: PlayerState[],
  ): void {
    // For each visible tile bordering non-visible, draw soft gradient overlay
    // Check only 4 cardinal neighbors (fast path) + batch consecutive border tiles per row
    const dw = state.dungeon.width;
    const dh = state.dungeon.height;
    ctx.globalAlpha = 0.03;
    ctx.fillStyle = '#0a0c1a';
    for (let ty = startY; ty < endY; ty++) {
      const fogRow = this.fogGrid[ty];
      if (!fogRow) continue;
      const rowAbove = ty > 0 ? this.fogGrid[ty - 1] : null;
      const rowBelow = ty < dh - 1 ? this.fogGrid[ty + 1] : null;

      let batchStart = -1;
      for (let tx = startX; tx <= endX; tx++) {
        let isBorder = false;
        if (tx < endX && fogRow[tx] === 2) {
          // Cardinal neighbor check only (4 instead of 8 — negligible visual difference)
          if (tx <= 0 || tx >= dw - 1 || ty <= 0 || ty >= dh - 1) {
            isBorder = true;
          } else if (
            fogRow[tx - 1] !== 2 || fogRow[tx + 1] !== 2 ||
            (rowAbove && rowAbove[tx] !== 2) ||
            (rowBelow && rowBelow[tx] !== 2)
          ) {
            isBorder = true;
          }
        }
        if (isBorder) {
          if (batchStart < 0) batchStart = tx;
        } else if (batchStart >= 0) {
          // Flush batch
          const sx = batchStart * TILE_SIZE - camX;
          const sy2 = ty * TILE_SIZE - camY;
          ctx.fillRect(sx, sy2, (tx - batchStart) * TILE_SIZE, TILE_SIZE);
          batchStart = -1;
        }
      }
    }
    ctx.globalAlpha = 1;

    // Radial gradient overlay centered on each player for smooth vision falloff
    // Use pre-rendered canvas instead of createRadialGradient per player per frame
    const visionPx = this.currentVisionRadius * TILE_SIZE;
    const extendedVision = visionPx * 1.2;
    const falloffSize = Math.ceil(extendedVision * 2);

    // Rebuild vision falloff canvas if radius changed
    if (!this.visionFalloffCanvas || this.visionFalloffRadius !== falloffSize) {
      this.visionFalloffRadius = falloffSize;
      this.visionFalloffCanvas = document.createElement('canvas');
      this.visionFalloffCanvas.width = falloffSize;
      this.visionFalloffCanvas.height = falloffSize;
      const vCtx = this.visionFalloffCanvas.getContext('2d');
      if (vCtx) {
        const cx = falloffSize / 2;
        const cy = falloffSize / 2;
        const grad = vCtx.createRadialGradient(cx, cy, visionPx * 0.6, cx, cy, extendedVision);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(0.7, 'rgba(0,0,0,0)');
        grad.addColorStop(0.9, 'rgba(6,8,16,0.03)');
        grad.addColorStop(1, 'rgba(6,8,16,0.10)');
        vCtx.fillStyle = grad;
        vCtx.fillRect(0, 0, falloffSize, falloffSize);
      }
    }

    for (let i = 0; i < playersArr.length; i++) {
      const p = playersArr[i];
      if (!p.alive) continue;

      const pcx = p.position.x * TILE_SIZE + TILE_SIZE / 2 - camX;
      const pcy = p.position.y * TILE_SIZE + TILE_SIZE / 2 - camY;
      ctx.drawImage(this.visionFalloffCanvas, pcx - extendedVision, pcy - extendedVision);
    }
  }

  /**
   * Fire the one-shot VFX that hang off entity state edges.
   *
   * The particle system shipped with 18 authored emitters that nothing ever
   * called — dodge puffs, shield breaks, stun stars, enrage flares, phase blinks,
   * gold sparkles, combo rings, the ability-ready pop. All of it was written and
   * then left unwired. These are edge-triggered, so they need a previous-frame
   * snapshot rather than a per-frame check.
   */
  private detectStateTransitions(
    players: PlayerState[],
    monsters: MonsterState[],
    localPlayerId: string,
  ): void {
    const preset = QUALITY_PRESETS[this.quality];
    if (!preset.particles) return;

    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      const wx = p.position.x * TILE_SIZE + TILE_SIZE / 2;
      const wy = p.position.y * TILE_SIZE + TILE_SIZE / 2;
      const prev = this.prevPlayerFlags.get(p.id);
      const color = CLASS_STATS[p.class].color;

      if (prev) {
        if (p.dodging && !prev.dodging) this.particles.emitDodge(wx, wy, color);
        if (!p.alive && prev.alive) {
          this.particles.emitPlayerDeath(wx, wy);
          if (p.id === localPlayerId) this.camera.shakeTakeDamage();
        }
        // Ability just came off cooldown — a small pop at the caster's feet.
        if (prev.abilityCd > 0 && p.abilityCooldownTicks <= 0 && p.alive) {
          this.particles.emitAbilityReady(wx, wy, color);
        }
        if (p.stunTicks > 0 && prev.stun <= 0) this.particles.emitStunStars(wx, wy - 10);
        // Combo tier crossings: 4 / 6 / 10, same thresholds the HUD uses.
        const tier = p.comboCount >= 10 ? 3 : p.comboCount >= 6 ? 2 : p.comboCount >= 4 ? 1 : 0;
        if (tier > prev.comboTier) this.particles.emitComboRing(wx, wy, tier);
        // Casters get an arcane burst on activation.
        if (p.abilityActive && !prev.abilityActive && (p.class === 'mage' || p.class === 'healer')) {
          this.particles.emitMagicBurst(wx, wy);
        }
      }

      this.prevPlayerFlags.set(p.id, {
        dodging: p.dodging,
        alive: p.alive,
        abilityCd: p.abilityCooldownTicks,
        stun: p.stunTicks,
        abilityActive: p.abilityActive,
        comboTier: p.comboCount >= 10 ? 3 : p.comboCount >= 6 ? 2 : p.comboCount >= 4 ? 1 : 0,
      });
    }

    for (let i = 0; i < monsters.length; i++) {
      const m = monsters[i];
      if (!m.alive) { this.prevMonsterFlags.delete(m.id); continue; }
      const wx = m.position.x * TILE_SIZE + TILE_SIZE / 2;
      const wy = m.position.y * TILE_SIZE + TILE_SIZE / 2;
      if (!this.camera.isVisible(wx, wy, 64, 64)) { continue; }
      const prev = this.prevMonsterFlags.get(m.id);

      if (prev) {
        if (m.enraged && !prev.enraged) this.particles.emitEnrageFlare(wx, wy);
        // Shield dropping is the opening the player was waiting for — show it.
        if (!m.shieldActive && prev.shield) this.particles.emitShieldBreak(wx, wy);
        if (m.phased !== prev.phased) this.particles.emitWraithPhase(wx, wy);
        if (m.staggerTicks > 0 && prev.stun <= 0) this.particles.emitStunStars(wx, wy - 10);
        // Spiders telegraph their web with `casting`; the emitter was written for
        // exactly this and never hooked up.
        if (m.casting && !prev.casting && (m.type === 'spider' || m.type === 'boss_spider_queen')) {
          this.particles.emitWebShot(wx, wy, wx + 24, wy);
        }
        // A big slam that has just resolved leaves a pit. Keyed on the attack
        // leaving its active frame, which is the moment the damage landed.
        if (prev.phase === 'active' && m.attackPhase !== 'active' && m.telegraphRadius >= 2) {
          this.addCrater(wx, wy, Math.min(2.6, m.telegraphRadius * 0.6));
        }
      }

      this.prevMonsterFlags.set(m.id, {
        enraged: m.enraged,
        shield: m.shieldActive,
        phased: m.phased,
        stun: m.staggerTicks,
        casting: m.casting,
        phase: m.attackPhase,
      });
    }
  }

  private detectHpChanges(state: GameState, localPlayerId: string, players: PlayerState[], monsters: MonsterState[]): void {
    const preset = QUALITY_PRESETS[this.quality];

    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      const prev = this.prevHp.get(p.id);
      if (prev !== undefined && prev !== p.hp) {
        const diff = prev - p.hp;
        const wx = p.position.x * TILE_SIZE + TILE_SIZE / 2;
        const wy = p.position.y * TILE_SIZE;
        const serverMeta = this.pendingDamageMeta.get(p.id);
        if (serverMeta) this.pendingDamageMeta.delete(p.id);
        if (diff > 0 && p.id === localPlayerId) {
          const kx = serverMeta?.kx ?? 0;
          const ky = serverMeta?.ky ?? 0;
          const mag = Math.abs(kx) + Math.abs(ky);
          if (mag > 0.001) {
            this.camera.punchHit(kx / mag, ky / mag, 1.6);
          }
          this.camera.shakeFromDamageRatio(diff / Math.max(1, p.maxHp));
        }
        if (diff > 0) {
          // Prefer server metadata; fallback to heuristic
          const isCritical = serverMeta?.isCrit ?? (diff > p.maxHp * 0.25);
          const dType = serverMeta?.damageType;
          const kind: DamageNumberKind = isCritical ? 'critical'
            : dType === 'fire' ? 'fire'
            : dType === 'ice' ? 'ice'
            : dType === 'poison' ? 'poison'
            : dType === 'holy' ? 'holy'
            : 'damage';
          this.addDamageNumber(wx, wy, diff, false, kind);
          if (preset.particles) {
            this.particles.emitHit(wx, wy);
            this.particles.emitBloodSplatter(wx, wy + TILE_SIZE / 2);
            if (isCritical) this.particles.emitHitSpark(wx, wy + TILE_SIZE / 2);
            // Element-specific extra particles
            if (dType === 'fire') this.particles.emitBurnFlare(wx, wy + TILE_SIZE / 2);
            else if (dType === 'ice') this.particles.emitFreezeShatter(wx, wy + TILE_SIZE / 2);
            else if (dType === 'poison') this.particles.emitPoisonCloud(wx, wy + TILE_SIZE / 2);
          }
          // Camera shake — only for local player taking damage, scaled by severity
          if (p.id === localPlayerId) {
            const dmgRatio = Math.min(1, diff / p.maxHp);
            if (dmgRatio > 0.3) {
              // Heavy hit (>30% max HP)
              this.camera.shake(3.5, 220);
            } else if (dmgRatio > 0.15) {
              // Medium hit
              this.camera.shake(2, 150);
            } else if (dmgRatio > 0.06) {
              // Light hit — minimal shake only
              this.camera.shake(1, 90);
            }
            // <6% HP hit: no shake at all (reduces fatigue on rapid monster hits)
          }
          // Other players' damage: no shake at all — avoids phantom jitter

          // Screen flash on player damage (softened alphas)
          if (p.id === localPlayerId) {
            if (diff > p.maxHp * 0.3) {
              this.triggerScreenFlash('#ffffff', 0.28);
              this.freezeFrame(50);
            } else if (isCritical) {
              this.triggerScreenFlash('#ffffff', 0.15);
              this.freezeFrame(40);
            } else if (diff > p.maxHp * 0.08) {
              this.triggerScreenFlash('#ffffff', 0.08);
            }
          }
        } else {
          this.addDamageNumber(wx, wy, Math.abs(diff), true, 'heal');
          if (preset.particles) {
            this.particles.emitHealSparkles(wx, wy + TILE_SIZE / 2);
          }
        }
      }
      // Detect player death
      if (prev !== undefined && prev > 0 && p.hp <= 0) {
        const wx = p.position.x * TILE_SIZE + TILE_SIZE / 2;
        const wy = p.position.y * TILE_SIZE + TILE_SIZE / 2;
        this.camera.shakeDeath();
        if (preset.particles) {
          this.particles.emitDeath(wx, wy, CLASS_STATS[p.class].color);
        }
      }
      this.prevHp.set(p.id, p.hp);
    }

    for (let i = 0; i < monsters.length; i++) {
      const m = monsters[i];
      const prev = this.prevHp.get(m.id);
      if (prev !== undefined && prev !== m.hp) {
        const diff = prev - m.hp;
        const wx = m.position.x * TILE_SIZE + TILE_SIZE / 2;
        const wy = m.position.y * TILE_SIZE;
        const serverMeta = this.pendingDamageMeta.get(m.id);
        if (serverMeta) this.pendingDamageMeta.delete(m.id);
        if (diff > 0) {
          const isCrit = serverMeta?.isCrit ?? (diff > m.maxHp * 0.3);
          const dType = serverMeta?.damageType;
          const kind: DamageNumberKind = isCrit ? 'critical'
            : dType === 'fire' ? 'fire'
            : dType === 'ice' ? 'ice'
            : dType === 'poison' ? 'poison'
            : dType === 'holy' ? 'holy'
            : 'damage';
          this.addDamageNumber(wx, wy, diff, false, kind);
          if (preset.particles) {
            this.particles.emitHit(wx, wy, MONSTER_STATS[m.type].color);
            if (isCrit) this.particles.emitCriticalHit(wx, wy);
            if (dType === 'fire') this.particles.emitBurnFlare(wx, wy + TILE_SIZE / 2);
            else if (dType === 'ice') this.particles.emitFreezeShatter(wx, wy + TILE_SIZE / 2);
            else if (dType === 'poison') this.particles.emitPoisonCloud(wx, wy + TILE_SIZE / 2);
            else if (dType === 'holy') this.particles.emitHealEffect(wx, wy + TILE_SIZE / 2);
          }
          // Screen shake — only for notable events (boss, crit), not every hit
          // Normal hits on monsters: no shake (sprite squash + particles = enough feedback)
          if (m.type.startsWith('boss_')) {
            // Boss damage — small punch
            this.camera.shake(2, 110);
            this.freezeFrame(30);
          } else if (isCrit) {
            // Crit — subtle, not big
            this.camera.shake(1.5, 90);
          }
          // Normal monster hit → NO screen shake (fixes "her vuruşta sallanıyor")
        }
      }
      if (prev !== undefined && m.hp <= 0 && (prev > 0)) {
        const wx = m.position.x * TILE_SIZE + TILE_SIZE / 2;
        const wy = m.position.y * TILE_SIZE + TILE_SIZE / 2;
        if (preset.particles) {
          this.particles.emitDeath(wx, wy, MONSTER_STATS[m.type].color);
          this.particles.emitDeathSoul(wx, wy, MONSTER_STATS[m.type].color);
        }
        // Add blood splatter at death location, in the monster's own colour
        this.addBloodSplatter(wx, wy, MONSTER_STATS[m.type].color, m.type.startsWith('boss_') ? 2.2 : 1);
        // Boss death = big shake
        if (m.type.startsWith('boss_')) {
          this.camera.shakeBossSlam();
          this.triggerScreenFlash('#ffffff', 0.7);
          this.freezeFrame(120);
        } else {
          this.camera.shake(3, 150);
          this.triggerScreenFlash('#ffffff', 0.14);
          this.freezeFrame(70);
        }
      }
      this.prevHp.set(m.id, m.hp);
    }

    // Update snapshot for next tick + detect disappearing monsters (server drops dead ones)
    const preset2 = QUALITY_PRESETS[this.quality];
    for (let i = 0; i < monsters.length; i++) {
      const m = monsters[i];
      this.prevMonsterSnapshot.set(m.id, {
        x: m.position.x * TILE_SIZE + TILE_SIZE / 2,
        y: m.position.y * TILE_SIZE + TILE_SIZE / 2,
        type: m.type,
        isBoss: m.type.startsWith('boss_'),
        facing: m.facing,
        isElite: m.isElite,
      });
    }
    // Any snapshot id that has prevHp > 0 but is missing from state.monsters = just died
    for (const [id, snap] of this.prevMonsterSnapshot) {
      if (state.monsters[id]) continue;
      const prev = this.prevHp.get(id);
      if (prev !== undefined && prev > 0) {
        const color = MONSTER_STATS[snap.type as keyof typeof MONSTER_STATS]?.color ?? '#ffffff';
        if (preset2.particles) {
          this.particles.emitDeath(snap.x, snap.y, color);
          this.particles.emitDeathSoul(snap.x, snap.y, color);
        }
        this.addBloodSplatter(snap.x, snap.y, color, snap.isBoss ? 2.2 : 1);
        if (snap.isBoss) this.addCrater(snap.x, snap.y, 2.4);
        // Client-side dying entity for squash+spin
        this.dyingEntities.push({
          x: snap.x, y: snap.y, type: snap.type, color,
          elapsed: 0, duration: snap.isBoss ? 700 : 380,
          isBoss: snap.isBoss,
          facing: snap.facing,
          isElite: snap.isElite,
          // Which way the corpse tips — away from the facing direction reads as
          // "knocked over" rather than "fell asleep".
          tipDir: snap.facing === 'left' ? 1 : -1,
        });
        if (snap.isBoss) {
          this.camera.shakeBossSlam();
          this.triggerScreenFlash('#ffffff', 0.7);
          this.freezeFrame(120);
        } else {
          this.camera.shake(3, 150);
          this.triggerScreenFlash('#ffffff', 0.12);
          this.freezeFrame(55);
        }
      }
      this.prevMonsterSnapshot.delete(id);
      this.prevHp.delete(id);
    }

    // Clean up
    for (const id of this.prevHp.keys()) {
      if (!state.players[id] && !state.monsters[id]) {
        this.prevHp.delete(id);
      }
    }
  }

  /** Tick & render dying entity squash+spin animations (called each frame after monsters) */
  /**
   * Death animation.
   *
   * Draws the monster's own sprite collapsing rather than the generic coloured
   * ellipse this used to be — the previous version deleted the creature's
   * identity the instant it died, so a boss and a rat vanished the same way.
   * Behaviour splits by archetype: soft bodies splat, skeletons crumble, fliers
   * drop, everything else tips over and sinks.
   */
  private updateAndRenderDyingEntities(ctx: CanvasRenderingContext2D, camX: number, camY: number, dt: number): void {
    const dtMs = dt * 1000;
    for (let i = this.dyingEntities.length - 1; i >= 0; i--) {
      const d = this.dyingEntities[i];
      d.elapsed += dtMs;
      if (d.elapsed >= d.duration) {
        this.dyingEntities[i] = this.dyingEntities[this.dyingEntities.length - 1];
        this.dyingEntities.pop();
        continue;
      }

      const t = d.elapsed / d.duration;
      const stats = MONSTER_STATS[d.type as MonsterType];
      const size = TILE_SIZE * (stats?.size ?? 1);
      const sx = Math.round(d.x - camX);
      const sy = Math.round(d.y - camY);

      // Archetype-specific collapse
      let scaleX = 1;
      let scaleY = 1;
      let rot = 0;
      let dropY = 0;
      let jitter = 0;

      switch (d.type) {
        case 'slime':
        case 'lava_slime': {
          // Soft body: splats outward and flattens, no rotation.
          scaleX = 1 + t * 0.9;
          scaleY = Math.max(0, 1 - t * 1.25);
          break;
        }
        case 'skeleton':
        case 'dark_knight': {
          // Bone: shudders apart in place rather than tipping.
          jitter = (1 - t) * 1.5;
          scaleY = Math.max(0, 1 - t * 0.85);
          scaleX = 1 - t * 0.15;
          break;
        }
        case 'bat':
        case 'wraith':
        case 'phantom': {
          // Airborne / incorporeal: falls and spins out.
          dropY = t * t * size * 0.8;
          rot = d.tipDir * t * 1.6;
          scaleX = 1 - t * 0.3;
          scaleY = 1 - t * 0.3;
          break;
        }
        default: {
          // Tips over and sinks into the floor.
          rot = d.tipDir * t * (Math.PI / 2.4);
          scaleY = Math.max(0, 1 - t * 0.55);
          scaleX = 1 + t * 0.18;
          break;
        }
      }

      // Bosses collapse slowly and stay upright — they sink, they do not topple.
      if (d.isBoss) {
        rot = 0;
        scaleX = 1 + t * 0.25;
        scaleY = Math.max(0, 1 - t * 0.7);
      }

      const alpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;

      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);
      // Pivot at the feet so the collapse settles onto the ground.
      ctx.translate(sx + (jitter ? (Math.random() - 0.5) * jitter * 2 : 0), sy + dropY + size / 2);
      if (rot !== 0) ctx.rotate(rot);
      ctx.scale(scaleX, scaleY);
      ctx.translate(-size / 2, -size);

      this.sprites.drawMonster(
        ctx, 0, 0, d.type as MonsterType, d.facing, this.animFrame,
        // Flash white for the first beat, then the plain sprite fades out.
        t < 0.18, false, d.isElite,
        false, false, false, 0, 0, 0,
      );
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  /** Clean up resources */
  /** Check if there is a chest or stairs tile near the given world position */
  private getNearbyInteractable(state: GameState, px: number, py: number): TileType | null {
    const INTERACT_RADIUS = 1.2;
    const tiles = state.dungeon.tiles;
    const startX = Math.max(0, Math.floor(px - INTERACT_RADIUS));
    const endX = Math.min(state.dungeon.width - 1, Math.floor(px + INTERACT_RADIUS));
    const startY = Math.max(0, Math.floor(py - INTERACT_RADIUS));
    const endY = Math.min(state.dungeon.height - 1, Math.floor(py + INTERACT_RADIUS));

    for (let ty = startY; ty <= endY; ty++) {
      const row = tiles[ty];
      if (!row) continue;
      for (let tx = startX; tx <= endX; tx++) {
        const tile = row[tx];
        if (tile === 'chest' || tile === 'stairs') {
          const dx = px - (tx + 0.5);
          const dy = py - (ty + 0.5);
          if (dx * dx + dy * dy <= INTERACT_RADIUS * INTERACT_RADIUS) {
            return tile;
          }
        }
      }
    }
    return null;
  }

  /** Draw a floating interaction prompt above the player, showing what can be done */
  private drawInteractIndicator(ctx: CanvasRenderingContext2D, x: number, y: number, tileType: TileType): void {
    const bobOffset = Math.sin(this.animFrame * 0.3) * 4;
    const iy = Math.floor(y + bobOffset);
    const ix = Math.floor(x);

    const isChest = tileType === 'chest';
    const label = isChest ? '[R] Aç' : '[R] İn';
    const accentColor = isChest ? '#fbbf24' : '#38bdf8';

    // Measure text width
    const textW = measurePixelText(label);

    const pillW = Math.ceil(textW) + 10;
    const pillH = 12;
    const px = ix - Math.floor(pillW / 2);
    const py = iy - Math.floor(pillH / 2);

    // Pulsing glow behind
    const pulse = 0.5 + Math.sin(this.animFrame * 0.5) * 0.25;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = accentColor;
    ctx.fillRect(px - 3, py - 3, pillW + 6, pillH + 6);
    ctx.globalAlpha = 1;

    // Background pill
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(px, py, pillW, pillH);

    // Border
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 0.5;
    ctx.strokeRect(px, py, pillW, pillH);

    // Label text
    drawPixelText(ctx, ix - textW / 2, iy - PIXEL_FONT_HEIGHT / 2, label, accentColor);

    // Small arrow pointing down
    ctx.fillStyle = accentColor;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(ix - 1, iy + Math.floor(pillH / 2) + 1, 3, 3);
    ctx.fillRect(ix, iy + Math.floor(pillH / 2) + 4, 1, 2);
    ctx.globalAlpha = 1;
  }

  destroy(): void {
    this.particles.clear();
    this.damageNumbers.length = 0;
    this.prevHp.clear();
    this.prevEntityPositions.clear();
    this.fogCacheCanvas = null;
    this.fogCacheCtx = null;
    this.fogGradientCanvas = null;
    this.visionFalloffCanvas = null;
    this.grainCanvas = null;
    this.fogNoiseCanvas = null;
    this.torchPositions = [];
    this.clearDecorations();
  }
}

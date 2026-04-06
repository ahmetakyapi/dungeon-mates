// ==========================================
// Dungeon Mates — Main Canvas Renderer
// Pixel-art style, logical resolution scaled up
// Mobile-optimized with auto-quality, fog caching
// Visual effects: vignette, screen flash, ambient particles
// ==========================================

import type { GameState, PlayerState, MonsterState, ProjectileState, LootState, TileType } from '../../../shared/types';
import { TILE_SIZE, CLASS_STATS, MONSTER_STATS, LOOT_TABLE } from '../../../shared/types';
import { Camera } from './Camera';
import { SpriteRenderer } from './SpriteRenderer';
import { ParticleSystem } from './ParticleSystem';

// Logical render resolution
const LOGICAL_WIDTH_DESKTOP = 480;
const LOGICAL_HEIGHT_DESKTOP = 270;
const LOGICAL_WIDTH_MOBILE = 360;
const LOGICAL_HEIGHT_MOBILE = 240;

// Quality presets
const QUALITY_PRESETS = {
  low: { particles: false, fogSimple: true, fpsCap: 15, particleMax: 0, effects: false },
  medium: { particles: true, fogSimple: false, fpsCap: 45, particleMax: 96, effects: true },
  high: { particles: true, fogSimple: false, fpsCap: 60, particleMax: 256, effects: true },
} as const;

type QualityLevel = keyof typeof QUALITY_PRESETS;

// Damage number floating text
type DamageNumberKind = 'damage' | 'heal' | 'gold' | 'critical';

type DamageNumber = {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  kind: DamageNumberKind;
  scale: number;
};

const DAMAGE_NUMBER_DURATION = 0.9;
const MAX_DAMAGE_NUMBERS = 16;

// Fog of war tile cache
type FogState = 0 | 1 | 2; // 0 = hidden, 1 = explored, 2 = visible

// Performance monitor
const PERF_SAMPLE_COUNT = 30;
const PERF_CHECK_INTERVAL = 2000; // ms

// Vision radius for fog (reduced with darkness modifier)
const VISION_RADIUS = 8;
const VISION_RADIUS_DARKNESS = 4;

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

  // Frame timing for FPS cap
  private lastFrameTime = 0;

  // Screen flash effect
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

  // Pre-rendered vision falloff canvas (avoids createRadialGradient per player per frame)
  private visionFalloffCanvas: HTMLCanvasElement | null = null;
  private visionFalloffRadius = -1;

  // Environmental decorations (bloodSplatters uses circular buffer)
  private bloodSplatters: Array<{ x: number; y: number }> = [];
  private bloodSplatterIdx = 0;
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

    let resolvedKind: DamageNumberKind = kind ?? (isHealing ? 'heal' : 'damage');
    let color: string;
    let text: string;
    let scale = 1;

    switch (resolvedKind) {
      case 'heal':
        color = '#4ade80';
        text = `+${rounded}`;
        break;
      case 'gold':
        color = '#fbbf24';
        text = `+${rounded}g`;
        break;
      case 'critical':
        color = '#ff6b6b';
        text = `${rounded}!`;
        scale = 1.5;
        break;
      case 'damage':
      default:
        color = '#ef4444';
        text = `${rounded}`;
        resolvedKind = 'damage';
        break;
    }

    // Stack nearby numbers: offset Y if another number is very close
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
      text,
      color,
      life: DAMAGE_NUMBER_DURATION,
      maxLife: DAMAGE_NUMBER_DURATION,
      kind: resolvedKind,
      scale,
    });
  }

  /** Access the particle system for external effects */
  get particleSystem(): ParticleSystem {
    return this.particles;
  }

  /** Trigger camera shake */
  shake(intensity: number, duration: number): void {
    this.camera.shake(intensity, duration);
  }

  /** Trigger a freeze frame (hitstop) for the given duration in ms */
  public freezeFrame(durationMs: number): void {
    this.freezeFrameMs = Math.max(this.freezeFrameMs, durationMs);
  }

  /** Trigger a screen flash (white flash on big damage, etc.) */
  triggerScreenFlash(color = '#ffffff', intensity = 0.6): void {
    this.screenFlashAlpha = intensity;
    this.screenFlashColor = color;
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

    // 2b. Render torch light sources on floor (additive glow on top)
    if (preset.effects) {
      this.renderTorchLights(ctx, camX, camY);
    }

    // 2c. Highlight interactable tiles (chests, stairs) with pulsing glow
    this.renderInteractableHighlights(ctx, state, camX, camY, localPlayerId);

    // 3. Render loot
    this.renderLoot(ctx, lootArr, camX, camY);

    // 5. Render monsters
    this.renderMonsters(ctx, monstersArr, camX, camY);

    // 6. Render projectiles
    this.renderProjectiles(ctx, projectilesArr, camX, camY);

    // 7. Render players
    this.renderPlayers(ctx, playersArr, state, camX, camY, localPlayerId);

    // 8. Render particles
    if (preset.particles) {
      this.particles.render(ctx, camX, camY);
    }

    // 9. Render damage numbers
    this.renderDamageNumbers(ctx, camX, camY);

    // 10. Render fog of war (with gradient edges)
    this.renderFog(ctx, state, camX, camY, startTileX, startTileY, endTileX, endTileY, localPlayerId, playersArr);

    // 10b. Boss health bar at top of screen (after fog so it's always visible)
    if (isBossPhase) {
      this.drawBossHealthBar(ctx, monstersArr);
    }

    // 11. Post-processing effects (drawn on top of everything)
    if (preset.effects) {
      // Low HP (<25%): strong pulsing red vignette overlay
      if (localPlayer && localPlayer.alive) {
        const hpRatio = localPlayer.hp / localPlayer.maxHp;
        if (hpRatio < 0.25) {
          this.lowHpPulseTimer += dt * 3.5;
          const pulse = 0.5 + Math.sin(this.lowHpPulseTimer) * 0.5; // 0..1 pulse
          const baseIntensity = (1 - hpRatio / 0.25) * 0.4; // max 0.4 at 0 hp
          const intensity = baseIntensity * (0.5 + pulse * 0.5); // pulsing between 50%-100%
          this.renderRedVignette(ctx, intensity);
        } else if (hpRatio < 0.5) {
          // Subtle warning between 25-50%
          this.lowHpPulseTimer += dt * 2;
          const pulse = 0.5 + Math.sin(this.lowHpPulseTimer) * 0.5;
          const baseIntensity = (1 - hpRatio / 0.5) * 0.15;
          this.renderRedVignette(ctx, baseIntensity * (0.7 + pulse * 0.3));
        } else {
          this.lowHpPulseTimer = 0;
        }
      }

      // Boss room dramatic lighting (darker with red tint)
      if (isBossPhase) {
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);
        ctx.globalAlpha = 0.06;
        ctx.fillStyle = '#7f1d1d';
        ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);
        ctx.globalAlpha = 1;

        // Heat distortion effect (subtle wave via shifting scanlines)
        this.renderHeatDistortion(ctx, nowSec);
      }

      // Vignette effect — very subtle corner darkening
      if (isBossPhase) {
        this.renderVignette(ctx, 0.2);
      } else {
        this.renderVignette(ctx, 0.05);
      }

      // Subtle film grain overlay
      this.renderFilmGrain(ctx, dt);
    }

    // Screen flash overlay
    if (this.screenFlashAlpha > 0.01) {
      ctx.globalAlpha = this.screenFlashAlpha;
      ctx.fillStyle = this.screenFlashColor;
      ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);
      ctx.globalAlpha = 1;
    }

    // Boss entrance red flash
    if (this.bossEntranceFlash > 0.01) {
      ctx.globalAlpha = this.bossEntranceFlash * 0.4;
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);
      ctx.globalAlpha = 1;
    }

    // Loot pickup flash
    if (this.lootFlashAlpha > 0.01) {
      ctx.globalAlpha = this.lootFlashAlpha;
      ctx.fillStyle = this.lootFlashColor;
      ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);
      ctx.globalAlpha = 1;
    }

    ctx.restore(); // Pop zoom transform

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
    ctx.globalAlpha = 0.03; // very subtle
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
  addBloodSplatter(worldX: number, worldY: number): void {
    if (this.bloodSplatters.length >= 50) {
      // Overwrite oldest entry instead of shift() — O(1) vs O(n)
      this.bloodSplatters[this.bloodSplatterIdx] = { x: worldX, y: worldY };
      this.bloodSplatterIdx = (this.bloodSplatterIdx + 1) % 50;
    } else {
      this.bloodSplatters.push({ x: worldX, y: worldY });
    }
  }

  /** Trigger loot pickup screen flash */
  triggerLootFlash(color: string): void {
    this.lootFlashAlpha = 0.25;
    this.lootFlashColor = color;
  }

  /** Clear all decorations (called on floor change) */
  clearDecorations(): void {
    this.bloodSplatters = [];
    this.boneFragments = [];
    this.cobwebPositions = [];
    this.floorCracks = [];
  }

  /** Build environmental decorations for the current floor layout */
  private buildEnvironmentalDecor(state: GameState): void {
    const floorId = state.dungeon.currentFloor ?? 0;
    if (this.decorCacheFloor === floorId) return;
    this.decorCacheFloor = floorId;
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
    // Blood splatters
    for (let i = 0; i < this.bloodSplatters.length; i++) {
      const b = this.bloodSplatters[i];
      const sx = Math.floor(b.x - camX);
      const sy = Math.floor(b.y - camY);
      if (sx < -16 || sx > this.logicalWidth + 16 || sy < -16 || sy > this.logicalHeight + 16) continue;

      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#7f1d1d';
      // Irregular splatter shape (3-4 pixel cluster)
      ctx.fillRect(sx, sy, 2, 1);
      ctx.fillRect(sx - 1, sy + 1, 3, 1);
      ctx.fillRect(sx, sy + 2, 1, 1);
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#450a0a';
      ctx.fillRect(sx + 2, sy + 1, 1, 1);
      ctx.globalAlpha = 1;
    }

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

    for (let i = 0; i < this.torchPositions.length; i++) {
      const torch = this.torchPositions[i];
      const sx = torch.x - camX;
      const sy = torch.y - camY;

      // Skip off-screen torches
      if (sx < -30 || sx > this.logicalWidth + 30 || sy < -30 || sy > this.logicalHeight + 30) continue;

      // Warm-colored light circle — use cached torch light canvas
      const lightRadius = 24;
      const flicker = 1 + Math.sin(this.animFrame * 0.7 + i * 1.3) * 0.08;
      const r = lightRadius * flicker;
      if (!this._torchLightCanvas) {
        this._torchLightCanvas = document.createElement('canvas');
        const tlSize = 64;
        this._torchLightCanvas.width = tlSize;
        this._torchLightCanvas.height = tlSize;
        const tlCtx = this._torchLightCanvas.getContext('2d');
        if (tlCtx) {
          const gr = tlCtx.createRadialGradient(tlSize / 2, tlSize / 2, 0, tlSize / 2, tlSize / 2, tlSize / 2);
          gr.addColorStop(0, 'rgba(255,180,80,0.15)');
          gr.addColorStop(0.3, 'rgba(255,150,50,0.10)');
          gr.addColorStop(0.6, 'rgba(255,120,30,0.04)');
          gr.addColorStop(1, 'rgba(255,100,20,0)');
          tlCtx.fillStyle = gr;
          tlCtx.fillRect(0, 0, tlSize, tlSize);
        }
      }
      ctx.drawImage(this._torchLightCanvas, sx - r, sy - r, r * 2, r * 2);

      // Enhanced flame sprite (5x8px, animated 3 patterns)
      this.drawEnhancedFlame(ctx, Math.floor(sx) - 2, Math.floor(sy) - 8, this.torchFlameFrame, i);

      // Smoke wisps above flame (2-3 gray pixels rising)
      const smokeAlpha = 0.2 + Math.sin(this.animFrame * 0.5 + i * 2) * 0.1;
      ctx.globalAlpha = smokeAlpha;
      ctx.fillStyle = '#6b7280';
      ctx.fillRect(Math.floor(sx) + (this.torchFlameFrame % 2), Math.floor(sy) - 11, 1, 1);
      ctx.fillRect(Math.floor(sx) - 1 + ((this.torchFlameFrame + 1) % 2), Math.floor(sy) - 13, 1, 1);
      if (this.torchFlameFrame === 2) {
        ctx.fillRect(Math.floor(sx) + 1, Math.floor(sy) - 14, 1, 1);
      }
      ctx.globalAlpha = 1;
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
        // Same hash logic as SpriteRenderer to match torch placement
        const sx = tx * TILE_SIZE;
        const sy = ty * TILE_SIZE;
        const hash = this.tileHash(Math.floor(sx / TILE_SIZE + 1000), Math.floor(sy / TILE_SIZE + 1000));
        if ((hash >> 8) % 7 === 0) {
          // Torch at this wall tile
          this.torchPositions.push({
            x: sx + 7, // center of torch drawing
            y: sy + 3,
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
    gradient.addColorStop(0.6, 'rgba(0,0,0,0.3)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.8)');
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

    if (avg > 20 && this.quality === 'high') {
      this.setQuality('medium');
    } else if (avg > 30 && this.quality === 'medium') {
      this.setQuality('low');
    } else if (avg < 10 && this.quality === 'medium') {
      this.setQuality('high');
    } else if (avg < 16 && this.quality === 'low') {
      this.setQuality('medium');
    }
  }

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

  /** Render glowing highlights around interactable tiles (chests, stairs) */
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
        ctx.font = 'bold 4px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        // Shadow for readability
        ctx.fillStyle = '#000000';
        ctx.fillText(lootInfo.label, labelX + 0.5, labelY + bobY + 0.5);
        // Colored label
        ctx.fillStyle = lootInfo.color;
        ctx.fillText(lootInfo.label, labelX, labelY + bobY);
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
  ): void {
    const isFrozen = this.freezeFrameMs > 0;
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
        monRenderX = monster.position.x;
        monRenderY = monster.position.y;
        if (prevMonPos) {
          monRenderX = prevMonPos.x + (monster.position.x - prevMonPos.x) * 0.35;
          monRenderY = prevMonPos.y + (monster.position.y - prevMonPos.y) * 0.35;
        }
        if (prevMonPos) {
          prevMonPos.x = monRenderX;
          prevMonPos.y = monRenderY;
        } else {
          this.prevEntityPositions.set(monster.id, { x: monRenderX, y: monRenderY });
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

      // Heuristic: monster is attacking when it has a target and velocity is near zero (in melee range)
      const velMag = Math.abs(monster.velocity.x) + Math.abs(monster.velocity.y);
      const isAttacking = monster.targetPlayerId !== null && velMag < 0.02;

      // Elite golden glow — drawn before monster sprite
      if (monster.isElite) {
        const glowAlpha = 0.3 + Math.sin(this.animFrame * 0.15) * 0.15;
        ctx.save();
        ctx.globalAlpha = glowAlpha;
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 12;
        ctx.fillStyle = 'rgba(251, 191, 36, 0.15)';
        ctx.beginPath();
        ctx.arc(sx + renderSize / 2, sy + renderSize / 2, renderSize * 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      this.sprites.drawMonster(ctx, sx, sy, monster.type, monster.facing, this.animFrame, flashWhite, isAttacking, monster.isElite);

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

  private renderPlayers(
    ctx: CanvasRenderingContext2D,
    players: PlayerState[],
    state: GameState,
    camX: number,
    camY: number,
    localPlayerId: string,
  ): void {
    const isFrozen = this.freezeFrameMs > 0;
    for (let i = 0; i < players.length; i++) {
      const player: PlayerState = players[i];
      if (!player.alive) continue;

      // Smooth position interpolation (skip during freeze frame)
      const prevPlrPos = this.prevEntityPositions.get(player.id);
      let plrRenderX: number;
      let plrRenderY: number;
      if (isFrozen && prevPlrPos) {
        plrRenderX = prevPlrPos.x;
        plrRenderY = prevPlrPos.y;
      } else {
        plrRenderX = player.position.x;
        plrRenderY = player.position.y;
        if (prevPlrPos) {
          plrRenderX = prevPlrPos.x + (player.position.x - prevPlrPos.x) * 0.35;
          plrRenderY = prevPlrPos.y + (player.position.y - prevPlrPos.y) * 0.35;
        }
        if (prevPlrPos) {
          prevPlrPos.x = plrRenderX;
          prevPlrPos.y = plrRenderY;
        } else {
          this.prevEntityPositions.set(player.id, { x: plrRenderX, y: plrRenderY });
        }
      }

      const wx = plrRenderX * TILE_SIZE;
      const wy = plrRenderY * TILE_SIZE;
      if (!this.camera.isVisible(wx, wy, TILE_SIZE, TILE_SIZE)) continue;

      const sx = Math.floor(wx - camX);
      const sy = Math.floor(wy - camY);

      const prevHp = this.prevHp.get(player.id);
      const flashWhite = prevHp !== undefined && prevHp > player.hp;

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

      this.sprites.drawPlayer(
        ctx, sx, sy,
        player.class,
        player.facing,
        player.attacking,
        this.animFrame,
        flashWhite,
        player.abilityActive,
      );

      // Shield shimmer particles for warrior ability
      if (player.abilityActive && player.class === 'warrior') {
        this.particles.emitShieldShimmer(wx + TILE_SIZE / 2, wy + TILE_SIZE / 2);
      }

      // Speed boost trail particles
      if (player.speedBoosted) {
        this.particles.emitSpeedTrail(wx + TILE_SIZE / 2, wy + TILE_SIZE / 2);
      }

      this.drawNameTag(ctx, sx + TILE_SIZE / 2, sy - 6, player.name, player.id === localPlayerId);
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
  ): void {
    ctx.font = '4px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    const textWidth = ctx.measureText(name).width;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(Math.floor(x - textWidth / 2 - 1), Math.floor(y - 5), Math.ceil(textWidth + 2), 6);

    ctx.fillStyle = isLocal ? '#fbbf24' : '#e5e7eb';
    ctx.fillText(name, Math.floor(x), Math.floor(y));
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
    const boss = monsters.find(m => m.type === 'boss_demon' && m.alive);
    if (!boss) return;

    const barWidth = Math.floor(this.logicalWidth * 0.5);
    const barHeight = 6;
    const barX = Math.floor((this.logicalWidth - barWidth) / 2);
    const barY = 8;
    const ratio = Math.max(0, boss.hp / boss.maxHp);

    // Name label
    ctx.font = 'bold 5px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = '#000000';
    ctx.fillText('MOR\'KHAN', this.logicalWidth / 2 + 1, barY - 2 + 1);
    ctx.fillStyle = '#ef4444';
    ctx.fillText('MOR\'KHAN', this.logicalWidth / 2, barY - 2);

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
      const floatY = progress * 16;

      // Scale-up animation: start at scale, shrink to 1x
      const scaleProgress = Math.min(1, progress * 5); // first 20% of life
      const currentScale = dn.scale + (1 - dn.scale) * scaleProgress;

      // Alpha: fade out in last 40%
      const alpha = progress < 0.6 ? 1 : Math.max(0, 1 - (progress - 0.6) / 0.4);
      ctx.globalAlpha = alpha;

      // Font size based on kind
      const baseSize = dn.kind === 'critical' ? 7 : 6;
      const fontSize = Math.round(baseSize * currentScale);
      ctx.font = `bold ${fontSize}px monospace`;

      const dx = Math.floor(dn.x - camX);
      const dy = Math.floor(dn.y - camY - floatY);

      // Shadow/outline for readability
      ctx.fillStyle = '#000000';
      ctx.fillText(dn.text, dx + 1, dy + 1);
      ctx.fillText(dn.text, dx - 1, dy - 1);
      ctx.fillText(dn.text, dx + 1, dy - 1);
      ctx.fillText(dn.text, dx - 1, dy + 1);

      // Main color
      ctx.fillStyle = dn.color;
      ctx.fillText(dn.text, dx, dy);

      // Critical hit screen shake (triggered in addDamageNumber caller)
    }
    ctx.globalAlpha = 1;
  }

  private updateDamageNumbers(dt: number): void {
    // Swap-with-last removal pattern — O(1) per removal instead of O(n) splice
    let i = 0;
    while (i < this.damageNumbers.length) {
      this.damageNumbers[i].life -= dt;
      if (this.damageNumbers[i].life <= 0) {
        // Swap with last element and pop (O(1))
        this.damageNumbers[i] = this.damageNumbers[this.damageNumbers.length - 1];
        this.damageNumbers.pop();
        // Don't increment i — re-check swapped element
      } else {
        i++;
      }
    }
  }

  private updateFog(state: GameState, localPlayerId: string, playersArr: PlayerState[]): void {
    const dw = state.dungeon.width;
    const dh = state.dungeon.height;

    if (this.fogGrid.length !== dh || (this.fogGrid[0] && this.fogGrid[0].length !== dw)) {
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

    // Check if player has moved (for fog cache invalidation)
    const localPlayer = state.players[localPlayerId];
    if (localPlayer) {
      const ptx = Math.floor(localPlayer.position.x);
      const pty = Math.floor(localPlayer.position.y);
      if (ptx !== this.fogCachePlayerTileX || pty !== this.fogCachePlayerTileY) {
        this.fogCacheDirty = true;
        this.fogCachePlayerTileX = ptx;
        this.fogCachePlayerTileY = pty;
      }
    }

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
    // Fog rendering: hidden = opaque black, explored = light dim, visible = no overlay
    // Visible tiles (state 2) get NO fog overlay — tiles show at full brightness
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
              // Hidden: fully opaque dark
              ctx.fillStyle = '#0a0e1a';
              ctx.fillRect(sx, sy, runW, TILE_SIZE);
            } else {
              // Explored: very light dim (tiles still clearly visible)
              ctx.globalAlpha = 0.2;
              ctx.fillStyle = '#0a0e1a';
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

    // Gradient fog edges (soft transition from visible to fog) — very subtle
    const isSimple = QUALITY_PRESETS[this.quality].fogSimple;
    if (!isSimple) {
      this.renderFogGradientEdges(ctx, state, camX, camY, startX, startY, endX, endY, playersArr);
    }
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
    // Very subtle border darkening at visible/non-visible boundary
    const dw = state.dungeon.width;
    const dh = state.dungeon.height;
    ctx.globalAlpha = 0.04;
    ctx.fillStyle = '#0a0e1a';
    for (let ty = startY; ty < endY; ty++) {
      const fogRow = this.fogGrid[ty];
      if (!fogRow) continue;
      const rowAbove = ty > 0 ? this.fogGrid[ty - 1] : null;
      const rowBelow = ty < dh - 1 ? this.fogGrid[ty + 1] : null;

      let batchStart = -1;
      for (let tx = startX; tx <= endX; tx++) {
        let isBorder = false;
        if (tx < endX && fogRow[tx] === 2) {
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
          const sx = batchStart * TILE_SIZE - camX;
          const sy2 = ty * TILE_SIZE - camY;
          ctx.fillRect(sx, sy2, (tx - batchStart) * TILE_SIZE, TILE_SIZE);
          batchStart = -1;
        }
      }
    }
    ctx.globalAlpha = 1;

    // Very subtle radial vision falloff — almost invisible, just a hint of darkness at edges
    const visionPx = this.currentVisionRadius * TILE_SIZE;
    const extendedVision = visionPx * 1.3;
    const falloffSize = Math.ceil(extendedVision * 2);

    if (!this.visionFalloffCanvas || this.visionFalloffRadius !== falloffSize) {
      this.visionFalloffRadius = falloffSize;
      this.visionFalloffCanvas = document.createElement('canvas');
      this.visionFalloffCanvas.width = falloffSize;
      this.visionFalloffCanvas.height = falloffSize;
      const vCtx = this.visionFalloffCanvas.getContext('2d');
      if (vCtx) {
        const cx = falloffSize / 2;
        const cy = falloffSize / 2;
        const grad = vCtx.createRadialGradient(cx, cy, visionPx * 0.7, cx, cy, extendedVision);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(0.8, 'rgba(0,0,0,0)');
        grad.addColorStop(0.95, 'rgba(6,8,16,0.03)');
        grad.addColorStop(1, 'rgba(6,8,16,0.08)');
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

  private detectHpChanges(state: GameState, localPlayerId: string, players: PlayerState[], monsters: MonsterState[]): void {
    const preset = QUALITY_PRESETS[this.quality];

    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      const prev = this.prevHp.get(p.id);
      if (prev !== undefined && prev !== p.hp) {
        const diff = prev - p.hp;
        const wx = p.position.x * TILE_SIZE + TILE_SIZE / 2;
        const wy = p.position.y * TILE_SIZE;
        if (diff > 0) {
          // Critical hit detection (>25% of max HP in one hit)
          const isCritical = diff > p.maxHp * 0.25;
          this.addDamageNumber(wx, wy, diff, false, isCritical ? 'critical' : 'damage');
          if (preset.particles) {
            this.particles.emitHit(wx, wy);
            // Blood/damage particles at player position
            this.particles.emitBloodSplatter(wx, wy + TILE_SIZE / 2);
            if (isCritical) {
              this.particles.emitHitSpark(wx, wy + TILE_SIZE / 2);
            }
          }
          // Camera shake on player damage (stronger for criticals)
          if (isCritical) {
            this.camera.shake(8, 300);
          } else {
            this.camera.shakeTakeDamage();
          }

          // Screen flash on player damage (intensity scales with severity)
          if (p.id === localPlayerId) {
            if (diff > p.maxHp * 0.3) {
              this.triggerScreenFlash('#ffffff', 0.5);
              this.freezeFrame(60);
            } else if (isCritical) {
              this.triggerScreenFlash('#ffffff', 0.25);
              this.freezeFrame(60);
            } else {
              this.triggerScreenFlash('#ffffff', 0.15);
            }
          }
        } else {
          this.addDamageNumber(wx, wy, Math.abs(diff), true, 'heal');
          if (preset.particles) {
            this.particles.emitHealEffect(wx, wy + TILE_SIZE / 2);
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
        if (diff > 0) {
          // Critical hit on monster (>30% of max HP)
          const isCrit = diff > m.maxHp * 0.3;
          this.addDamageNumber(wx, wy, diff, false, isCrit ? 'critical' : 'damage');
          if (preset.particles) {
            this.particles.emitHit(wx, wy, MONSTER_STATS[m.type].color);
          }
          // Screen shake on hit impact (stronger for bosses)
          if (m.type.startsWith('boss_')) {
            this.camera.shake(4, 200);
            this.freezeFrame(35);
          } else {
            this.camera.shake(1, 80);
          }
        }
      }
      if (prev !== undefined && m.hp <= 0 && (prev > 0)) {
        const wx = m.position.x * TILE_SIZE + TILE_SIZE / 2;
        const wy = m.position.y * TILE_SIZE + TILE_SIZE / 2;
        if (preset.particles) {
          this.particles.emitDeath(wx, wy, MONSTER_STATS[m.type].color);
        }
        // Add blood splatter at death location
        this.addBloodSplatter(wx, wy);
        // Boss death = big shake
        if (m.type.startsWith('boss_')) {
          this.camera.shakeBossSlam();
          this.triggerScreenFlash('#ffffff', 0.7);
          this.freezeFrame(80);
        } else {
          this.camera.shake(3, 150);
          this.triggerScreenFlash('#ffffff', 0.12);
          this.freezeFrame(50);
        }
      }
      this.prevHp.set(m.id, m.hp);
    }

    // Clean up
    for (const id of this.prevHp.keys()) {
      if (!state.players[id] && !state.monsters[id]) {
        this.prevHp.delete(id);
      }
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
    ctx.font = 'bold 6px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const textW = ctx.measureText(label).width;

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
    ctx.fillStyle = accentColor;
    ctx.fillText(label, ix, iy);

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

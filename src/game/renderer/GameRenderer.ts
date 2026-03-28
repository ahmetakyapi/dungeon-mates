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
const LOGICAL_WIDTH_MOBILE = 280;
const LOGICAL_HEIGHT_MOBILE = 210;

// Quality presets
const QUALITY_PRESETS = {
  low: { particles: false, fogSimple: true, fpsCap: 15, particleMax: 0, effects: false },
  medium: { particles: true, fogSimple: false, fpsCap: 30, particleMax: 64, effects: true },
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

const DAMAGE_NUMBER_DURATION = 1.2;
const MAX_DAMAGE_NUMBERS = 32;

// Fog of war tile cache
type FogState = 0 | 1 | 2; // 0 = hidden, 1 = explored, 2 = visible

// Performance monitor
const PERF_SAMPLE_COUNT = 30;
const PERF_CHECK_INTERVAL = 2000; // ms

// Vision radius for fog
const VISION_RADIUS = 8;

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

  // Film grain noise canvas (pre-generated, cycled)
  private grainCanvas: HTMLCanvasElement | null = null;
  private grainPhase = 0;

  // Low HP vignette pulse timer
  private lowHpPulseTimer = 0;

  // Torch flame animation frame
  private torchFlameFrame = 0;
  private torchFlameTimer = 0;

  // Pre-created radial gradient canvas for fog (avoids creating gradients per-frame)
  private fogGradientCanvas: HTMLCanvasElement | null = null;

  // Lighting overlay canvas
  private lightingCanvas: HTMLCanvasElement | null = null;
  private lightingCtx: CanvasRenderingContext2D | null = null;

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

    // Auto-detect quality on mobile
    if (this.isMobile) {
      this.quality = 'medium';
    }

    // Pre-create fog gradient canvas
    this.createFogGradientCanvas();

    // Pre-create film grain canvas
    this.createGrainCanvas();

    // Create lighting overlay canvas
    this.lightingCanvas = document.createElement('canvas');
    this.lightingCanvas.width = this.logicalWidth;
    this.lightingCanvas.height = this.logicalHeight;
    this.lightingCtx = this.lightingCanvas.getContext('2d');
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
      this.damageNumbers.shift();
    }

    let resolvedKind: DamageNumberKind = kind ?? (isHealing ? 'heal' : 'damage');
    let color: string;
    let text: string;
    let scale = 1;

    switch (resolvedKind) {
      case 'heal':
        color = '#4ade80';
        text = `+${amount}`;
        break;
      case 'gold':
        color = '#fbbf24';
        text = `+${amount}g`;
        break;
      case 'critical':
        color = '#ff6b6b';
        text = `${amount}!`;
        scale = 1.5;
        break;
      case 'damage':
      default:
        color = '#ef4444';
        text = `${amount}`;
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
        const monsters = Object.values(state.monsters);
        for (let i = 0; i < monsters.length; i++) {
          const m = monsters[i];
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
      this.emitProjectileTrails(state);
    }

    // Decay screen flash
    if (this.screenFlashAlpha > 0) {
      this.screenFlashAlpha = Math.max(0, this.screenFlashAlpha - dt * 6); // ~0.1s decay
    }

    // Detect HP changes for flash effects + damage numbers
    this.detectHpChanges(state, localPlayerId);

    // Update fog of war
    this.updateFog(state, localPlayerId);

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

    // 2. Render torch light sources on floor (additive glow on top)
    if (preset.effects) {
      this.renderTorchLights(ctx, camX, camY);
    }

    // 3. Render loot
    this.renderLoot(ctx, state, camX, camY);

    // 5. Render monsters
    this.renderMonsters(ctx, state, camX, camY);

    // 6. Render projectiles
    this.renderProjectiles(ctx, state, camX, camY);

    // 7. Render players
    this.renderPlayers(ctx, state, camX, camY, localPlayerId);

    // 8. Render particles
    if (preset.particles) {
      this.particles.render(ctx, camX, camY);
    }

    // 9. Render damage numbers
    this.renderDamageNumbers(ctx, camX, camY);

    // 10. Render fog of war (with gradient edges)
    this.renderFog(ctx, state, camX, camY, startTileX, startTileY, endTileX, endTileY, localPlayerId);

    // 11. Post-processing effects (drawn on top of everything)
    if (preset.effects) {
      // Low HP: pulsing red vignette (not flat tint)
      if (localPlayer && localPlayer.alive) {
        const hpRatio = localPlayer.hp / localPlayer.maxHp;
        if (hpRatio < 0.5) {
          this.lowHpPulseTimer += dt * 3;
          const pulse = 0.5 + Math.sin(this.lowHpPulseTimer) * 0.5; // 0..1 pulse
          const baseIntensity = (1 - hpRatio / 0.5) * 0.3; // max 0.3 at 0 hp
          const intensity = baseIntensity * (0.6 + pulse * 0.4); // pulsing between 60%-100%
          this.renderRedVignette(ctx, intensity);
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

      // Vignette effect during boss fights
      if (isBossPhase) {
        this.renderVignette(ctx, 0.4);
      } else {
        // Subtle vignette always
        this.renderVignette(ctx, 0.15);
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

    ctx.restore(); // Pop zoom transform

    // --- Scale offscreen to main canvas ---
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.drawImage(this.offscreen, 0, 0, this.canvas.width, this.canvas.height);

    // Auto-quality adjustment
    const frameTime = performance.now() - frameStart;
    this.monitorPerformance(frameTime);
  }

  // ===== VISUAL EFFECTS =====

  /** Render dark vignette (dark corners) */
  private renderVignette(ctx: CanvasRenderingContext2D, intensity: number): void {
    const w = this.logicalWidth;
    const h = this.logicalHeight;
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.max(cx, cy);

    const gradient = ctx.createRadialGradient(cx, cy, radius * 0.4, cx, cy, radius * 1.2);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, `rgba(0,0,0,${intensity})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  }

  /** Render pulsing red vignette for low HP */
  private renderRedVignette(ctx: CanvasRenderingContext2D, intensity: number): void {
    const w = this.logicalWidth;
    const h = this.logicalHeight;
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.max(cx, cy);

    const gradient = ctx.createRadialGradient(cx, cy, radius * 0.3, cx, cy, radius * 1.1);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(0.5, 'rgba(127,29,29,0)');
    gradient.addColorStop(1, `rgba(220,38,38,${intensity})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
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

  /** Create grain noise canvas (small, tiled) */
  private createGrainCanvas(): void {
    const size = 64;
    if (!this.grainCanvas) {
      this.grainCanvas = document.createElement('canvas');
      this.grainCanvas.width = size;
      this.grainCanvas.height = size;
    }
    const gCtx = this.grainCanvas.getContext('2d');
    if (!gCtx) return;
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
  }

  /** Render heat distortion for boss room (subtle horizontal scanline shift) */
  private renderHeatDistortion(ctx: CanvasRenderingContext2D, time: number): void {
    // Very subtle: shift a few scanlines horizontally by 1px based on sine wave
    const w = this.logicalWidth;
    const h = this.logicalHeight;
    ctx.globalAlpha = 0.04;
    for (let y = 0; y < h; y += 4) {
      const shift = Math.sin(time * 2 + y * 0.15) * 1.5;
      ctx.drawImage(this.offscreen, 0, y, w, 2, shift, y, w, 2);
    }
    ctx.globalAlpha = 1;
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

      // Warm-colored light circle (larger, warmer tint)
      const lightRadius = 24;
      const flicker = 1 + Math.sin(this.animFrame * 0.7 + i * 1.3) * 0.08;
      const r = lightRadius * flicker;
      const gradient = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
      gradient.addColorStop(0, 'rgba(255,180,80,0.15)');
      gradient.addColorStop(0.3, 'rgba(255,150,50,0.10)');
      gradient.addColorStop(0.6, 'rgba(255,120,30,0.04)');
      gradient.addColorStop(1, 'rgba(255,100,20,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(sx - r, sy - r, r * 2, r * 2);

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

  /** Dynamic lighting system -- creates atmospheric dungeon lighting */
  private renderLighting(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    camX: number,
    camY: number,
    localPlayerId: string,
    isBossPhase: boolean,
  ): void {
    const lCtx = this.lightingCtx;
    const lCanvas = this.lightingCanvas;
    if (!lCtx || !lCanvas) return;

    if (lCanvas.width !== this.logicalWidth || lCanvas.height !== this.logicalHeight) {
      lCanvas.width = this.logicalWidth;
      lCanvas.height = this.logicalHeight;
    }

    lCtx.globalCompositeOperation = 'source-over';
    lCtx.fillStyle = 'rgba(0,0,0,0.35)';
    lCtx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);

    lCtx.globalCompositeOperation = 'destination-out';

    for (let i = 0; i < this.torchPositions.length; i++) {
      const torch = this.torchPositions[i];
      const sx = torch.x - camX;
      const sy = torch.y - camY;
      if (sx < -50 || sx > this.logicalWidth + 50 || sy < -50 || sy > this.logicalHeight + 50) continue;
      const flickerScale = 1 + Math.sin(this.animFrame * 0.7 + i * 1.3) * 0.06;
      const radius = 40 * flickerScale;
      const gradient = lCtx.createRadialGradient(sx, sy, 0, sx, sy, radius);
      gradient.addColorStop(0, 'rgba(0,0,0,0.9)');
      gradient.addColorStop(0.3, 'rgba(0,0,0,0.6)');
      gradient.addColorStop(0.6, 'rgba(0,0,0,0.3)');
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      lCtx.fillStyle = gradient;
      lCtx.fillRect(sx - radius, sy - radius, radius * 2, radius * 2);
    }

    const lp = state.players[localPlayerId];
    if (lp && lp.alive) {
      const plx = lp.position.x * TILE_SIZE + TILE_SIZE / 2 - camX;
      const ply = lp.position.y * TILE_SIZE + TILE_SIZE / 2 - camY;
      const playerRadius = 30;
      const pg = lCtx.createRadialGradient(plx, ply, 0, plx, ply, playerRadius);
      pg.addColorStop(0, 'rgba(0,0,0,0.7)');
      pg.addColorStop(0.4, 'rgba(0,0,0,0.4)');
      pg.addColorStop(0.7, 'rgba(0,0,0,0.15)');
      pg.addColorStop(1, 'rgba(0,0,0,0)');
      lCtx.fillStyle = pg;
      lCtx.fillRect(plx - playerRadius, ply - playerRadius, playerRadius * 2, playerRadius * 2);
    }

    const allP = Object.values(state.players);
    for (let i = 0; i < allP.length; i++) {
      const p = allP[i];
      if (!p.alive || p.id === localPlayerId) continue;
      const ppx = p.position.x * TILE_SIZE + TILE_SIZE / 2 - camX;
      const ppy = p.position.y * TILE_SIZE + TILE_SIZE / 2 - camY;
      const oR = 24;
      const og = lCtx.createRadialGradient(ppx, ppy, 0, ppx, ppy, oR);
      og.addColorStop(0, 'rgba(0,0,0,0.5)');
      og.addColorStop(0.5, 'rgba(0,0,0,0.2)');
      og.addColorStop(1, 'rgba(0,0,0,0)');
      lCtx.fillStyle = og;
      lCtx.fillRect(ppx - oR, ppy - oR, oR * 2, oR * 2);
    }

    const lootArr = Object.values(state.loot);
    for (let i = 0; i < lootArr.length; i++) {
      const lt = lootArr[i];
      const lx = lt.position.x * TILE_SIZE + TILE_SIZE / 2 - camX;
      const ly = lt.position.y * TILE_SIZE + TILE_SIZE / 2 - camY;
      if (lx < -16 || lx > this.logicalWidth + 16 || ly < -16 || ly > this.logicalHeight + 16) continue;
      const lr = 10;
      const lg = lCtx.createRadialGradient(lx, ly, 0, lx, ly, lr);
      lg.addColorStop(0, 'rgba(0,0,0,0.5)');
      lg.addColorStop(0.6, 'rgba(0,0,0,0.2)');
      lg.addColorStop(1, 'rgba(0,0,0,0)');
      lCtx.fillStyle = lg;
      lCtx.fillRect(lx - lr, ly - lr, lr * 2, lr * 2);
    }

    if (isBossPhase) {
      const mons = Object.values(state.monsters);
      for (let i = 0; i < mons.length; i++) {
        const m = mons[i];
        if (m.type === 'boss_demon' && m.alive) {
          const bx = m.position.x * TILE_SIZE + TILE_SIZE - camX;
          const by = m.position.y * TILE_SIZE + TILE_SIZE - camY;
          const bR = 50;
          const bPulse = 1 + Math.sin(this.animFrame * 0.4) * 0.1;
          const bg = lCtx.createRadialGradient(bx, by, 0, bx, by, bR * bPulse);
          bg.addColorStop(0, 'rgba(0,0,0,0.8)');
          bg.addColorStop(0.4, 'rgba(0,0,0,0.4)');
          bg.addColorStop(0.7, 'rgba(0,0,0,0.15)');
          bg.addColorStop(1, 'rgba(0,0,0,0)');
          lCtx.fillStyle = bg;
          lCtx.fillRect(bx - bR, by - bR, bR * 2, bR * 2);
        }
      }
    }

    lCtx.globalCompositeOperation = 'source-over';
    ctx.drawImage(lCanvas, 0, 0);
  }

  /** Emit trail particles for active projectiles */
  private emitProjectileTrails(state: GameState): void {
    const projectiles = Object.values(state.projectiles);
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
    this.frameTimes.push(frameTimeMs);
    if (this.frameTimes.length > PERF_SAMPLE_COUNT) {
      this.frameTimes.shift();
    }

    const now = performance.now();
    if (now - this.lastPerfCheck < PERF_CHECK_INTERVAL) return;
    this.lastPerfCheck = now;

    if (this.frameTimes.length < PERF_SAMPLE_COUNT) return;

    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;

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
    const clearedRooms = new Set<number>();
    for (const room of state.dungeon.rooms) {
      if (room.cleared) clearedRooms.add(room.id);
    }
    const currentRoom = state.dungeon.rooms.find(r => r.id === state.currentRoomId);
    const roomCleared = currentRoom ? currentRoom.cleared : false;

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

  private renderLoot(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    camX: number,
    camY: number,
  ): void {
    const preset = QUALITY_PRESETS[this.quality];
    const lootEntries = Object.values(state.loot);
    for (let i = 0; i < lootEntries.length; i++) {
      const loot: LootState = lootEntries[i];
      const wx = loot.position.x * TILE_SIZE;
      const wy = loot.position.y * TILE_SIZE;
      if (!this.camera.isVisible(wx, wy, TILE_SIZE, TILE_SIZE)) continue;
      this.sprites.drawLoot(ctx, wx - camX, wy - camY, loot.type, this.animFrame);

      // Loot glow particle (throttled: 1 per loot every 4 anim frames)
      if (preset.particles && this.animFrame % 4 === i % 4) {
        const lootColor = LOOT_TABLE[loot.type]?.color ?? '#fbbf24';
        this.particles.emitLootGlow(wx + TILE_SIZE / 2, wy, lootColor);
      }
    }
  }

  private renderMonsters(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    camX: number,
    camY: number,
  ): void {
    const monsters = Object.values(state.monsters);
    for (let i = 0; i < monsters.length; i++) {
      const monster: MonsterState = monsters[i];
      if (!monster.alive) continue;

      const wx = monster.position.x * TILE_SIZE;
      const wy = monster.position.y * TILE_SIZE;
      const stats = MONSTER_STATS[monster.type];
      const renderSize = TILE_SIZE * stats.size;

      if (!this.camera.isVisible(wx, wy, renderSize, renderSize)) continue;

      const sx = Math.floor(wx - camX);
      const sy = Math.floor(wy - camY);

      const prevHp = this.prevHp.get(monster.id);
      const flashWhite = prevHp !== undefined && prevHp > monster.hp;

      this.sprites.drawMonster(ctx, sx, sy, monster.type, monster.facing, this.animFrame, flashWhite);

      if (monster.hp < monster.maxHp) {
        this.drawHealthBar(ctx, sx, sy - 3, Math.floor(renderSize), monster.hp, monster.maxHp);
      }
    }
  }

  private renderProjectiles(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    camX: number,
    camY: number,
  ): void {
    const projectiles = Object.values(state.projectiles);
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
    state: GameState,
    camX: number,
    camY: number,
    localPlayerId: string,
  ): void {
    const players = Object.values(state.players);
    for (let i = 0; i < players.length; i++) {
      const player: PlayerState = players[i];
      if (!player.alive) continue;

      const wx = player.position.x * TILE_SIZE;
      const wy = player.position.y * TILE_SIZE;
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
      this.drawHealthBar(ctx, sx, sy + TILE_SIZE + 1, TILE_SIZE, player.hp, player.maxHp);

      // "R" interaction indicator for local player near chests/stairs
      if (player.id === localPlayerId) {
        const interactable = this.getNearbyInteractable(state, player.position.x, player.position.y);
        if (interactable) {
          this.drawInteractIndicator(ctx, sx + TILE_SIZE / 2, sy - 14);
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
  ): void {
    const isBoss = maxHp >= 200;
    const barHeight = isBoss ? 6 : 4;
    const ratio = Math.max(0, hp / maxHp);

    // Background with 1px dark border
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(x - 1, y - 1, width + 2, barHeight + 2);

    // Inner background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(x, y, width, barHeight);

    // Health fill with gradient coloring
    const filledWidth = Math.ceil(width * ratio);
    if (filledWidth > 0) {
      // Color based on health ratio
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
      ctx.fillRect(x, y, filledWidth, Math.floor(barHeight / 2));
      ctx.globalAlpha = 1;

      // Inner shadow at top of bar
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = '#000000';
      ctx.fillRect(x, y, filledWidth, 1);
      ctx.globalAlpha = 1;
    }

    // Boss health bar pulsing glow when low
    if (isBoss && ratio < 0.3 && ratio > 0) {
      const pulse = 0.1 + Math.sin(Date.now() * 0.005) * 0.06;
      ctx.globalAlpha = pulse;
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(x - 2, y - 2, width + 4, barHeight + 4);
      ctx.globalAlpha = 1;
    }

    // Outer border
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(x - 1, y - 1, width + 2, barHeight + 2);
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
    for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
      this.damageNumbers[i].life -= dt;
      if (this.damageNumbers[i].life <= 0) {
        this.damageNumbers.splice(i, 1);
      }
    }
  }

  private updateFog(state: GameState, localPlayerId: string): void {
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
    const players = Object.values(state.players);

    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (!p.alive) continue;
      const px = Math.floor(p.position.x);
      const py = Math.floor(p.position.y);

      for (let dy = -VISION_RADIUS; dy <= VISION_RADIUS; dy++) {
        for (let dx = -VISION_RADIUS; dx <= VISION_RADIUS; dx++) {
          if (dx * dx + dy * dy > VISION_RADIUS * VISION_RADIUS) continue;
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
  ): void {
    const isSimple = QUALITY_PRESETS[this.quality].fogSimple;

    // Render basic fog tiles
    for (let ty = startY; ty < endY; ty++) {
      const fogRow = this.fogGrid[ty];
      if (!fogRow) continue;
      for (let tx = startX; tx < endX; tx++) {
        const fog = fogRow[tx];
        if (fog === 2) continue;

        const sx = tx * TILE_SIZE - camX;
        const sy = ty * TILE_SIZE - camY;

        if (fog === 0) {
          ctx.fillStyle = '#000000';
          ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
        } else {
          ctx.fillStyle = isSimple ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.6)';
          ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
        }
      }
    }

    // Gradient fog edges (soft transition from visible to fog)
    if (!isSimple) {
      this.renderFogGradientEdges(ctx, state, camX, camY, startX, startY, endX, endY);
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
  ): void {
    // For each visible tile that borders a non-visible tile, draw a soft gradient
    for (let ty = startY; ty < endY; ty++) {
      const fogRow = this.fogGrid[ty];
      if (!fogRow) continue;
      for (let tx = startX; tx < endX; tx++) {
        if (fogRow[tx] !== 2) continue;

        // Check if any neighbor is not fully visible
        let hasHiddenNeighbor = false;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const ny = ty + dy;
            const nx = tx + dx;
            if (ny < 0 || ny >= state.dungeon.height || nx < 0 || nx >= state.dungeon.width) {
              hasHiddenNeighbor = true;
              break;
            }
            if (this.fogGrid[ny] && this.fogGrid[ny][nx] !== 2) {
              hasHiddenNeighbor = true;
              break;
            }
          }
          if (hasHiddenNeighbor) break;
        }

        if (!hasHiddenNeighbor) continue;

        // This is a border tile - draw soft gradient overlay
        const sx = tx * TILE_SIZE - camX;
        const sy = ty * TILE_SIZE - camY;

        // Calculate distance to nearest fog as alpha
        // Use a subtle darkening at the edge
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = '#000000';
        ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
        ctx.globalAlpha = 1;
      }
    }

    // Radial gradient overlay centered on each player for smooth vision falloff
    const players = Object.values(state.players);
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (!p.alive) continue;

      const pcx = p.position.x * TILE_SIZE + TILE_SIZE / 2 - camX;
      const pcy = p.position.y * TILE_SIZE + TILE_SIZE / 2 - camY;
      const visionPx = VISION_RADIUS * TILE_SIZE;

      // Create a radial gradient that darkens at the edges of vision
      const grad = ctx.createRadialGradient(pcx, pcy, visionPx * 0.5, pcx, pcy, visionPx);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(0.7, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0.3)');
      ctx.fillStyle = grad;
      ctx.fillRect(pcx - visionPx, pcy - visionPx, visionPx * 2, visionPx * 2);
    }
  }

  private detectHpChanges(state: GameState, localPlayerId: string): void {
    const preset = QUALITY_PRESETS[this.quality];
    const players = Object.values(state.players);

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
          }
          // Camera shake on player damage (stronger for criticals)
          if (isCritical) {
            this.camera.shake(8, 300);
          } else {
            this.camera.shakeTakeDamage();
          }

          // Screen flash when player takes big damage (>30% HP)
          if (p.id === localPlayerId && diff > p.maxHp * 0.3) {
            this.triggerScreenFlash('#ffffff', 0.5);
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

    const monsters = Object.values(state.monsters);
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
          // Tiny screen shake on hit impact
          this.camera.shake(1, 80);
        }
      }
      if (prev !== undefined && m.hp <= 0 && (prev > 0)) {
        const wx = m.position.x * TILE_SIZE + TILE_SIZE / 2;
        const wy = m.position.y * TILE_SIZE + TILE_SIZE / 2;
        if (preset.particles) {
          this.particles.emitDeath(wx, wy, MONSTER_STATS[m.type].color);
        }
        // Boss death = big shake
        if (m.type === 'boss_demon') {
          this.camera.shakeBossSlam();
          this.triggerScreenFlash('#ffffff', 0.7);
        } else {
          this.camera.shake(3, 200);
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

  /** Draw a floating "R" key prompt above the player */
  private drawInteractIndicator(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const bobOffset = Math.sin(this.animFrame * 0.4) * 1.5;
    const iy = Math.floor(y + bobOffset);
    const ix = Math.floor(x);

    // Background pill
    const pillW = 10;
    const pillH = 8;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(ix - pillW / 2, iy - pillH / 2, pillW, pillH);

    // Border
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(ix - pillW / 2, iy - pillH / 2, pillW, pillH);

    // "R" text
    ctx.font = 'bold 5px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fbbf24';
    ctx.fillText('R', ix, iy);
  }

  destroy(): void {
    this.particles.clear();
    this.damageNumbers.length = 0;
    this.prevHp.clear();
    this.fogCacheCanvas = null;
    this.fogCacheCtx = null;
    this.fogGradientCanvas = null;
    this.grainCanvas = null;
    this.lightingCanvas = null;
    this.lightingCtx = null;
    this.torchPositions = [];
  }
}

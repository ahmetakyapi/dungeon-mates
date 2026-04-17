// ==========================================
// Dungeon Mates — Camera System
// Smooth lerp follow, deadzone, screen shake presets,
// boss zoom, look-ahead, edge clamping
// ==========================================

import type { Vec2, Direction } from '../../../shared/types';
import { TILE_SIZE, DUNGEON_WIDTH, DUNGEON_HEIGHT } from '../../../shared/types';

const LERP_SMOOTH = 0.08;
const LERP_RESPONSIVE = 0.15;
const DEADZONE = 1.0; // pixels in logical space
const LOOK_AHEAD_TILES = 2; // tiles to look ahead in facing direction
const LOOK_AHEAD_LERP = 0.04; // smoothing for look-ahead offset

// Direction vectors for look-ahead
const DIR_VEC: Record<Direction, Vec2> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
} as const;

type ShakeState = {
  intensity: number;
  duration: number;
  elapsed: number;
  offsetX: number;
  offsetY: number;
};

export class Camera {
  private x = 0;
  private y = 0;
  private targetX = 0;
  private targetY = 0;
  private viewWidth: number;
  private viewHeight: number;
  private lerpSpeed = LERP_SMOOTH;

  // Shake
  private shakeState: ShakeState = {
    intensity: 0,
    duration: 0,
    elapsed: 0,
    offsetX: 0,
    offsetY: 0,
  };

  // Zoom
  private _zoom = 1;
  private _targetZoom = 1;
  private readonly ZOOM_LERP = 0.04;

  // Boss room
  private _inBossRoom = false;

  // Dungeon bounds
  private boundsWidth = DUNGEON_WIDTH;
  private boundsHeight = DUNGEON_HEIGHT;

  // Look-ahead (facing direction based)
  private lookAheadX = 0;
  private lookAheadY = 0;
  private targetLookAheadX = 0;
  private targetLookAheadY = 0;
  private playerFacing: Direction = 'down';

  // Camera punch (directional impulse)
  private punchX = 0;
  private punchY = 0;
  private punchDecay = 0;

  constructor(viewWidth: number, viewHeight: number) {
    this.viewWidth = viewWidth;
    this.viewHeight = viewHeight;
  }

  setViewSize(width: number, height: number): void {
    this.viewWidth = width;
    this.viewHeight = height;
  }

  /** Update dungeon bounds for edge clamping */
  setBounds(width: number, height: number): void {
    this.boundsWidth = width;
    this.boundsHeight = height;
  }

  /** Follow a target position (in tile coords) */
  follow(target: Vec2, facing?: Direction): void {
    this.targetX = target.x * TILE_SIZE - this.viewWidth / (2 * this._zoom);
    this.targetY = target.y * TILE_SIZE - this.viewHeight / (2 * this._zoom);
    if (facing) {
      this.playerFacing = facing;
    }
  }

  /** Set player facing for look-ahead */
  setFacing(facing: Direction): void {
    this.playerFacing = facing;
  }

  /** Apply a directional camera punch impulse */
  punch(dirX: number, dirY: number, amount: number, decayRate = 0.85): void {
    this.punchX = dirX * amount;
    this.punchY = dirY * amount;
    this.punchDecay = decayRate;
  }

  /** Set lerp mode: 'smooth' (0.08) or 'responsive' (0.15) */
  setLerpMode(mode: 'smooth' | 'responsive'): void {
    this.lerpSpeed = mode === 'smooth' ? LERP_SMOOTH : LERP_RESPONSIVE;
  }

  /** Snap immediately to target (no lerp) */
  snapToTarget(): void {
    this.x = this.targetX;
    this.y = this.targetY;
    this.lookAheadX = this.targetLookAheadX;
    this.lookAheadY = this.targetLookAheadY;
    this._zoom = this._targetZoom;
    this.clamp();
  }

  /** Update camera position with smooth lerp + deadzone + shake + look-ahead + zoom */
  update(dt: number): void {
    const dtFactor = Math.min(dt * 60, 3); // Normalize to 60fps, cap at 3

    // Smooth zoom transition
    this._zoom += (this._targetZoom - this._zoom) * this.ZOOM_LERP * dtFactor;

    // Smooth look-ahead based on facing direction
    const dir = DIR_VEC[this.playerFacing];
    this.targetLookAheadX = dir.x * LOOK_AHEAD_TILES * TILE_SIZE;
    this.targetLookAheadY = dir.y * LOOK_AHEAD_TILES * TILE_SIZE;
    this.lookAheadX += (this.targetLookAheadX - this.lookAheadX) * LOOK_AHEAD_LERP * dtFactor;
    this.lookAheadY += (this.targetLookAheadY - this.lookAheadY) * LOOK_AHEAD_LERP * dtFactor;

    const finalTargetX = this.targetX + this.lookAheadX;
    const finalTargetY = this.targetY + this.lookAheadY;

    const dx = finalTargetX - this.x;
    const dy = finalTargetY - this.y;

    // Smooth lerp with deadzone
    if (Math.abs(dx) > DEADZONE) {
      this.x += dx * this.lerpSpeed * dtFactor;
    }
    if (Math.abs(dy) > DEADZONE) {
      this.y += dy * this.lerpSpeed * dtFactor;
    }

    // Decay punch
    this.punchX *= this.punchDecay;
    this.punchY *= this.punchDecay;
    if (Math.abs(this.punchX) < 0.1) this.punchX = 0;
    if (Math.abs(this.punchY) < 0.1) this.punchY = 0;

    this.clamp();
    this.updateShake(dt);
  }

  // ===== SCREEN SHAKE =====

  /** Start a screen shake effect */
  shake(intensity: number, duration: number): void {
    // Only override if new shake is stronger or current is nearly done
    if (intensity >= this.shakeState.intensity || this.shakeState.elapsed >= this.shakeState.duration * 0.7) {
      this.shakeState.intensity = intensity;
      this.shakeState.duration = duration;
      this.shakeState.elapsed = 0;
    }
  }

  /** Preset: small shake when player takes damage (amplitude 2, 150ms) */
  shakeTakeDamage(): void {
    this.shake(2, 150);
  }

  /** Preset: large shake for boss slam (amplitude 5, 400ms) */
  shakeBossSlam(): void {
    this.shake(8, 400);
  }

  /** Preset: medium shake on death (amplitude 3, 300ms) */
  shakeDeath(): void {
    this.shake(4, 300);
  }

  /** Preset: sharp crit shake with quick decay */
  shakeCrit(): void {
    this.shake(4, 150);
  }

  /** Preset: scaled shake from damage/maxHp ratio (0..1) */
  shakeFromDamageRatio(ratio: number): void {
    const r = Math.max(0, Math.min(1, ratio));
    this.shake(1.5 + r * 6, 80 + r * 280);
  }

  /** Preset: punch in a direction (used on hit landings) */
  punchHit(dirX: number, dirY: number, strength = 2): void {
    this.punch(dirX, dirY, strength, 0.8);
  }

  // ===== BOSS ROOM ZOOM =====

  /** Enter boss room -- zoom out to 0.85x */
  enterBossRoom(): void {
    this._inBossRoom = true;
    this._targetZoom = 0.85;
  }

  /** Leave boss room -- reset zoom */
  leaveBossRoom(): void {
    this._inBossRoom = false;
    this._targetZoom = 1;
  }

  /** Set target zoom (for external control) */
  setZoom(zoom: number): void {
    this._targetZoom = Math.max(0.7, Math.min(1.5, zoom));
  }

  /** Get current zoom level */
  get zoom(): number {
    return this._zoom;
  }

  /** Whether we're in boss room */
  get isBossRoom(): boolean {
    return this._inBossRoom;
  }

  private updateShake(dt: number): void {
    const s = this.shakeState;
    if (s.elapsed >= s.duration) {
      s.offsetX = 0;
      s.offsetY = 0;
      return;
    }
    s.elapsed += dt * 1000;
    const progress = s.elapsed / s.duration;
    // Cubic ease-out for smoother shake decay
    const fadeOut = 1 - progress * progress * progress;
    const currentIntensity = s.intensity * fadeOut;
    // Sinusoidal shake for more organic feel (instead of pure random)
    const freq = 25; // oscillation frequency
    const t = s.elapsed * 0.001;
    const baseX = Math.sin(t * freq) * currentIntensity;
    const baseY = Math.cos(t * freq * 1.3) * currentIntensity;
    // Add slight randomness for non-mechanical feel
    s.offsetX = baseX + (Math.random() - 0.5) * currentIntensity * 0.3;
    s.offsetY = baseY + (Math.random() - 0.5) * currentIntensity * 0.3;
  }

  private clamp(): void {
    const effectiveViewW = this.viewWidth / this._zoom;
    const effectiveViewH = this.viewHeight / this._zoom;
    const maxX = this.boundsWidth * TILE_SIZE - effectiveViewW;
    const maxY = this.boundsHeight * TILE_SIZE - effectiveViewH;
    this.x = Math.max(0, Math.min(maxX, this.x));
    this.y = Math.max(0, Math.min(maxY, this.y));
  }

  /** Get the final camera X including shake offset and punch */
  get scrollX(): number {
    return Math.round(this.x + this.shakeState.offsetX + this.punchX);
  }

  /** Get the final camera Y including shake offset and punch */
  get scrollY(): number {
    return Math.round(this.y + this.shakeState.offsetY + this.punchY);
  }

  // Pre-allocated Vec2 objects to avoid per-frame allocations
  private readonly _wtsVec: Vec2 = { x: 0, y: 0 };
  private readonly _stwVec: Vec2 = { x: 0, y: 0 };
  private readonly _sttVec: Vec2 = { x: 0, y: 0 };

  /** Convert world coordinates (pixels) to screen coordinates (mutates reusable vec) */
  worldToScreen(wx: number, wy: number): Vec2 {
    this._wtsVec.x = (wx - this.scrollX) * this._zoom;
    this._wtsVec.y = (wy - this.scrollY) * this._zoom;
    return this._wtsVec;
  }

  /** Convert screen coordinates to world coordinates (mutates reusable vec) */
  screenToWorld(sx: number, sy: number): Vec2 {
    this._stwVec.x = sx / this._zoom + this.scrollX;
    this._stwVec.y = sy / this._zoom + this.scrollY;
    return this._stwVec;
  }

  /** Convert screen coordinates to tile coordinates (mutates reusable vec) */
  screenToTile(sx: number, sy: number): Vec2 {
    const wx = sx / this._zoom + this.scrollX;
    const wy = sy / this._zoom + this.scrollY;
    this._sttVec.x = Math.floor(wx / TILE_SIZE);
    this._sttVec.y = Math.floor(wy / TILE_SIZE);
    return this._sttVec;
  }

  /** Check if a world-space rect is visible on screen */
  isVisible(wx: number, wy: number, w: number, h: number): boolean {
    const effectiveViewW = this.viewWidth / this._zoom;
    const effectiveViewH = this.viewHeight / this._zoom;
    const sx = wx - this.scrollX;
    const sy = wy - this.scrollY;
    return sx + w > 0 && sx < effectiveViewW && sy + h > 0 && sy < effectiveViewH;
  }
}

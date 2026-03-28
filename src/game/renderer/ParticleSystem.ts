// ==========================================
// Dungeon Mates — Particle System
// Pool-based particles for visual effects
// ==========================================

const MAX_PARTICLES = 512;

type Particle = {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  gravity: number;
  friction: number;
  fadeOut: boolean;
  shrink: boolean;
};

// Pre-allocated pool
const createParticle = (): Particle => ({
  active: false,
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  life: 0,
  maxLife: 0,
  color: '#ffffff',
  size: 2,
  gravity: 0,
  friction: 1,
  fadeOut: true,
  shrink: false,
});

type EmitConfig = {
  x: number;
  y: number;
  count: number;
  color: string | string[];
  speedMin: number;
  speedMax: number;
  sizeMin: number;
  sizeMax: number;
  lifeMin: number;
  lifeMax: number;
  gravity?: number;
  friction?: number;
  fadeOut?: boolean;
  shrink?: boolean;
  angleMin?: number;
  angleMax?: number;
};

export class ParticleSystem {
  private readonly pool: Particle[];
  private activeCount = 0;
  private dustTimer = 0;
  private maxActive = MAX_PARTICLES;

  constructor() {
    this.pool = new Array<Particle>(MAX_PARTICLES);
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.pool[i] = createParticle();
    }
  }

  /** Set max active particles (for quality scaling) */
  setMaxParticles(max: number): void {
    this.maxActive = Math.max(0, Math.min(MAX_PARTICLES, max));
  }

  private acquire(): Particle | null {
    if (this.activeCount >= this.maxActive) return null;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (!this.pool[i].active) {
        this.pool[i].active = true;
        this.activeCount++;
        return this.pool[i];
      }
    }
    // If pool is full, reclaim the oldest (lowest life ratio)
    let oldest = 0;
    let oldestRatio = 1;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const ratio = this.pool[i].life / this.pool[i].maxLife;
      if (ratio < oldestRatio) {
        oldestRatio = ratio;
        oldest = i;
      }
    }
    return this.pool[oldest];
  }

  private randRange(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  /** Generic emit with full config */
  emit(config: EmitConfig): void {
    const {
      x, y, count, color, speedMin, speedMax,
      sizeMin, sizeMax, lifeMin, lifeMax,
      gravity = 0, friction = 1, fadeOut = true, shrink = false,
      angleMin = 0, angleMax = Math.PI * 2,
    } = config;

    const colors = Array.isArray(color) ? color : [color];

    for (let i = 0; i < count; i++) {
      const p = this.acquire();
      if (!p) return;

      const angle = this.randRange(angleMin, angleMax);
      const speed = this.randRange(speedMin, speedMax);

      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = this.randRange(lifeMin, lifeMax);
      p.maxLife = p.life;
      p.color = colors[Math.floor(Math.random() * colors.length)];
      p.size = this.randRange(sizeMin, sizeMax);
      p.gravity = gravity;
      p.friction = friction;
      p.fadeOut = fadeOut;
      p.shrink = shrink;
    }
  }

  // ===== PRESET EFFECTS =====

  /** hit_spark: 5-8 white/yellow particles burst from impact, fast, short life */
  emitHitSpark(x: number, y: number): void {
    this.emit({
      x, y,
      count: 5 + Math.floor(Math.random() * 4),
      color: ['#ffffff', '#fef3c7', '#fbbf24'],
      speedMin: 60, speedMax: 120,
      sizeMin: 1, sizeMax: 2,
      lifeMin: 0.15, lifeMax: 0.3,
      gravity: 0,
      friction: 0.9,
      shrink: true,
    });
  }

  /** blood_splatter: 3-5 red particles, slow gravity, medium life */
  emitBloodSplatter(x: number, y: number): void {
    this.emit({
      x, y,
      count: 3 + Math.floor(Math.random() * 3),
      color: ['#ef4444', '#dc2626', '#991b1b'],
      speedMin: 15, speedMax: 40,
      sizeMin: 1, sizeMax: 3,
      lifeMin: 0.3, lifeMax: 0.6,
      gravity: 30,
      friction: 0.95,
      shrink: true,
    });
  }

  /** magic_burst: 10-15 purple/blue particles in circle, expanding, fading */
  emitMagicBurst(x: number, y: number): void {
    this.emit({
      x, y,
      count: 10 + Math.floor(Math.random() * 6),
      color: ['#a78bfa', '#8b5cf6', '#6366f1', '#3b82f6', '#ffffff'],
      speedMin: 20, speedMax: 60,
      sizeMin: 1, sizeMax: 2,
      lifeMin: 0.4, lifeMax: 0.8,
      gravity: -15,
      fadeOut: true,
    });
  }

  /** arrow_trail: 1-2 white particles along arrow path */
  emitArrowTrail(x: number, y: number): void {
    this.emit({
      x, y,
      count: 1 + Math.floor(Math.random() * 2),
      color: ['#d1d5db', '#e5e7eb'],
      speedMin: 2, speedMax: 8,
      sizeMin: 1, sizeMax: 1,
      lifeMin: 0.08, lifeMax: 0.15,
      gravity: 0,
      fadeOut: true,
    });
  }

  /** fire_trail: 2-3 orange/red particles behind fireball */
  emitFireTrail(x: number, y: number): void {
    this.emit({
      x, y,
      count: 2 + Math.floor(Math.random() * 2),
      color: ['#f97316', '#ef4444', '#fbbf24'],
      speedMin: 5, speedMax: 20,
      sizeMin: 1, sizeMax: 3,
      lifeMin: 0.1, lifeMax: 0.25,
      gravity: -10,
      fadeOut: true,
      shrink: true,
    });
  }

  /** gold_sparkle: 3 gold particles floating up */
  emitGoldSparkle(x: number, y: number): void {
    this.emit({
      x, y,
      count: 3,
      color: ['#fbbf24', '#eab308', '#fef3c7'],
      speedMin: 10, speedMax: 30,
      sizeMin: 1, sizeMax: 2,
      lifeMin: 0.4, lifeMax: 0.8,
      gravity: -40,
      fadeOut: true,
      angleMin: -Math.PI * 0.75,
      angleMax: -Math.PI * 0.25,
    });
  }

  /** heal_effect: Green + particles rising in column from player */
  emitHealEffect(x: number, y: number): void {
    this.emit({
      x, y: y + 8,
      count: 8,
      color: ['#4ade80', '#22c55e', '#86efac', '#bbf7d0'],
      speedMin: 10, speedMax: 35,
      sizeMin: 1, sizeMax: 2,
      lifeMin: 0.4, lifeMax: 0.8,
      gravity: -50,
      fadeOut: true,
      angleMin: -Math.PI * 0.65,
      angleMax: -Math.PI * 0.35,
    });
  }

  /** level_up: Gold particles spiraling upward, many (20+), long life */
  emitLevelUp(x: number, y: number): void {
    this.emit({
      x, y,
      count: 24,
      color: ['#fbbf24', '#eab308', '#fef3c7', '#ffffff'],
      speedMin: 15, speedMax: 50,
      sizeMin: 1, sizeMax: 3,
      lifeMin: 1.0, lifeMax: 2.0,
      gravity: -25,
      friction: 0.97,
      fadeOut: true,
      shrink: true,
    });
  }

  /** boss_aura: Continuous dark red particles emanating from boss, slow drift */
  emitBossAura(x: number, y: number): void {
    this.emit({
      x: x + (Math.random() - 0.5) * 30,
      y: y + (Math.random() - 0.5) * 30,
      count: 1,
      color: ['#991b1b', '#7f1d1d', '#dc2626'],
      speedMin: 3, speedMax: 10,
      sizeMin: 1, sizeMax: 2,
      lifeMin: 0.6, lifeMax: 1.2,
      gravity: -5,
      fadeOut: true,
    });
  }

  /** Player Death: red/dark particles explode outward (30 particles, 2s) */
  emitPlayerDeath(x: number, y: number): void {
    this.emit({
      x, y,
      count: 30,
      color: ['#dc2626', '#7f1d1d', '#450a0a', '#1c1917', '#991b1b'],
      speedMin: 40, speedMax: 120,
      sizeMin: 2, sizeMax: 5,
      lifeMin: 0.5, lifeMax: 2.0,
      gravity: 30,
      friction: 0.96,
      fadeOut: true,
      shrink: true,
    });
    this.emit({
      x, y,
      count: 10,
      color: ['#1c1917', '#292524'],
      speedMin: 10, speedMax: 30,
      sizeMin: 1, sizeMax: 3,
      lifeMin: 1.0, lifeMax: 2.0,
      gravity: -5,
      fadeOut: true,
    });
  }

  /** Loot Pickup: sparkle particles at pickup location (10 particles, 0.8s) */
  emitLootPickup(x: number, y: number): void {
    this.emit({
      x, y,
      count: 10,
      color: ['#fbbf24', '#eab308', '#ffffff', '#fef3c7'],
      speedMin: 15, speedMax: 50,
      sizeMin: 1, sizeMax: 2,
      lifeMin: 0.3, lifeMax: 0.8,
      gravity: -20,
      fadeOut: true,
      shrink: true,
    });
  }

  /** Boss Entrance: dark fire particles from edges of screen (40 particles, 3s) */
  emitBossEntrance(screenWidth: number, screenHeight: number): void {
    const edges = [
      { x: 0, y: Math.random() * screenHeight, angleMin: -0.3, angleMax: 0.3 },
      { x: screenWidth, y: Math.random() * screenHeight, angleMin: Math.PI - 0.3, angleMax: Math.PI + 0.3 },
      { x: Math.random() * screenWidth, y: 0, angleMin: Math.PI * 0.4, angleMax: Math.PI * 0.6 },
      { x: Math.random() * screenWidth, y: screenHeight, angleMin: -Math.PI * 0.6, angleMax: -Math.PI * 0.4 },
    ];

    for (let i = 0; i < 40; i++) {
      const edge = edges[i % 4];
      this.emit({
        x: edge.x + this.randRange(-20, 20),
        y: edge.y + this.randRange(-20, 20),
        count: 1,
        color: ['#dc2626', '#7f1d1d', '#f97316', '#451a03', '#1c1917'],
        speedMin: 20, speedMax: 60,
        sizeMin: 2, sizeMax: 5,
        lifeMin: 1.5, lifeMax: 3.0,
        gravity: -10,
        fadeOut: true,
        shrink: true,
        angleMin: edge.angleMin,
        angleMax: edge.angleMax,
      });
    }
  }

  /** Portal Open: swirling blue particles for floor transition (25 particles, 2s) */
  emitPortalOpen(x: number, y: number): void {
    for (let i = 0; i < 25; i++) {
      const angle = (i / 25) * Math.PI * 2;
      const radius = 8 + Math.random() * 12;
      const p = this.acquire();
      if (!p) return;

      p.x = x + Math.cos(angle) * radius;
      p.y = y + Math.sin(angle) * radius;
      p.vx = -Math.sin(angle) * 30 + Math.cos(angle) * -5;
      p.vy = Math.cos(angle) * 30 + Math.sin(angle) * -5;
      p.life = 1.0 + Math.random() * 1.0;
      p.maxLife = p.life;
      p.color = ['#3b82f6', '#60a5fa', '#93c5fd', '#2563eb', '#ffffff'][Math.floor(Math.random() * 5)];
      p.size = 1 + Math.random() * 2;
      p.gravity = 0;
      p.friction = 0.98;
      p.fadeOut = true;
      p.shrink = true;
    }
  }

  /** Critical Hit: white flash + star burst (15 particles, 0.5s) */
  emitCriticalHit(x: number, y: number): void {
    // White flash burst
    this.emit({
      x, y,
      count: 8,
      color: ['#ffffff', '#fef3c7', '#fbbf24'],
      speedMin: 60, speedMax: 120,
      sizeMin: 1, sizeMax: 3,
      lifeMin: 0.1, lifeMax: 0.3,
      gravity: 0,
      fadeOut: true,
      shrink: true,
    });
    // Star burst rays
    for (let i = 0; i < 7; i++) {
      const angle = (i / 7) * Math.PI * 2;
      const p = this.acquire();
      if (!p) return;

      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * 80;
      p.vy = Math.sin(angle) * 80;
      p.life = 0.3 + Math.random() * 0.2;
      p.maxLife = p.life;
      p.color = '#ffffff';
      p.size = 1.5;
      p.gravity = 0;
      p.friction = 0.95;
      p.fadeOut = true;
      p.shrink = false;
    }
  }

  /** death_explosion: 15-20 particles in entity color, exploding outward */
  emitDeathExplosion(x: number, y: number, color: string): void {
    this.emit({
      x, y,
      count: 15 + Math.floor(Math.random() * 6),
      color: [color, darkenHex(color, 0.3), lightenHex(color, 0.3), '#ffffff'],
      speedMin: 30, speedMax: 100,
      sizeMin: 1, sizeMax: 4,
      lifeMin: 0.3, lifeMax: 1.0,
      gravity: 40,
      friction: 0.97,
      shrink: true,
      fadeOut: true,
    });
    // Lingering sparkles
    this.emit({
      x, y,
      count: 6,
      color: ['#fbbf24', '#ffffff'],
      speedMin: 5, speedMax: 20,
      sizeMin: 1, sizeMax: 1,
      lifeMin: 0.5, lifeMax: 1.5,
      gravity: -15,
      fadeOut: true,
    });
  }

  /** dust_ambient: Very sparse, slow drift, very faint, long life */
  emitDustAmbient(viewX: number, viewY: number, viewW: number, viewH: number): void {
    this.emit({
      x: viewX + Math.random() * viewW,
      y: viewY + Math.random() * viewH,
      count: 1,
      color: ['#6b7280', '#4b5563'],
      speedMin: 1, speedMax: 4,
      sizeMin: 1, sizeMax: 1,
      lifeMin: 3, lifeMax: 5,
      gravity: -1,
      friction: 0.99,
      fadeOut: true,
    });
  }

  /** torch_flame: 2-3 orange/yellow particles rising from torch position */
  emitTorchFlame(x: number, y: number): void {
    this.emit({
      x: x + (Math.random() - 0.5) * 2,
      y,
      count: 2 + Math.floor(Math.random() * 2),
      color: ['#f97316', '#fbbf24', '#fef3c7'],
      speedMin: 5, speedMax: 15,
      sizeMin: 1, sizeMax: 2,
      lifeMin: 0.15, lifeMax: 0.35,
      gravity: -30,
      fadeOut: true,
      shrink: true,
      angleMin: -Math.PI * 0.75,
      angleMax: -Math.PI * 0.25,
    });
  }

  /** ice_storm: Blue/cyan particles swirling around mage ability area */
  emitIceStorm(x: number, y: number): void {
    this.emit({
      x: x + (Math.random() - 0.5) * 48,
      y: y + (Math.random() - 0.5) * 48,
      count: 2,
      color: ['#93c5fd', '#60a5fa', '#3b82f6', '#bfdbfe', '#ffffff'],
      speedMin: 5, speedMax: 20,
      sizeMin: 1, sizeMax: 2,
      lifeMin: 0.3, lifeMax: 0.7,
      gravity: -8,
      fadeOut: true,
      shrink: true,
    });
  }

  /** shield_shimmer: Cyan/blue particles orbiting around warrior shield */
  emitShieldShimmer(x: number, y: number): void {
    const angle = Math.random() * Math.PI * 2;
    const radius = 6 + Math.random() * 4;
    this.emit({
      x: x + Math.cos(angle) * radius,
      y: y + Math.sin(angle) * radius,
      count: 1,
      color: ['#67e8f9', '#22d3ee', '#06b6d4', '#a5f3fc'],
      speedMin: 2, speedMax: 8,
      sizeMin: 1, sizeMax: 1,
      lifeMin: 0.2, lifeMax: 0.5,
      gravity: -5,
      fadeOut: true,
    });
  }

  /** speed_trail: Green sparkle particles behind speed-boosted player */
  emitSpeedTrail(x: number, y: number): void {
    this.emit({
      x: x + (Math.random() - 0.5) * 6,
      y: y + 4,
      count: 2,
      color: ['#4ade80', '#22c55e', '#86efac', '#bbf7d0'],
      speedMin: 3, speedMax: 12,
      sizeMin: 1, sizeMax: 1,
      lifeMin: 0.15, lifeMax: 0.35,
      gravity: -10,
      fadeOut: true,
      shrink: true,
    });
  }

  // ===== LEGACY PRESETS (kept for compatibility) =====

  /** Blood/hit splatter when monster is hit */
  emitHit(x: number, y: number, color = '#ef4444'): void {
    this.emitHitSpark(x, y);
    this.emitBloodSplatter(x, y);
  }

  /** Magic sparkles for mage attack */
  emitMagic(x: number, y: number): void {
    this.emitMagicBurst(x, y);
  }

  /** Gold shimmer for loot pickup */
  emitGoldPickup(x: number, y: number): void {
    this.emitGoldSparkle(x, y);
    this.emit({
      x, y, count: 10,
      color: ['#fbbf24', '#eab308', '#fef3c7'],
      speedMin: 15, speedMax: 50,
      sizeMin: 1, sizeMax: 2,
      lifeMin: 0.4, lifeMax: 1.0,
      gravity: -30,
      fadeOut: true,
      shrink: true,
    });
  }

  /** Dust puff for player movement */
  emitDust(x: number, y: number): void {
    this.emit({
      x, y: y + 6, count: 3,
      color: ['#6b7280', '#9ca3af'],
      speedMin: 5, speedMax: 15,
      sizeMin: 1, sizeMax: 2,
      lifeMin: 0.15, lifeMax: 0.35,
      gravity: -10,
      fadeOut: true,
      angleMin: -Math.PI,
      angleMax: 0,
    });
  }

  /** Death explosion when monster dies */
  emitDeath(x: number, y: number, color: string): void {
    this.emitDeathExplosion(x, y, color);
  }

  /** Update all active particles */
  update(dt: number): void {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.pool[i];
      if (!p.active) continue;

      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        this.activeCount--;
        continue;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      p.vx *= p.friction;
      p.vy *= p.friction;
    }

    // Ambient dust timer
    this.dustTimer += dt;
  }

  /** Check if ambient dust should spawn (call from renderer with camera coords) */
  shouldSpawnDust(): boolean {
    if (this.dustTimer >= 0.5) {
      this.dustTimer -= 0.5;
      return true;
    }
    return false;
  }

  /** Render all active particles */
  render(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number): void {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.pool[i];
      if (!p.active) continue;

      const sx = Math.floor(p.x - cameraX);
      const sy = Math.floor(p.y - cameraY);

      // Skip off-screen particles
      if (sx < -10 || sx > 330 || sy < -10 || sy > 250) continue;

      const progress = 1 - p.life / p.maxLife;

      if (p.fadeOut) {
        ctx.globalAlpha = Math.max(0, 1 - progress);
      }

      const size = p.shrink ? Math.max(0.5, p.size * (1 - progress)) : p.size;

      ctx.fillStyle = p.color;
      ctx.fillRect(sx, sy, Math.ceil(size), Math.ceil(size));
    }

    ctx.globalAlpha = 1;
  }

  /** Clear all particles */
  clear(): void {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.pool[i].active = false;
    }
    this.activeCount = 0;
  }

  get count(): number {
    return this.activeCount;
  }
}

// Utility: darken hex color
function darkenHex(hex: string, amount: number): string {
  const v = parseInt(hex.slice(1), 16);
  const r = (v >> 16) & 0xff;
  const g = (v >> 8) & 0xff;
  const b = v & 0xff;
  const f = 1 - amount;
  return `rgb(${Math.floor(r * f)},${Math.floor(g * f)},${Math.floor(b * f)})`;
}

function lightenHex(hex: string, amount: number): string {
  const v = parseInt(hex.slice(1), 16);
  const r = (v >> 16) & 0xff;
  const g = (v >> 8) & 0xff;
  const b = v & 0xff;
  return `rgb(${Math.min(255, Math.floor(r + (255 - r) * amount))},${Math.min(255, Math.floor(g + (255 - g) * amount))},${Math.min(255, Math.floor(b + (255 - b) * amount))})`;
}

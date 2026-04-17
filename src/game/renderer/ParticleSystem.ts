// ==========================================
// Dungeon Mates — Particle System
// Pool-based particles for visual effects
// ==========================================

const MAX_PARTICLES = 768;

type ParticlePriority = 0 | 1 | 2; // 0 = ambient (low), 1 = normal, 2 = high (combat)
type ParticleShape = 'square' | 'circle' | 'star' | 'rune' | 'line';

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
  priority: ParticlePriority;
  shape: ParticleShape;
  rotation: number;
  rotVel: number;
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
  priority: 1,
  shape: 'square',
  rotation: 0,
  rotVel: 0,
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
  priority?: ParticlePriority;
  shape?: ParticleShape;
  rotate?: boolean;
};

export class ParticleSystem {
  private readonly pool: Particle[];
  private activeCount = 0;
  private dustTimer = 0;
  private maxActive = MAX_PARTICLES;

  // Free-list: indices of inactive particles for O(1) acquire
  private readonly freeList: number[];
  private freeCount = MAX_PARTICLES;

  /** Set to true by emitHitSpark; renderer should check and reset each frame */
  public screenFlashRequested = false;

  constructor() {
    this.pool = new Array<Particle>(MAX_PARTICLES);
    this.freeList = new Array<number>(MAX_PARTICLES);
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.pool[i] = createParticle();
      this.freeList[i] = i; // all indices start free
    }
  }

  /** Set max active particles (for quality scaling) */
  setMaxParticles(max: number): void {
    this.maxActive = Math.max(0, Math.min(MAX_PARTICLES, max));
  }

  /** Return a particle index to the free list */
  private release(index: number): void {
    this.pool[index].active = false;
    this.freeList[this.freeCount++] = index;
    this.activeCount--;
  }

  private acquire(requestPriority: ParticlePriority = 1): Particle | null {
    // O(1) acquire from free list
    if (this.freeCount > 0) {
      const idx = this.freeList[--this.freeCount];
      const p = this.pool[idx];
      p.active = true;
      p.priority = requestPriority;
      this.activeCount++;
      return p;
    }

    if (this.activeCount >= this.maxActive) {
      // Pool is full -- recycle lowest priority particle with lowest life ratio
      let bestIdx = -1;
      let bestScore = Infinity;

      for (let i = 0; i < MAX_PARTICLES; i++) {
        const p = this.pool[i];
        if (!p.active) continue;
        const score = p.priority * 10 + (p.life / p.maxLife);
        if (score < bestScore) {
          bestScore = score;
          bestIdx = i;
        }
      }

      if (bestIdx >= 0 && this.pool[bestIdx].priority <= requestPriority) {
        this.pool[bestIdx].priority = requestPriority;
        return this.pool[bestIdx];
      }
      return null;
    }

    return null;
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
      priority = 1,
      shape = 'square',
      rotate = false,
    } = config;

    const colors = Array.isArray(color) ? color : [color];

    for (let i = 0; i < count; i++) {
      const p = this.acquire(priority);
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
      p.priority = priority;
      p.shape = shape;
      p.rotation = rotate ? Math.random() * Math.PI * 2 : 0;
      p.rotVel = rotate ? (Math.random() - 0.5) * 8 : 0;
    }
  }

  // ===== PRESET EFFECTS =====

  /** hit_spark: 10-12 white/yellow particles burst from impact + white core flash + screen flash sync */
  emitHitSpark(x: number, y: number): void {
    // Main spark burst (wider spread, more particles)
    this.emit({
      x, y,
      count: 10 + Math.floor(Math.random() * 3),
      color: ['#ffffff', '#fef3c7', '#fbbf24', '#f59e0b'],
      speedMin: 70, speedMax: 150,
      sizeMin: 1, sizeMax: 2,
      lifeMin: 0.12, lifeMax: 0.35,
      gravity: 0,
      friction: 0.88,
      shrink: true,
      priority: 2,
    });
    // White core flash (2-3 bright white particles, larger, very short life)
    this.emit({
      x, y,
      count: 2 + Math.floor(Math.random() * 2),
      color: '#ffffff',
      speedMin: 10, speedMax: 30,
      sizeMin: 2, sizeMax: 3,
      lifeMin: 0.06, lifeMax: 0.12,
      gravity: 0,
      fadeOut: true,
      shrink: true,
      priority: 2,
    });
    // Signal renderer for screen flash sync
    this.screenFlashRequested = true;
  }

  /** blood_splatter: 8-10 red particles with gravity-based droplet physics + persistent ground drops */
  emitBloodSplatter(x: number, y: number): void {
    // Main splatter (more particles, stronger gravity for falling effect)
    this.emit({
      x, y,
      count: 8 + Math.floor(Math.random() * 3),
      color: ['#7f1d1d', '#991b1b', '#dc2626', '#ef4444', '#b91c1c'],
      speedMin: 25, speedMax: 65,
      sizeMin: 1, sizeMax: 3,
      lifeMin: 0.3, lifeMax: 0.8,
      gravity: 80,
      friction: 0.91,
      shrink: true,
      priority: 2,
    });
    // Bright edge droplets with strong gravity
    this.emit({
      x, y,
      count: 3 + Math.floor(Math.random() * 2),
      color: ['#ef4444', '#f87171'],
      speedMin: 35, speedMax: 70,
      sizeMin: 1, sizeMax: 1,
      lifeMin: 0.5, lifeMax: 1.0,
      gravity: 100,
      friction: 0.85,
      fadeOut: true,
      shrink: false,
      priority: 1,
    });
    // Ground persist drops (tiny, almost stationary, long life)
    this.emit({
      x, y,
      count: 2 + Math.floor(Math.random() * 2),
      color: ['#7f1d1d', '#450a0a'],
      speedMin: 5, speedMax: 12,
      sizeMin: 1, sizeMax: 2,
      lifeMin: 1.5, lifeMax: 3.0,
      gravity: 30,
      friction: 0.8,
      fadeOut: true,
      shrink: false,
      priority: 0,
    });
  }

  /** magic_burst: Spiral pattern with color gradient + runic symbols */
  emitMagicBurst(x: number, y: number): void {
    // Spiral emission pattern (particles placed in spiral, outward velocity)
    const spiralCount = 12 + Math.floor(Math.random() * 5);
    for (let i = 0; i < spiralCount; i++) {
      const p = this.acquire();
      if (!p) return;
      const angle = (i / spiralCount) * Math.PI * 4; // 2 full rotations
      const radius = (i / spiralCount) * 8;
      const speed = 25 + Math.random() * 40;

      p.x = x + Math.cos(angle) * radius;
      p.y = y + Math.sin(angle) * radius;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = 0.5 + Math.random() * 0.5;
      p.maxLife = p.life;
      // Color gradient through lifecycle (bright -> dim via color selection)
      p.color = ['#e0e7ff', '#c7d2fe', '#a78bfa', '#8b5cf6', '#6366f1'][Math.floor(Math.random() * 5)];
      p.size = 1 + Math.random();
      p.gravity = -15;
      p.friction = 0.97;
      p.fadeOut = true;
      p.shrink = true;
    }
    // Runic symbol particles (square, special colors, slower, larger)
    this.emit({
      x, y,
      count: 3 + Math.floor(Math.random() * 2),
      color: ['#c084fc', '#e9d5ff', '#fef3c7'],
      speedMin: 8, speedMax: 20,
      sizeMin: 2, sizeMax: 3,
      lifeMin: 0.6, lifeMax: 1.0,
      gravity: -20,
      friction: 0.96,
      fadeOut: true,
      shrink: false,
    });
    // Secondary expanding ring of particles
    const ringCount = 8;
    for (let i = 0; i < ringCount; i++) {
      const p = this.acquire(1);
      if (!p) return;
      const angle = (i / ringCount) * Math.PI * 2;
      const speed = 50 + Math.random() * 20;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = 0.3 + Math.random() * 0.2;
      p.maxLife = p.life;
      p.color = ['#a78bfa', '#c4b5fd', '#ffffff'][Math.floor(Math.random() * 3)];
      p.size = 1;
      p.gravity = 0;
      p.friction = 0.93;
      p.fadeOut = true;
      p.shrink = true;
      p.priority = 1;
    }
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

  /** fire_trail: Multi-layer fire (red base -> orange -> yellow -> white tip) + smoke + embers */
  emitFireTrail(x: number, y: number): void {
    // Main fire trail (red base to yellow tip gradient) - more dramatic
    this.emit({
      x, y,
      count: 3 + Math.floor(Math.random() * 3),
      color: ['#ef4444', '#f97316', '#fbbf24', '#fde68a', '#ffffff'],
      speedMin: 8, speedMax: 25,
      sizeMin: 1, sizeMax: 3,
      lifeMin: 0.12, lifeMax: 0.35,
      gravity: -12,
      fadeOut: true,
      shrink: true,
    });
    // Smoke particles (gray, rise slowly, larger) - more frequent
    if (Math.random() < 0.6) {
      this.emit({
        x, y,
        count: 1 + Math.floor(Math.random() * 2),
        color: ['#4b5563', '#6b7280', '#374151', '#1f2937'],
        speedMin: 3, speedMax: 10,
        sizeMin: 2, sizeMax: 4,
        lifeMin: 0.4, lifeMax: 0.8,
        gravity: -10,
        friction: 0.96,
        fadeOut: true,
        shrink: false,
        angleMin: -Math.PI * 0.75,
        angleMax: -Math.PI * 0.25,
        priority: 0,
      });
    }
    // Ember particles (tiny, rise fast, orange)
    if (Math.random() < 0.4) {
      this.emit({
        x, y,
        count: 1 + Math.floor(Math.random() * 2),
        color: ['#f97316', '#fb923c'],
        speedMin: 15, speedMax: 35,
        sizeMin: 1, sizeMax: 1,
        lifeMin: 0.15, lifeMax: 0.35,
        gravity: -25,
        fadeOut: true,
        shrink: true,
        angleMin: -Math.PI * 0.8,
        angleMax: -Math.PI * 0.2,
      });
    }
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
    // Rune particles for level up — magical / arcane
    this.emit({
      x, y,
      count: 16,
      color: ['#fbbf24', '#eab308', '#fef3c7', '#ffffff'],
      speedMin: 15, speedMax: 50,
      sizeMin: 3, sizeMax: 5,
      lifeMin: 1.0, lifeMax: 2.0,
      gravity: -25,
      friction: 0.97,
      fadeOut: true,
      shrink: true,
      shape: 'rune',
      priority: 2,
    });
    // Inner star burst
    this.emit({
      x, y,
      count: 8,
      color: ['#ffffff', '#fbbf24'],
      speedMin: 20, speedMax: 60,
      sizeMin: 2, sizeMax: 3,
      lifeMin: 0.5, lifeMax: 1.0,
      gravity: -30,
      fadeOut: true,
      shrink: true,
      shape: 'star',
      rotate: true,
      priority: 2,
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
    // White flash burst with star shapes — premium "crit" feel
    this.emit({
      x, y,
      count: 8,
      color: ['#ffffff', '#fef3c7', '#fbbf24'],
      speedMin: 60, speedMax: 120,
      sizeMin: 2, sizeMax: 4,
      lifeMin: 0.15, lifeMax: 0.4,
      gravity: 0,
      fadeOut: true,
      shrink: true,
      shape: 'star',
      rotate: true,
      priority: 2,
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
      priority: 0,
    });
  }

  /** Subtle dust puff at player feet when walking */
  emitFootstepDust(x: number, y: number): void {
    this.emit({
      x: x + (Math.random() - 0.5) * 4,
      y,
      count: 2,
      color: ['#78716c', '#a8a29e'],
      speedMin: 2, speedMax: 6,
      sizeMin: 1, sizeMax: 1,
      lifeMin: 0.2, lifeMax: 0.4,
      gravity: -3,
      friction: 0.92,
      fadeOut: true,
      priority: 0,
      angleMin: -Math.PI * 0.85,
      angleMax: -Math.PI * 0.15,
    });
  }

  /** torch_flame: 3-5 flame particles rising + smoke wisps */
  emitTorchFlame(x: number, y: number): void {
    // Main flame particles (more colors, slight horizontal drift)
    this.emit({
      x: x + (Math.random() - 0.5) * 3,
      y,
      count: 3 + Math.floor(Math.random() * 3),
      color: ['#ff6600', '#ff9900', '#ffcc00', '#ffffff'],
      speedMin: 6, speedMax: 18,
      sizeMin: 2, sizeMax: 3,
      lifeMin: 0.3, lifeMax: 0.6,
      gravity: -35,
      fadeOut: true,
      shrink: true,
      angleMin: -Math.PI * 0.75,
      angleMax: -Math.PI * 0.25,
    });
    // Smoke wisps (gray, slower, larger, less frequent)
    if (Math.random() < 0.3) {
      this.emit({
        x: x + (Math.random() - 0.5) * 2,
        y: y - 3,
        count: 1,
        color: ['#4b5563', '#6b7280'],
        speedMin: 2, speedMax: 6,
        sizeMin: 2, sizeMax: 3,
        lifeMin: 0.4, lifeMax: 0.8,
        gravity: -12,
        friction: 0.98,
        fadeOut: true,
        shrink: false,
        angleMin: -Math.PI * 0.7,
        angleMax: -Math.PI * 0.3,
      });
    }
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

  /** footstep: 2-3 tiny dust particles when player/monster walks */
  emitFootstep(x: number, y: number): void {
    this.emit({
      x, y,
      count: 2 + Math.floor(Math.random() * 2),
      color: '#4a4a4a',
      speedMin: 3, speedMax: 10,
      sizeMin: 1, sizeMax: 1,
      lifeMin: 0.15, lifeMax: 0.2,
      gravity: 0,
      friction: 0.9,
      fadeOut: true,
      shrink: false,
      angleMin: -Math.PI,
      angleMax: 0,
    });
  }

  /** loot_glow: 1 particle rising slowly above loot item */
  emitLootGlow(x: number, y: number, color: string): void {
    this.emit({
      x: x + (Math.random() - 0.5) * 4,
      y,
      count: 1,
      color,
      speedMin: 3, speedMax: 8,
      sizeMin: 1, sizeMax: 1,
      lifeMin: 0.5, lifeMax: 0.8,
      gravity: -15,
      fadeOut: true,
      shrink: false,
      angleMin: -Math.PI * 0.7,
      angleMax: -Math.PI * 0.3,
    });
  }

  /** door_open: 10-15 stone/dust particles bursting outward from door */
  emitDoorOpen(x: number, y: number): void {
    this.emit({
      x, y,
      count: 10 + Math.floor(Math.random() * 6),
      color: ['#6b6b6b', '#8b8b8b', '#5a5a5a', '#9a9a9a'],
      speedMin: 20, speedMax: 60,
      sizeMin: 1, sizeMax: 3,
      lifeMin: 0.3, lifeMax: 0.8,
      gravity: 50,
      friction: 0.93,
      fadeOut: true,
      shrink: true,
    });
  }

  /** ability_ready: 8 particles in expanding ring, class-colored */
  emitAbilityReady(x: number, y: number, classColor: string): void {
    for (let i = 0; i < 8; i++) {
      const p = this.acquire();
      if (!p) return;
      const angle = (i / 8) * Math.PI * 2;
      const speed = 40 + Math.random() * 20;

      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = 0.3 + Math.random() * 0.15;
      p.maxLife = p.life;
      p.color = i % 2 === 0 ? classColor : '#ffffff';
      p.size = 1.5;
      p.gravity = 0;
      p.friction = 0.94;
      p.fadeOut = true;
      p.shrink = true;
    }
  }

  /** drip: Single water drip particle falling down */
  emitDrip(x: number, y: number): void {
    this.emit({
      x,
      y,
      count: 1,
      color: ['#60a5fa', '#93c5fd'],
      speedMin: 1, speedMax: 3,
      sizeMin: 1, sizeMax: 1,
      lifeMin: 0.8, lifeMax: 1.5,
      gravity: 40,
      friction: 0.99,
      fadeOut: true,
      shrink: false,
      angleMin: Math.PI * 0.4,
      angleMax: Math.PI * 0.6,
    });
  }

  // ===== NEW MONSTER/ENVIRONMENT PRESETS =====

  /** emitPoisonCloud: 6-8 green/yellow particles floating up, long life -- mushroom poison aura */
  emitPoisonCloud(x: number, y: number): void {
    this.emit({
      x: x + (Math.random() - 0.5) * 12,
      y: y + (Math.random() - 0.5) * 12,
      count: 6 + Math.floor(Math.random() * 3),
      color: ['#4ade80', '#a3e635', '#84cc16', '#bef264', '#d9f99d'],
      speedMin: 2, speedMax: 8,
      sizeMin: 2, sizeMax: 4,
      lifeMin: 2.0, lifeMax: 3.0,
      gravity: -6,
      friction: 0.98,
      fadeOut: true,
      shrink: false,
      angleMin: -Math.PI * 0.7,
      angleMax: -Math.PI * 0.3,
      priority: 0,
    });
  }

  /** emitWebShot: 4-5 white particles along a line from->to -- spider web attack */
  emitWebShot(fromX: number, fromY: number, toX: number, toY: number): void {
    const dx = toX - fromX;
    const dy = toY - fromY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return;

    const nx = dx / dist;
    const ny = dy / dist;
    // Perpendicular for spread
    const px = -ny;
    const py = nx;

    const count = 4 + Math.floor(Math.random() * 2);
    for (let i = 0; i < count; i++) {
      const p = this.acquire(1);
      if (!p) return;
      const t = i / (count - 1); // 0..1 along line
      p.x = fromX + dx * t;
      p.y = fromY + dy * t;
      const spread = (Math.random() - 0.5) * 8;
      p.vx = nx * 120 + px * spread;
      p.vy = ny * 120 + py * spread;
      p.life = 0.15 + Math.random() * 0.1;
      p.maxLife = p.life;
      p.color = ['#ffffff', '#e5e7eb', '#d1d5db'][Math.floor(Math.random() * 3)];
      p.size = 1;
      p.gravity = 0;
      p.friction = 0.9;
      p.fadeOut = true;
      p.shrink = false;
      p.priority = 1;
    }
  }

  /** emitWraithPhase: 10-12 cyan/white particles burst outward -- wraith phase in/out */
  emitWraithPhase(x: number, y: number): void {
    this.emit({
      x, y,
      count: 10 + Math.floor(Math.random() * 3),
      color: ['#a5f3fc', '#67e8f9', '#22d3ee', '#ffffff', '#cffafe'],
      speedMin: 40, speedMax: 90,
      sizeMin: 1, sizeMax: 2,
      lifeMin: 0.2, lifeMax: 0.5,
      gravity: 0,
      friction: 0.9,
      fadeOut: true,
      shrink: true,
      priority: 2,
    });
  }

  /** emitSpiderLegs: 2-3 tiny dark purple particles at feet -- spider footsteps */
  emitSpiderLegs(x: number, y: number): void {
    this.emit({
      x, y,
      count: 2 + Math.floor(Math.random() * 2),
      color: ['#581c87', '#6b21a8', '#7e22ce'],
      speedMin: 3, speedMax: 10,
      sizeMin: 1, sizeMax: 1,
      lifeMin: 0.1, lifeMax: 0.2,
      gravity: 5,
      friction: 0.9,
      fadeOut: true,
      shrink: false,
      angleMin: -Math.PI,
      angleMax: 0,
      priority: 0,
    });
  }

  /** emitBossSlam: 20+ particles in ring pattern, red/orange/yellow -- boss ground slam */
  emitBossSlam(x: number, y: number): void {
    const ringCount = 24;
    for (let i = 0; i < ringCount; i++) {
      const p = this.acquire(2);
      if (!p) return;
      const angle = (i / ringCount) * Math.PI * 2;
      const speed = 80 + Math.random() * 60;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = 0.4 + Math.random() * 0.3;
      p.maxLife = p.life;
      p.color = ['#ef4444', '#f97316', '#fbbf24', '#fde68a'][i % 4];
      p.size = 2 + Math.random() * 2;
      p.gravity = 30;
      p.friction = 0.88;
      p.fadeOut = true;
      p.shrink = true;
      p.priority = 2;
    }
    // Inner debris
    this.emit({
      x, y,
      count: 8,
      color: ['#78716c', '#a8a29e', '#57534e'],
      speedMin: 20, speedMax: 50,
      sizeMin: 1, sizeMax: 2,
      lifeMin: 0.3, lifeMax: 0.6,
      gravity: 60,
      friction: 0.9,
      fadeOut: true,
      shrink: true,
      priority: 2,
    });
  }

  /** emitTorchSpark: 1-2 bright orange/yellow sparks rising quickly from torch */
  emitTorchSpark(x: number, y: number): void {
    this.emit({
      x: x + (Math.random() - 0.5) * 3,
      y,
      count: 1 + Math.floor(Math.random() * 2),
      color: ['#fbbf24', '#f97316', '#fde68a'],
      speedMin: 15, speedMax: 35,
      sizeMin: 1, sizeMax: 1,
      lifeMin: 0.1, lifeMax: 0.25,
      gravity: -40,
      friction: 0.95,
      fadeOut: true,
      shrink: true,
      angleMin: -Math.PI * 0.8,
      angleMax: -Math.PI * 0.2,
      priority: 0,
    });
  }

  /** emitWaterDrip: Single blue particle falling down + tiny splash on landing */
  emitWaterDrip(x: number, y: number): void {
    // Falling drip
    this.emit({
      x, y,
      count: 1,
      color: '#60a5fa',
      speedMin: 1, speedMax: 3,
      sizeMin: 1, sizeMax: 1,
      lifeMin: 0.6, lifeMax: 1.0,
      gravity: 50,
      friction: 0.99,
      fadeOut: true,
      shrink: false,
      angleMin: Math.PI * 0.45,
      angleMax: Math.PI * 0.55,
      priority: 0,
    });
    // Tiny splash at bottom (delayed by placing lower)
    this.emit({
      x: x + (Math.random() - 0.5) * 2,
      y: y + 12,
      count: 2 + Math.floor(Math.random() * 2),
      color: ['#93c5fd', '#bfdbfe'],
      speedMin: 5, speedMax: 15,
      sizeMin: 1, sizeMax: 1,
      lifeMin: 0.1, lifeMax: 0.2,
      gravity: 20,
      friction: 0.9,
      fadeOut: true,
      shrink: true,
      angleMin: -Math.PI,
      angleMax: 0,
      priority: 0,
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

  /** Stone Warden shield break — rock fragments exploding outward */
  emitShieldBreak(x: number, y: number): void {
    this.emit({
      x, y,
      count: 16,
      color: ['#78716c', '#a8a29e', '#d6d3d1', '#57534e'],
      speedMin: 60, speedMax: 140,
      sizeMin: 2, sizeMax: 4,
      lifeMin: 0.4, lifeMax: 0.9,
      gravity: 120,
      friction: 0.88,
      shrink: true,
      priority: 2,
    });
    // Dust cloud
    this.emit({
      x, y,
      count: 8,
      color: ['#d6d3d1', '#e7e5e4'],
      speedMin: 15, speedMax: 40,
      sizeMin: 3, sizeMax: 5,
      lifeMin: 0.5, lifeMax: 1.0,
      gravity: 0,
      friction: 0.92,
      fadeOut: true,
      priority: 1,
    });
  }

  /** Enrage fire eruption — flames bursting from monster */
  emitEnrageFlare(x: number, y: number): void {
    this.emit({
      x, y,
      count: 12,
      color: ['#ef4444', '#f97316', '#fbbf24', '#dc2626'],
      speedMin: 40, speedMax: 100,
      sizeMin: 1, sizeMax: 3,
      lifeMin: 0.3, lifeMax: 0.7,
      gravity: -60,
      friction: 0.9,
      shrink: true,
      angleMin: -Math.PI * 0.8,
      angleMax: -Math.PI * 0.2,
      priority: 2,
    });
  }

  /** Stun stars — sparkling circles above entity */
  emitStunStars(x: number, y: number): void {
    this.emit({
      x, y: y - 8,
      count: 2,
      color: ['#fbbf24', '#fde68a', '#ffffff'],
      speedMin: 8, speedMax: 20,
      sizeMin: 1, sizeMax: 1,
      lifeMin: 0.4, lifeMax: 0.7,
      gravity: -15,
      friction: 0.95,
      fadeOut: true,
      priority: 0,
    });
  }

  /** Dodge afterimage — ghostly duplicate fading away */
  emitDodge(x: number, y: number, color: string): void {
    this.emit({
      x, y,
      count: 6,
      color: [color, '#ffffff'],
      speedMin: 20, speedMax: 50,
      sizeMin: 1, sizeMax: 2,
      lifeMin: 0.15, lifeMax: 0.35,
      gravity: 0,
      friction: 0.85,
      fadeOut: true,
      shrink: true,
      priority: 1,
    });
  }

  /** Floor transition sparkle — magical portal particles */
  emitFloorTransition(x: number, y: number): void {
    this.emit({
      x, y,
      count: 20,
      color: ['#a78bfa', '#c4b5fd', '#7c3aed', '#fbbf24', '#ffffff'],
      speedMin: 30, speedMax: 90,
      sizeMin: 1, sizeMax: 3,
      lifeMin: 0.5, lifeMax: 1.2,
      gravity: -30,
      friction: 0.93,
      fadeOut: true,
      shrink: true,
      priority: 2,
    });
  }

  /** death_soul: 15 particles drifting upward, entity-colored, long life — use on monster death */
  emitDeathSoul(x: number, y: number, color: string): void {
    this.emit({
      x, y,
      count: 10 + Math.floor(Math.random() * 6),
      color: [color, lightenHex(color, 0.4), '#ffffff'],
      speedMin: 8, speedMax: 22,
      sizeMin: 1, sizeMax: 2,
      lifeMin: 0.9, lifeMax: 1.6,
      gravity: -38, // strong upward drift
      friction: 0.95,
      fadeOut: true,
      shrink: false,
      angleMin: -Math.PI * 0.75,
      angleMax: -Math.PI * 0.25,
      priority: 2,
    });
    // Inner white core burst
    this.emit({
      x, y,
      count: 4,
      color: ['#ffffff', '#fef3c7'],
      speedMin: 15, speedMax: 30,
      sizeMin: 1, sizeMax: 2,
      lifeMin: 0.3, lifeMax: 0.6,
      gravity: -20,
      fadeOut: true,
      shrink: true,
    });
  }

  /** heal_sparkles: 8 green sparkles rising around target */
  emitHealSparkles(x: number, y: number): void {
    this.emit({
      x, y,
      count: 8,
      color: ['#4ade80', '#86efac', '#ffffff', '#bbf7d0'],
      speedMin: 12, speedMax: 28,
      sizeMin: 2, sizeMax: 3,
      lifeMin: 0.6, lifeMax: 1.1,
      gravity: -30,
      friction: 0.96,
      fadeOut: true,
      shrink: true,
      priority: 1,
      shape: 'star',
      rotate: true,
    });
  }

  /** combo_ring: expanding ring for combo feedback */
  emitComboRing(x: number, y: number, tier: number): void {
    // Tier 1..N — bigger & goldener as tier grows
    const colors = tier >= 3 ? ['#fbbf24', '#fde68a', '#ffffff'] : ['#fef3c7', '#ffffff'];
    const rays = 12;
    const speed = 55 + tier * 12;
    for (let i = 0; i < rays; i++) {
      const angle = (i / rays) * Math.PI * 2;
      const p = this.acquire(2);
      if (!p) return;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = 0.4;
      p.maxLife = 0.4;
      p.color = colors[Math.floor(Math.random() * colors.length)];
      p.size = tier >= 3 ? 2 : 1.5;
      p.gravity = 0;
      p.friction = 0.9;
      p.fadeOut = true;
      p.shrink = false;
    }
  }

  /** elemental_freeze: shatter of ice crystals (used on freeze status trigger) */
  emitFreezeShatter(x: number, y: number): void {
    this.emit({
      x, y,
      count: 14,
      color: ['#7dd3fc', '#bae6fd', '#ffffff', '#38bdf8'],
      speedMin: 25, speedMax: 70,
      sizeMin: 1, sizeMax: 2,
      lifeMin: 0.3, lifeMax: 0.7,
      gravity: 30,
      friction: 0.97,
      fadeOut: true,
      shrink: true,
      priority: 1,
    });
  }

  /** elemental_burn: short orange flame flare */
  emitBurnFlare(x: number, y: number): void {
    this.emit({
      x, y,
      count: 6,
      color: ['#f97316', '#fb923c', '#fbbf24', '#ef4444'],
      speedMin: 10, speedMax: 28,
      sizeMin: 1, sizeMax: 2,
      lifeMin: 0.25, lifeMax: 0.5,
      gravity: -35,
      fadeOut: true,
      shrink: true,
      angleMin: -Math.PI * 0.9,
      angleMax: -Math.PI * 0.1,
      priority: 0,
    });
  }

  /** Update all active particles */
  update(dt: number): void {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.pool[i];
      if (!p.active) continue;

      p.life -= dt;
      if (p.life <= 0) {
        this.release(i);
        continue;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      p.vx *= p.friction;
      p.vy *= p.friction;
      if (p.rotVel !== 0) p.rotation += p.rotVel * dt;
    }

    // Ambient dust timer
    this.dustTimer += dt;
  }

  /** Check if ambient dust should spawn (call from renderer with camera coords) */
  shouldSpawnDust(): boolean {
    if (this.dustTimer >= 0.3) {
      this.dustTimer -= 0.3;
      return true;
    }
    return false;
  }

  /** Render all active particles */
  render(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number, viewW = 480, viewH = 270): void {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.pool[i];
      if (!p.active) continue;

      const sx = Math.floor(p.x - cameraX);
      const sy = Math.floor(p.y - cameraY);

      // Skip off-screen particles (dynamic viewport bounds)
      if (sx < -10 || sx > viewW + 10 || sy < -10 || sy > viewH + 10) continue;

      const progress = 1 - p.life / p.maxLife;

      if (p.fadeOut) {
        ctx.globalAlpha = Math.max(0, 1 - progress);
      }

      const size = p.shrink ? Math.max(0.5, p.size * (1 - progress)) : p.size;
      const sCeil = Math.ceil(size);

      ctx.fillStyle = p.color;

      switch (p.shape) {
        case 'circle': {
          ctx.beginPath();
          ctx.arc(sx + sCeil / 2, sy + sCeil / 2, size / 2 + 0.5, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'star': {
          // 4-point star (cheap — 2 overlapping rects with rotation hint)
          const cx = sx + sCeil / 2;
          const cy = sy + sCeil / 2;
          const s = size;
          if (p.rotation !== 0) {
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(p.rotation);
            ctx.fillRect(-s / 2, -0.5, s, 1);
            ctx.fillRect(-0.5, -s / 2, 1, s);
            ctx.restore();
          } else {
            ctx.fillRect(cx - s / 2, cy - 0.5, s, 1);
            ctx.fillRect(cx - 0.5, cy - s / 2, 1, s);
          }
          // Bright center pixel
          ctx.fillRect(sx + sCeil / 2 - 0.5, sy + sCeil / 2 - 0.5, 1, 1);
          break;
        }
        case 'rune': {
          // Rune: small ring with center dot — magical feel
          const cx = sx + sCeil / 2;
          const cy = sy + sCeil / 2;
          ctx.beginPath();
          ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillRect(cx - 0.5, cy - 0.5, 1, 1);
          break;
        }
        case 'line': {
          // Short streak in velocity direction
          const vmag = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
          if (vmag > 0.01) {
            const nx = p.vx / vmag;
            const ny = p.vy / vmag;
            const len = size * 2;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx - nx * len, sy - ny * len);
            ctx.strokeStyle = p.color;
            ctx.lineWidth = Math.max(1, size * 0.5);
            ctx.stroke();
          } else {
            ctx.fillRect(sx, sy, sCeil, sCeil);
          }
          break;
        }
        case 'square':
        default:
          ctx.fillRect(sx, sy, sCeil, sCeil);
          break;
      }
    }

    ctx.globalAlpha = 1;
  }

  /** Clear all particles */
  clear(): void {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.pool[i].active = false;
    }
    this.activeCount = 0;
    this.screenFlashRequested = false;
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

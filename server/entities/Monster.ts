import {
  MonsterState,
  MonsterType,
  Vec2,
  Direction,
  TileType,
  MONSTER_STATS,
  TICK_RATE,
  DUNGEON_WIDTH,
  DUNGEON_HEIGHT,
} from '../../shared/types';

type AIState = 'idle' | 'chase' | 'attack' | 'retreat' | 'charge' | 'phase';

let nextMonsterId = 0;

const generateMonsterId = (): string => {
  nextMonsterId += 1;
  return `mon_${nextMonsterId}_${Date.now()}`;
};

const DETECTION_RANGE = 5;
const ATTACK_RANGE = 1.2;
const MONSTER_RADIUS_BASE = 0.4;
const WANDER_CHANGE_INTERVAL = 60; // ticks
const BOSS_CHARGE_RANGE = 4;
const BOSS_CHARGE_SPEED_MULT = 2.5;
const BOSS_CHARGE_DURATION = 15; // ticks
const BOSS_SUMMON_COOLDOWN = 300; // ticks
const GOBLIN_RETREAT_HP_RATIO = 0.3;

// New monster constants
const RAT_ERRATIC_CHANCE = 0.3;
const SPIDER_WEB_COOLDOWN = 100; // ticks
const SPIDER_WEB_SLOW_MULT = 0.5;
const SPIDER_WEB_SLOW_DURATION = 40; // ticks
const WRAITH_PHASE_DURATION = 20; // ticks invulnerable
const WRAITH_PHASE_INTERVAL = 80; // ticks between phases
const MUSHROOM_AGGRO_RANGE = 3; // tiles
const MUSHROOM_POISON_RANGE = 1.5; // tiles
const MUSHROOM_POISON_DAMAGE = 2;
const MUSHROOM_POISON_INTERVAL = 20; // ticks

export class Monster {
  public state: MonsterState;
  private aiState: AIState;
  private readonly monsterType: MonsterType;
  private wanderDir: Vec2;
  private wanderTimer: number;
  private chargeTimer: number;
  private chargeDir: Vec2;
  private summonCooldown: number;
  private attackCooldown: number;
  private readonly radius: number;
  public roomId: number;
  public shouldSummon: boolean;

  private scaledAttack: number;
  private slowTicks: number;
  private slowMultiplier: number;

  // Wraith phase state
  private phaseTimer: number;
  private phaseActive: boolean;

  // Spider web cooldown
  private webCooldown: number;
  public webTarget: { playerId: string; slowMult: number; slowTicks: number } | null;

  // Mushroom poison aura
  private poisonTickCounter: number;
  public poisonAuraTargets: { playerId: string; damage: number }[];

  constructor(type: MonsterType, position: Vec2, roomId: number) {
    const stats = MONSTER_STATS[type];

    this.state = {
      id: generateMonsterId(),
      type,
      position: { ...position },
      velocity: { x: 0, y: 0 },
      hp: stats.hp,
      maxHp: stats.hp,
      alive: true,
      targetPlayerId: null,
      facing: 'down',
    };

    this.monsterType = type;
    this.scaledAttack = stats.attack;
    this.aiState = 'idle';
    this.wanderDir = { x: 0, y: 0 };
    this.wanderTimer = 0;
    this.chargeTimer = 0;
    this.chargeDir = { x: 0, y: 0 };
    this.summonCooldown = BOSS_SUMMON_COOLDOWN;
    this.attackCooldown = 0;
    this.radius = MONSTER_RADIUS_BASE * stats.size;
    this.roomId = roomId;
    this.shouldSummon = false;
    this.slowTicks = 0;
    this.slowMultiplier = 1;

    this.phaseTimer = WRAITH_PHASE_INTERVAL;
    this.phaseActive = false;
    this.webCooldown = SPIDER_WEB_COOLDOWN;
    this.webTarget = null;
    this.poisonTickCounter = 0;
    this.poisonAuraTargets = [];
  }

  scaleForFloor(hpMultiplier: number, attackMultiplier: number): void {
    const scaledHp = Math.floor(this.state.maxHp * hpMultiplier);
    this.state.maxHp = scaledHp;
    this.state.hp = scaledHp;
    this.scaledAttack = Math.floor(MONSTER_STATS[this.monsterType].attack * attackMultiplier);
  }

  scaleForSolo(): void {
    // Solo mode: reduce HP by 30%
    const soloHp = Math.floor(this.state.maxHp * 0.7);
    this.state.maxHp = soloHp;
    this.state.hp = soloHp;
  }

  scaleForPlayerCount(playerCount: number): void {
    if (playerCount <= 1) return;
    const hpScale = 1 + (playerCount - 1) * 0.35; // 2p=1.35x, 3p=1.7x, 4p=2.05x
    const atkScale = 1 + (playerCount - 1) * 0.15; // 2p=1.15x, 3p=1.3x, 4p=1.45x
    this.state.maxHp = Math.floor(this.state.maxHp * hpScale);
    this.state.hp = this.state.maxHp;
    const stats = MONSTER_STATS[this.state.type];
    this.scaledAttack = Math.floor(stats.attack * atkScale);
  }

  getRadius(): number {
    return this.radius;
  }

  applySlow(multiplier: number, ticks: number): void {
    this.slowTicks = ticks;
    this.slowMultiplier = multiplier;
  }

  update(
    players: ReadonlyArray<{ id: string; position: Vec2; alive: boolean }>,
    tiles: TileType[][],
  ): { targetId: string; damage: number } | null {
    if (!this.state.alive) return null;

    // Yavaşlama efekti tick
    if (this.slowTicks > 0) {
      this.slowTicks--;
      if (this.slowTicks <= 0) {
        this.slowMultiplier = 1;
      }
    }

    this.shouldSummon = false;
    this.webTarget = null;
    this.poisonAuraTargets = [];

    if (this.attackCooldown > 0) {
      this.attackCooldown -= 1;
    }

    const nearest = this.findNearestPlayer(players);

    switch (this.monsterType) {
      case 'slime':
        return this.updateSlime(nearest, tiles);
      case 'skeleton':
        return this.updateSkeleton(nearest, tiles);
      case 'bat':
        return this.updateBat(nearest, tiles);
      case 'goblin':
        return this.updateGoblin(nearest, tiles);
      case 'rat':
        return this.updateRat(nearest, tiles);
      case 'spider':
        return this.updateSpider(nearest, players, tiles);
      case 'wraith':
        return this.updateWraith(nearest, tiles);
      case 'mushroom':
        return this.updateMushroom(nearest, players, tiles);
      case 'boss_demon':
        return this.updateBossDemon(nearest, tiles);
    }
  }

  private findNearestPlayer(
    players: ReadonlyArray<{ id: string; position: Vec2; alive: boolean }>,
  ): { id: string; position: Vec2; distance: number } | null {
    let nearest: { id: string; position: Vec2; distance: number } | null = null;

    for (const player of players) {
      if (!player.alive) continue;
      const dx = player.position.x - this.state.position.x;
      const dy = player.position.y - this.state.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (nearest === null || dist < nearest.distance) {
        nearest = { id: player.id, position: player.position, distance: dist };
      }
    }

    return nearest;
  }

  private moveToward(target: Vec2, speed: number, tiles: TileType[][]): void {
    const dx = target.x - this.state.position.x;
    const dy = target.y - this.state.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 0.01) return;

    const effectiveSpeed = speed * this.slowMultiplier;
    const vx = (dx / dist) * effectiveSpeed / TICK_RATE;
    const vy = (dy / dist) * effectiveSpeed / TICK_RATE;

    this.tryMove(vx, vy, tiles);
    this.updateFacing(dx, dy);
  }

  private tryMove(vx: number, vy: number, tiles: TileType[][]): void {
    const newX = this.state.position.x + vx;
    const newY = this.state.position.y + vy;

    if (!this.collidesWithWall(newX, this.state.position.y, tiles)) {
      this.state.position.x = newX;
      this.state.velocity.x = vx;
    } else {
      this.state.velocity.x = 0;
    }

    if (!this.collidesWithWall(this.state.position.x, newY, tiles)) {
      this.state.position.y = newY;
      this.state.velocity.y = vy;
    } else {
      this.state.velocity.y = 0;
    }
  }

  private collidesWithWall(x: number, y: number, tiles: TileType[][]): boolean {
    const r = this.radius;
    const corners = [
      { cx: x - r, cy: y - r },
      { cx: x + r, cy: y - r },
      { cx: x - r, cy: y + r },
      { cx: x + r, cy: y + r },
    ];

    for (const corner of corners) {
      const tileX = Math.floor(corner.cx);
      const tileY = Math.floor(corner.cy);

      if (tileY < 0 || tileY >= tiles.length || tileX < 0 || tileX >= tiles[0].length) {
        return true;
      }

      const tile = tiles[tileY][tileX];
      if (tile === 'wall' || tile === 'void') {
        return true;
      }
    }

    return false;
  }

  private updateFacing(dx: number, dy: number): void {
    if (Math.abs(dx) > Math.abs(dy)) {
      this.state.facing = dx > 0 ? 'right' : 'left';
    } else {
      this.state.facing = dy > 0 ? 'down' : 'up';
    }
  }

  private tryAttack(
    target: { id: string; distance: number },
    damage: number,
  ): { targetId: string; damage: number } | null {
    if (target.distance <= ATTACK_RANGE && this.attackCooldown <= 0) {
      this.attackCooldown = Math.floor(TICK_RATE * 0.8);
      return { targetId: target.id, damage };
    }
    return null;
  }

  // --- Slime: slow, random wander ---
  private updateSlime(
    nearest: { id: string; position: Vec2; distance: number } | null,
    tiles: TileType[][],
  ): { targetId: string; damage: number } | null {
    const stats = MONSTER_STATS.slime;

    if (nearest && nearest.distance <= DETECTION_RANGE) {
      this.aiState = 'chase';
      this.state.targetPlayerId = nearest.id;
      this.moveToward(nearest.position, stats.speed * 0.7, tiles);
      return this.tryAttack(nearest, this.scaledAttack);
    }

    // Random wander
    this.aiState = 'idle';
    this.state.targetPlayerId = null;
    this.wanderTimer -= 1;

    if (this.wanderTimer <= 0) {
      const angle = Math.random() * Math.PI * 2;
      this.wanderDir = { x: Math.cos(angle), y: Math.sin(angle) };
      this.wanderTimer = WANDER_CHANGE_INTERVAL + Math.floor(Math.random() * 40);
    }

    const speed = stats.speed * 0.3 / TICK_RATE;
    this.tryMove(this.wanderDir.x * speed, this.wanderDir.y * speed, tiles);

    return null;
  }

  // --- Skeleton: direct chase ---
  private updateSkeleton(
    nearest: { id: string; position: Vec2; distance: number } | null,
    tiles: TileType[][],
  ): { targetId: string; damage: number } | null {
    const stats = MONSTER_STATS.skeleton;

    if (nearest && nearest.distance <= DETECTION_RANGE) {
      this.aiState = 'chase';
      this.state.targetPlayerId = nearest.id;
      this.moveToward(nearest.position, stats.speed, tiles);
      return this.tryAttack(nearest, this.scaledAttack);
    }

    this.aiState = 'idle';
    this.state.targetPlayerId = null;
    this.state.velocity = { x: 0, y: 0 };
    return null;
  }

  // --- Bat: fast, erratic ---
  private updateBat(
    nearest: { id: string; position: Vec2; distance: number } | null,
    tiles: TileType[][],
  ): { targetId: string; damage: number } | null {
    const stats = MONSTER_STATS.bat;

    if (nearest && nearest.distance <= DETECTION_RANGE) {
      this.aiState = 'chase';
      this.state.targetPlayerId = nearest.id;

      // Erratic: add noise to movement direction
      const dx = nearest.position.x - this.state.position.x;
      const dy = nearest.position.y - this.state.position.y;
      const dist = nearest.distance;

      const noiseAngle = (Math.random() - 0.5) * Math.PI * 0.8;
      const baseDx = dx / dist;
      const baseDy = dy / dist;
      const noisedX = baseDx * Math.cos(noiseAngle) - baseDy * Math.sin(noiseAngle);
      const noisedY = baseDx * Math.sin(noiseAngle) + baseDy * Math.cos(noiseAngle);

      const speed = stats.speed / TICK_RATE;
      this.tryMove(noisedX * speed, noisedY * speed, tiles);
      this.updateFacing(dx, dy);

      return this.tryAttack(nearest, this.scaledAttack);
    }

    // Fast random wander
    this.aiState = 'idle';
    this.state.targetPlayerId = null;
    this.wanderTimer -= 1;

    if (this.wanderTimer <= 0) {
      const angle = Math.random() * Math.PI * 2;
      this.wanderDir = { x: Math.cos(angle), y: Math.sin(angle) };
      this.wanderTimer = 20 + Math.floor(Math.random() * 20);
    }

    const speed = stats.speed * 0.4 / TICK_RATE;
    this.tryMove(this.wanderDir.x * speed, this.wanderDir.y * speed, tiles);

    return null;
  }

  // --- Goblin: chase + retreat when low hp ---
  private updateGoblin(
    nearest: { id: string; position: Vec2; distance: number } | null,
    tiles: TileType[][],
  ): { targetId: string; damage: number } | null {
    const stats = MONSTER_STATS.goblin;
    const hpRatio = this.state.hp / this.state.maxHp;

    if (nearest && nearest.distance <= DETECTION_RANGE) {
      this.state.targetPlayerId = nearest.id;

      if (hpRatio <= GOBLIN_RETREAT_HP_RATIO && nearest.distance < 3) {
        // Retreat: move away from player
        this.aiState = 'retreat';
        const dx = this.state.position.x - nearest.position.x;
        const dy = this.state.position.y - nearest.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 0.01) {
          const speed = stats.speed * 1.2 / TICK_RATE;
          this.tryMove((dx / dist) * speed, (dy / dist) * speed, tiles);
          this.updateFacing(-dx, -dy);
        }

        return null;
      }

      this.aiState = 'chase';
      this.moveToward(nearest.position, stats.speed, tiles);
      return this.tryAttack(nearest, this.scaledAttack);
    }

    this.aiState = 'idle';
    this.state.targetPlayerId = null;
    this.state.velocity = { x: 0, y: 0 };
    return null;
  }

  // --- Rat: very fast, erratic chase, small ---
  private updateRat(
    nearest: { id: string; position: Vec2; distance: number } | null,
    tiles: TileType[][],
  ): { targetId: string; damage: number } | null {
    const stats = MONSTER_STATS.rat;

    if (nearest && nearest.distance <= DETECTION_RANGE) {
      this.aiState = 'chase';
      this.state.targetPlayerId = nearest.id;

      // Sometimes move erratically instead of directly chasing
      if (Math.random() < RAT_ERRATIC_CHANCE) {
        const dx = nearest.position.x - this.state.position.x;
        const dy = nearest.position.y - this.state.position.y;
        const dist = nearest.distance;
        const noiseAngle = (Math.random() - 0.5) * Math.PI * 1.2;
        const baseDx = dx / dist;
        const baseDy = dy / dist;
        const noisedX = baseDx * Math.cos(noiseAngle) - baseDy * Math.sin(noiseAngle);
        const noisedY = baseDx * Math.sin(noiseAngle) + baseDy * Math.cos(noiseAngle);

        const speed = stats.speed / TICK_RATE;
        this.tryMove(noisedX * speed, noisedY * speed, tiles);
        this.updateFacing(dx, dy);
      } else {
        this.moveToward(nearest.position, stats.speed, tiles);
      }

      return this.tryAttack(nearest, this.scaledAttack);
    }

    // Fast random wander
    this.aiState = 'idle';
    this.state.targetPlayerId = null;
    this.wanderTimer -= 1;

    if (this.wanderTimer <= 0) {
      const angle = Math.random() * Math.PI * 2;
      this.wanderDir = { x: Math.cos(angle), y: Math.sin(angle) };
      this.wanderTimer = 15 + Math.floor(Math.random() * 20);
    }

    const speed = stats.speed * 0.5 / TICK_RATE;
    this.tryMove(this.wanderDir.x * speed, this.wanderDir.y * speed, tiles);

    return null;
  }

  // --- Spider: slow chase, web shot to slow players ---
  private updateSpider(
    nearest: { id: string; position: Vec2; distance: number } | null,
    players: ReadonlyArray<{ id: string; position: Vec2; alive: boolean }>,
    tiles: TileType[][],
  ): { targetId: string; damage: number } | null {
    const stats = MONSTER_STATS.spider;

    // Web cooldown tick
    if (this.webCooldown > 0) {
      this.webCooldown -= 1;
    }

    if (nearest && nearest.distance <= DETECTION_RANGE) {
      this.aiState = 'chase';
      this.state.targetPlayerId = nearest.id;

      // Web shot: mark nearest player with slow debuff
      if (this.webCooldown <= 0 && nearest.distance <= DETECTION_RANGE) {
        this.webCooldown = SPIDER_WEB_COOLDOWN;
        this.webTarget = {
          playerId: nearest.id,
          slowMult: SPIDER_WEB_SLOW_MULT,
          slowTicks: SPIDER_WEB_SLOW_DURATION,
        };
      }

      // Chase slightly smarter than slime (faster ratio)
      this.moveToward(nearest.position, stats.speed * 0.85, tiles);
      return this.tryAttack(nearest, this.scaledAttack);
    }

    // Idle wander like slime
    this.aiState = 'idle';
    this.state.targetPlayerId = null;
    this.wanderTimer -= 1;

    if (this.wanderTimer <= 0) {
      const angle = Math.random() * Math.PI * 2;
      this.wanderDir = { x: Math.cos(angle), y: Math.sin(angle) };
      this.wanderTimer = WANDER_CHANGE_INTERVAL + Math.floor(Math.random() * 40);
    }

    const speed = stats.speed * 0.3 / TICK_RATE;
    this.tryMove(this.wanderDir.x * speed, this.wanderDir.y * speed, tiles);

    return null;
  }

  // --- Wraith: phases through walls, periodic invulnerability ---
  private updateWraith(
    nearest: { id: string; position: Vec2; distance: number } | null,
    tiles: TileType[][],
  ): { targetId: string; damage: number } | null {
    const stats = MONSTER_STATS.wraith;

    // Phase mechanic
    this.phaseTimer -= 1;
    if (this.phaseActive) {
      if (this.phaseTimer <= 0) {
        this.phaseActive = false;
        this.phaseTimer = WRAITH_PHASE_INTERVAL;
      }
      // While phased, float toward player but cannot attack or be damaged
      if (nearest && nearest.distance <= DETECTION_RANGE) {
        this.state.targetPlayerId = nearest.id;
        this.moveTowardIgnoreWalls(nearest.position, stats.speed * 0.6);
      }
      this.aiState = 'phase';
      return null;
    }

    if (this.phaseTimer <= 0) {
      this.phaseActive = true;
      this.phaseTimer = WRAITH_PHASE_DURATION;
      return null;
    }

    // Normal behavior: float toward player, ignore walls
    if (nearest && nearest.distance <= DETECTION_RANGE) {
      this.aiState = 'chase';
      this.state.targetPlayerId = nearest.id;
      this.moveTowardIgnoreWalls(nearest.position, stats.speed);
      return this.tryAttack(nearest, this.scaledAttack);
    }

    // Idle wander (ignore walls)
    this.aiState = 'idle';
    this.state.targetPlayerId = null;
    this.wanderTimer -= 1;

    if (this.wanderTimer <= 0) {
      const angle = Math.random() * Math.PI * 2;
      this.wanderDir = { x: Math.cos(angle), y: Math.sin(angle) };
      this.wanderTimer = WANDER_CHANGE_INTERVAL + Math.floor(Math.random() * 30);
    }

    const speed = stats.speed * 0.3 / TICK_RATE;
    this.state.position.x += this.wanderDir.x * speed;
    this.state.position.y += this.wanderDir.y * speed;

    // Clamp to dungeon bounds
    this.state.position.x = Math.max(0, Math.min(DUNGEON_WIDTH - 1, this.state.position.x));
    this.state.position.y = Math.max(0, Math.min(DUNGEON_HEIGHT - 1, this.state.position.y));

    return null;
  }

  // --- Mushroom: tanky, slow, poison aura ---
  private updateMushroom(
    nearest: { id: string; position: Vec2; distance: number } | null,
    players: ReadonlyArray<{ id: string; position: Vec2; alive: boolean }>,
    tiles: TileType[][],
  ): { targetId: string; damage: number } | null {
    const stats = MONSTER_STATS.mushroom;

    // Poison aura tick
    this.poisonTickCounter += 1;
    if (this.poisonTickCounter >= MUSHROOM_POISON_INTERVAL) {
      this.poisonTickCounter = 0;

      // Damage all players within poison range
      for (const player of players) {
        if (!player.alive) continue;
        const dx = player.position.x - this.state.position.x;
        const dy = player.position.y - this.state.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= MUSHROOM_POISON_RANGE) {
          this.poisonAuraTargets.push({
            playerId: player.id,
            damage: MUSHROOM_POISON_DAMAGE,
          });
        }
      }
    }

    // Only chase if player is within aggro range
    if (nearest && nearest.distance <= MUSHROOM_AGGRO_RANGE) {
      this.aiState = 'chase';
      this.state.targetPlayerId = nearest.id;
      this.moveToward(nearest.position, stats.speed, tiles);
      return this.tryAttack(nearest, this.scaledAttack);
    }

    // Very slow idle
    this.aiState = 'idle';
    this.state.targetPlayerId = null;
    this.state.velocity = { x: 0, y: 0 };
    return null;
  }

  /** Move toward target ignoring wall collision (for wraith). */
  private moveTowardIgnoreWalls(target: Vec2, speed: number): void {
    const dx = target.x - this.state.position.x;
    const dy = target.y - this.state.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 0.01) return;

    const effectiveSpeed = speed * this.slowMultiplier;
    const vx = (dx / dist) * effectiveSpeed / TICK_RATE;
    const vy = (dy / dist) * effectiveSpeed / TICK_RATE;

    this.state.position.x += vx;
    this.state.position.y += vy;

    // Clamp to dungeon bounds
    this.state.position.x = Math.max(0, Math.min(DUNGEON_WIDTH - 1, this.state.position.x));
    this.state.position.y = Math.max(0, Math.min(DUNGEON_HEIGHT - 1, this.state.position.y));

    this.state.velocity = { x: vx, y: vy };
    this.updateFacing(dx, dy);
  }

  /** Returns true if the wraith is currently phased (invulnerable). */
  isPhased(): boolean {
    return this.monsterType === 'wraith' && this.phaseActive;
  }

  // --- Boss Demon: charge attack + area damage + summon minions ---
  private updateBossDemon(
    nearest: { id: string; position: Vec2; distance: number } | null,
    tiles: TileType[][],
  ): { targetId: string; damage: number } | null {
    const stats = MONSTER_STATS.boss_demon;

    this.summonCooldown -= 1;

    // Summon minions periodically
    if (this.summonCooldown <= 0) {
      this.summonCooldown = BOSS_SUMMON_COOLDOWN;
      this.shouldSummon = true;
    }

    // Handle charging
    if (this.chargeTimer > 0) {
      this.chargeTimer -= 1;
      const speed = stats.speed * BOSS_CHARGE_SPEED_MULT / TICK_RATE;
      this.tryMove(this.chargeDir.x * speed, this.chargeDir.y * speed, tiles);

      if (nearest && nearest.distance <= ATTACK_RANGE * 1.5 && this.attackCooldown <= 0) {
        this.attackCooldown = Math.floor(TICK_RATE * 0.5);
        return { targetId: nearest.id, damage: Math.floor(this.scaledAttack * 1.5) };
      }

      return null;
    }

    if (!nearest) {
      this.aiState = 'idle';
      this.state.targetPlayerId = null;
      this.state.velocity = { x: 0, y: 0 };
      return null;
    }

    this.state.targetPlayerId = nearest.id;

    // Initiate charge if in range
    if (
      nearest.distance <= BOSS_CHARGE_RANGE &&
      nearest.distance > ATTACK_RANGE &&
      this.attackCooldown <= 0
    ) {
      this.aiState = 'charge';
      this.chargeTimer = BOSS_CHARGE_DURATION;
      const dx = nearest.position.x - this.state.position.x;
      const dy = nearest.position.y - this.state.position.y;
      const dist = nearest.distance;
      this.chargeDir = { x: dx / dist, y: dy / dist };
      this.updateFacing(dx, dy);
      return null;
    }

    // Normal chase
    this.aiState = 'chase';
    this.moveToward(nearest.position, stats.speed, tiles);
    return this.tryAttack(nearest, this.scaledAttack);
  }

  takeDamage(damage: number): number {
    if (!this.state.alive) return 0;

    // Wraith is invulnerable while phased
    if (this.isPhased()) return 0;

    const stats = MONSTER_STATS[this.monsterType];
    const effectiveDamage = Math.max(1, damage - stats.defense);
    this.state.hp -= effectiveDamage;

    if (this.state.hp <= 0) {
      this.state.hp = 0;
      this.state.alive = false;
    }

    return effectiveDamage;
  }

  getState(): MonsterState {
    return { ...this.state };
  }
}

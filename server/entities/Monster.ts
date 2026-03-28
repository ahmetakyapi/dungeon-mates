import {
  MonsterState,
  MonsterType,
  Vec2,
  Direction,
  TileType,
  MONSTER_STATS,
  TICK_RATE,
} from '../../shared/types';

type AIState = 'idle' | 'chase' | 'attack' | 'retreat' | 'charge';

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

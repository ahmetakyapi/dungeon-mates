import {
  PlayerState,
  PlayerClass,
  PlayerInput,
  Vec2,
  Direction,
  TileType,
  LootState,
  LootType,
  CLASS_STATS,
  PLAYER_SPEED,
  TICK_RATE,
} from '../../shared/types';
import { Projectile } from './Projectile';

export type ServerAbilityResult =
  | { type: 'shield_wall' }
  | { type: 'ice_storm'; position: Vec2; damage: number; radius: number }
  | { type: 'arrow_rain'; projectiles: Projectile[] };

const XP_PER_LEVEL = 50;
const LEVEL_STAT_MULTIPLIER = 0.1;
const LOOT_PICKUP_RADIUS = 0.8;
const PLAYER_RADIUS = 0.4;
const RESPAWN_DELAY_TICKS = 5 * TICK_RATE;

const SOLO_MANA_REGEN = 0.08;
const SOLO_HP_REGEN = 0.02;
const SOLO_NO_COMBAT_THRESHOLD = 100; // ticks without damage before HP regen
const SOLO_MAX_DEATHS = 3;
const SOLO_RESPAWN_DELAY_TICKS = 3 * TICK_RATE;

export type MonsterTarget = { position: Vec2; alive: boolean };

export class Player {
  public state: PlayerState;
  public totalDeaths: number;
  public isSolo: boolean;
  public shieldActive: boolean;
  private respawnTimer: number;
  private spawnPosition: Vec2;
  private ticksSinceLastDamage: number;
  private abilityCooldownTicks: number;
  private abilityActiveTicks: number;
  private speedBoostMultiplier: number;
  private speedBoostTicks: number;
  private slowMultiplier: number;
  private slowTicks: number;
  private attackAnimTicks: number;

  constructor(id: string, name: string, spawnPos: Vec2) {
    this.spawnPosition = { ...spawnPos };
    this.respawnTimer = 0;
    this.totalDeaths = 0;
    this.isSolo = false;
    this.ticksSinceLastDamage = 0;
    this.shieldActive = false;
    this.abilityCooldownTicks = 0;
    this.abilityActiveTicks = 0;
    this.speedBoostMultiplier = 1;
    this.speedBoostTicks = 0;
    this.slowMultiplier = 1;
    this.slowTicks = 0;
    this.attackAnimTicks = 0;

    this.state = {
      id,
      name,
      class: 'warrior',
      position: { ...spawnPos },
      velocity: { x: 0, y: 0 },
      hp: 100,
      maxHp: 100,
      mana: 30,
      maxMana: 30,
      attack: 10,
      defense: 5,
      xp: 0,
      level: 1,
      alive: true,
      facing: 'down',
      attacking: false,
      lastAttackTime: 0,
      score: 0,
      abilityActive: false,
      abilityCooldownTicks: 0,
      speedBoosted: false,
      totalDamageDealt: 0,
      goldCollected: 0,
    };
  }

  getRadius(): number {
    return PLAYER_RADIUS;
  }

  selectClass(playerClass: PlayerClass): void {
    const stats = CLASS_STATS[playerClass];
    this.state.class = playerClass;
    this.state.maxHp = stats.maxHp;
    this.state.hp = stats.maxHp;
    this.state.maxMana = stats.maxMana;
    this.state.mana = stats.maxMana;
    this.state.attack = stats.attack;
    this.state.defense = stats.defense;
    this.applyLevelBonuses();
  }

  setSpawnPosition(pos: Vec2): void {
    this.spawnPosition = { ...pos };
  }

  applySlow(multiplier: number, ticks: number): void {
    this.slowMultiplier = multiplier;
    this.slowTicks = ticks;
  }

  processInput(input: PlayerInput, tiles: TileType[][], currentTick: number, monsters: MonsterTarget[] = []): Projectile | null {
    // Tick down ability cooldown
    if (this.abilityCooldownTicks > 0) this.abilityCooldownTicks--;

    // Tick down shield
    if (this.abilityActiveTicks > 0) {
      this.abilityActiveTicks--;
      if (this.abilityActiveTicks <= 0) {
        this.shieldActive = false;
      }
    }

    // Speed boost tick down
    if (this.speedBoostTicks > 0) {
      this.speedBoostTicks--;
      if (this.speedBoostTicks <= 0) {
        this.speedBoostMultiplier = 1;
      }
    }

    // Slow debuff tick down
    if (this.slowTicks > 0) {
      this.slowTicks--;
      if (this.slowTicks <= 0) {
        this.slowMultiplier = 1;
      }
    }

    if (!this.state.alive) {
      this.respawnTimer -= 1;
      if (this.respawnTimer <= 0) {
        this.respawn();
      }
      return null;
    }

    // Normalize movement
    let dx = input.dx;
    let dy = input.dy;
    const mag = Math.sqrt(dx * dx + dy * dy);
    if (mag > 1) {
      dx /= mag;
      dy /= mag;
    }

    // Update facing
    if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
      if (Math.abs(dx) > Math.abs(dy)) {
        this.state.facing = dx > 0 ? 'right' : 'left';
      } else {
        this.state.facing = dy > 0 ? 'down' : 'up';
      }
    }

    // Movement with collision
    const classStats = CLASS_STATS[this.state.class];
    const speed = classStats.speed * PLAYER_SPEED * this.speedBoostMultiplier * this.slowMultiplier / TICK_RATE;

    const newX = this.state.position.x + dx * speed;
    const newY = this.state.position.y + dy * speed;

    // Check X movement
    if (!this.collidesWithWall(newX, this.state.position.y, tiles)) {
      this.state.position.x = newX;
    }
    // Check Y movement
    if (!this.collidesWithWall(this.state.position.x, newY, tiles)) {
      this.state.position.y = newY;
    }

    this.state.velocity = { x: dx * speed, y: dy * speed };

    // Attack
    let projectile: Projectile | null = null;

    if (this.attackAnimTicks > 0) {
      this.attackAnimTicks--;
      this.state.attacking = true;
    } else {
      this.state.attacking = false;
    }

    if (input.attack) {
      const cooldown = classStats.attackCooldown;
      const tickCooldown = Math.ceil(cooldown / (1000 / TICK_RATE));

      if (currentTick - this.state.lastAttackTime >= tickCooldown) {
        this.attackAnimTicks = 4;
        this.state.attacking = true;
        this.state.lastAttackTime = currentTick;
        const aimDir = this.findNearestTarget(monsters);
        projectile = this.createAttack(aimDir ?? undefined);
      }
    }

    // Mana regen (faster in solo)
    const manaRegenRate = this.isSolo ? SOLO_MANA_REGEN : 0.05;
    if (this.state.mana < this.state.maxMana) {
      this.state.mana = Math.min(this.state.maxMana, this.state.mana + manaRegenRate);
    }

    // Solo HP regen when not in combat
    this.ticksSinceLastDamage += 1;
    if (this.isSolo && this.state.hp < this.state.maxHp && this.ticksSinceLastDamage >= SOLO_NO_COMBAT_THRESHOLD) {
      this.state.hp = Math.min(this.state.maxHp, this.state.hp + SOLO_HP_REGEN);
    }

    return projectile;
  }

  private createAttack(aimDir?: Vec2): Projectile | null {
    if (aimDir) {
      this.applyAimFacing(aimDir);
    }
    const dir = aimDir ?? this.getFacingVector();
    const classStats = CLASS_STATS[this.state.class];

    const spawnPos: Vec2 = {
      x: this.state.position.x + dir.x * 0.5,
      y: this.state.position.y + dir.y * 0.5,
    };

    switch (this.state.class) {
      case 'warrior': {
        return new Projectile(
          this.state.id,
          spawnPos,
          dir,
          this.state.attack,
          'sword_slash',
        );
      }
      case 'archer': {
        return new Projectile(
          this.state.id,
          spawnPos,
          dir,
          this.state.attack,
          'arrow',
        );
      }
      case 'mage': {
        const manaCost = 8;
        if (this.state.mana < manaCost) return null;
        this.state.mana -= manaCost;
        return new Projectile(
          this.state.id,
          spawnPos,
          dir,
          this.state.attack,
          'fireball',
        );
      }
    }
  }

  findNearestTarget(monsters: MonsterTarget[]): Vec2 | null {
    const range = CLASS_STATS[this.state.class].attackRange;
    let closest: { dir: Vec2; dist: number } | null = null;

    for (const m of monsters) {
      if (!m.alive) continue;
      const dx = m.position.x - this.state.position.x;
      const dy = m.position.y - this.state.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= range * 1.5 && dist > 0.01 && (!closest || dist < closest.dist)) {
        closest = { dir: { x: dx / dist, y: dy / dist }, dist };
      }
    }

    return closest?.dir ?? null;
  }

  private applyAimFacing(aimDir: Vec2): void {
    if (Math.abs(aimDir.x) > Math.abs(aimDir.y)) {
      this.state.facing = aimDir.x > 0 ? 'right' : 'left';
    } else {
      this.state.facing = aimDir.y > 0 ? 'down' : 'up';
    }
  }

  public getFacingVector(): Vec2 {
    switch (this.state.facing) {
      case 'up': return { x: 0, y: -1 };
      case 'down': return { x: 0, y: 1 };
      case 'left': return { x: -1, y: 0 };
      case 'right': return { x: 1, y: 0 };
    }
  }

  private collidesWithWall(x: number, y: number, tiles: TileType[][]): boolean {
    const r = PLAYER_RADIUS;
    const checks = [
      { cx: x - r, cy: y - r },
      { cx: x + r, cy: y - r },
      { cx: x - r, cy: y + r },
      { cx: x + r, cy: y + r },
    ];

    for (const check of checks) {
      const tileX = Math.floor(check.cx);
      const tileY = Math.floor(check.cy);

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

  takeDamage(damage: number): number {
    if (!this.state.alive) return 0;

    this.ticksSinceLastDamage = 0;

    // Warrior shield: reduce incoming damage by 70%
    if (this.shieldActive) {
      damage = Math.floor(damage * 0.3);
    }

    const effectiveDamage = Math.max(1, damage - this.state.defense);
    this.state.hp -= effectiveDamage;

    if (this.state.hp <= 0) {
      this.state.hp = 0;
      this.state.alive = false;
      this.totalDeaths += 1;

      if (this.isSolo) {
        // Solo: respawn after 3 seconds (until max deaths reached)
        if (this.totalDeaths < SOLO_MAX_DEATHS) {
          this.respawnTimer = SOLO_RESPAWN_DELAY_TICKS;
        }
        // If max deaths reached, no respawn — game checks for defeat
      } else {
        this.respawnTimer = RESPAWN_DELAY_TICKS;
      }
    }

    return effectiveDamage;
  }

  getSoloDeathsRemaining(): number {
    return Math.max(0, SOLO_MAX_DEATHS - this.totalDeaths);
  }

  private respawn(): void {
    this.state.alive = true;
    this.state.hp = Math.floor(this.state.maxHp * 0.5);
    this.state.mana = Math.floor(this.state.maxMana * 0.5);
    this.state.position = { ...this.spawnPosition };
  }

  tryPickupLoot(loot: LootState): boolean {
    if (!this.state.alive) return false;

    const dx = this.state.position.x - loot.position.x;
    const dy = this.state.position.y - loot.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > LOOT_PICKUP_RADIUS) return false;

    this.applyLoot(loot);
    return true;
  }

  private applyLoot(loot: LootState): void {
    switch (loot.type) {
      case 'health_potion':
        this.state.hp = Math.min(this.state.maxHp, this.state.hp + loot.value);
        break;
      case 'mana_potion':
        this.state.mana = Math.min(this.state.maxMana, this.state.mana + loot.value);
        break;
      case 'damage_boost':
        this.state.attack += loot.value;
        break;
      case 'speed_boost':
        this.speedBoostMultiplier = 1 + loot.value; // value is 0.3 → 1.3x speed
        this.speedBoostTicks = 10 * TICK_RATE; // 10 seconds
        break;
      case 'gold':
        this.state.score += loot.value;
        this.state.goldCollected += loot.value;
        break;
    }
  }

  addXp(amount: number): boolean {
    this.state.xp += amount;
    const newLevel = Math.floor(this.state.xp / XP_PER_LEVEL) + 1;

    if (newLevel > this.state.level) {
      this.state.level = newLevel;
      this.applyLevelBonuses();
      this.state.hp = this.state.maxHp;
      this.state.mana = this.state.maxMana;
      return true;
    }

    return false;
  }

  private applyLevelBonuses(): void {
    const baseStats = CLASS_STATS[this.state.class];
    const multiplier = 1 + (this.state.level - 1) * LEVEL_STAT_MULTIPLIER;

    this.state.maxHp = Math.floor(baseStats.maxHp * multiplier);
    this.state.maxMana = Math.floor(baseStats.maxMana * multiplier);
    this.state.attack = Math.floor(baseStats.attack * multiplier);
    this.state.defense = Math.floor(baseStats.defense * multiplier);
  }

  useAbility(monsters: MonsterTarget[] = []): ServerAbilityResult | null {
    if (this.abilityCooldownTicks > 0) return null;

    switch (this.state.class) {
      case 'warrior': {
        if (this.state.mana < 15) return null;
        this.state.mana -= 15;
        this.shieldActive = true;
        this.abilityActiveTicks = 80; // 4 saniye
        this.abilityCooldownTicks = 240; // 12 saniye
        return { type: 'shield_wall' };
      }
      case 'mage': {
        if (this.state.mana < 35) return null;
        this.state.mana -= 35;
        this.abilityCooldownTicks = 300; // 15 saniye
        return {
          type: 'ice_storm',
          position: { ...this.state.position },
          damage: Math.floor(this.state.attack * 1.5),
          radius: 4,
        };
      }
      case 'archer': {
        if (this.state.mana < 20) return null;
        this.state.mana -= 20;
        this.abilityActiveTicks = 10; // 0.5 saniye görsel geri bildirim
        this.abilityCooldownTicks = 200; // 10 saniye
        // Auto-aim toward nearest target
        const aimDir = this.findNearestTarget(monsters);
        if (aimDir) {
          this.applyAimFacing(aimDir);
        }
        const baseDir = aimDir ?? this.getFacingVector();
        // 5 ok yelpaze şeklinde (60 derece açı)
        const spreadAngle = Math.PI / 3; // 60 derece toplam
        const arrows: Projectile[] = [];
        for (let i = 0; i < 5; i++) {
          const angle = Math.atan2(baseDir.y, baseDir.x) + (i - 2) * (spreadAngle / 4);
          const dir = { x: Math.cos(angle), y: Math.sin(angle) };
          const spawnPos = {
            x: this.state.position.x + dir.x * 0.5,
            y: this.state.position.y + dir.y * 0.5,
          };
          arrows.push(new Projectile(this.state.id, spawnPos, dir, this.state.attack, 'arrow'));
        }
        return { type: 'arrow_rain', projectiles: arrows };
      }
    }
  }

  getState(): PlayerState {
    return {
      ...this.state,
      abilityActive: this.shieldActive || this.abilityActiveTicks > 0,
      abilityCooldownTicks: this.abilityCooldownTicks,
      speedBoosted: this.speedBoostMultiplier > 1,
    };
  }
}

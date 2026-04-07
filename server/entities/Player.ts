import {
  PlayerState,
  PlayerClass,
  PlayerInput,
  Vec2,
  Direction,
  TileType,
  LootState,
  LootType,
  TalentId,
  TalentDef,
  TalentBranch,
  CLASS_STATS,
  PLAYER_SPEED,
  TICK_RATE,
  TALENT_TREE,
  levelFromXp,
  xpForLevel,
  totalXpForLevel,
} from '../../shared/types';
import { Projectile } from './Projectile';

export type ServerAbilityResult =
  | { type: 'shield_wall' }
  | { type: 'ice_storm'; position: Vec2; damage: number; radius: number }
  | { type: 'arrow_rain'; projectiles: Projectile[] }
  | { type: 'healing_wave'; position: Vec2; healAmount: number; radius: number };

const LOOT_PICKUP_RADIUS = 0.8;
const PLAYER_RADIUS = 0.4;
const RESPAWN_DELAY_TICKS = 5 * TICK_RATE;
const DODGE_SPEED_MULT = 3.5;
const DODGE_DURATION_TICKS = 6; // ~0.3 seconds
const DODGE_COOLDOWN_TICKS = 30; // ~1.5 seconds
const DODGE_MANA_COST = 5;

const SOLO_MANA_REGEN = 0.06;
const SOLO_HP_REGEN = 0.01;
const SOLO_NO_COMBAT_THRESHOLD = 100;
const SOLO_MAX_DEATHS = 2;
const SOLO_RESPAWN_DELAY_TICKS = 3 * TICK_RATE;

export type MonsterTarget = { position: Vec2; alive: boolean };

export class Player {
  public state: PlayerState;
  public totalDeaths: number;
  public isSolo: boolean;
  public shieldActive: boolean;
  // Talent sistemi — toplam birikmiş efektler
  private talentBonuses: {
    maxHp: number; maxMana: number; attack: number; defense: number; speed: number;
    lifesteal: number; manaCostReduction: number; abilityDamageBonus: number;
    shieldDmgReduction: number; thornsDamage: number;
    critChance: number; critMultiplier: number; dodgeChance: number;
    manaRegen: number; hpRegen: number;
  };
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
  // Dodge/roll state
  private dodging: boolean;
  private dodgeTicks: number;
  private dodgeCooldownTicks: number;
  private dodgeDir: Vec2;
  // Dükkan bonusları (kalıcı)
  private shopBonuses: { maxHp: number; maxMana: number; attack: number; defense: number; speed: number };

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
    this.dodging = false;
    this.dodgeTicks = 0;
    this.dodgeCooldownTicks = 0;
    this.dodgeDir = { x: 0, y: 1 };
    this.talentBonuses = {
      maxHp: 0, maxMana: 0, attack: 0, defense: 0, speed: 0,
      lifesteal: 0, manaCostReduction: 0, abilityDamageBonus: 0,
      shieldDmgReduction: 0, thornsDamage: 0,
      critChance: 0, critMultiplier: 1.5, dodgeChance: 0,
      manaRegen: 0, hpRegen: 0,
    };
    this.shopBonuses = { maxHp: 0, maxMana: 0, attack: 0, defense: 0, speed: 0 };

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
      gold: 0,
      talents: [],
      talentBranch: null,
      pendingTalentChoice: false,
      dodging: false,
      dodgeCooldownTicks: 0,
      stunTicks: 0,
      shieldActive: false,
      poisoned: false,
      slowed: false,
    };
  }

  getRadius(): number {
    return PLAYER_RADIUS;
  }

  selectClass(playerClass: PlayerClass): void {
    this.state.class = playerClass;
    this.recalculateStats();
    this.state.hp = this.state.maxHp;
    this.state.mana = this.state.maxMana;
  }

  setSpawnPosition(pos: Vec2): void {
    this.spawnPosition = { ...pos };
  }

  applySlow(multiplier: number, ticks: number): void {
    this.slowMultiplier = multiplier;
    this.slowTicks = ticks;
  }

  processInput(input: PlayerInput, tiles: TileType[][], currentTick: number, monsters: MonsterTarget[] = [], droughtActive = false): Projectile | null {
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

    // Stun check
    if (this.state.stunTicks > 0) {
      this.state.stunTicks--;
      this.state.velocity = { x: 0, y: 0 };
      return null;
    }

    // Dodge cooldown tick
    if (this.dodgeCooldownTicks > 0) this.dodgeCooldownTicks--;
    this.state.dodgeCooldownTicks = this.dodgeCooldownTicks;

    // Dodge initiation
    if (input.dodge && !this.dodging && this.dodgeCooldownTicks <= 0 && this.state.mana >= DODGE_MANA_COST) {
      this.dodging = true;
      this.dodgeTicks = DODGE_DURATION_TICKS;
      this.dodgeCooldownTicks = DODGE_COOLDOWN_TICKS;
      this.state.mana -= DODGE_MANA_COST;
      // Dodge in movement direction, or facing direction if standing still
      if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
        this.dodgeDir = { x: dx, y: dy };
      } else {
        const dirMap: Record<string, Vec2> = {
          up: { x: 0, y: -1 }, down: { x: 0, y: 1 },
          left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
        };
        this.dodgeDir = dirMap[this.state.facing] ?? { x: 0, y: 1 };
      }
    }

    // During dodge: invincible, fast movement in dodge direction
    if (this.dodging) {
      this.dodgeTicks--;
      this.state.dodging = true;
      if (this.dodgeTicks <= 0) {
        this.dodging = false;
        this.state.dodging = false;
      }
    }

    // Movement with collision
    const classStats = CLASS_STATS[this.state.class];
    const totalSpeed = classStats.speed + this.getShopSpeedBonus();
    const dodgeMult = this.dodging ? DODGE_SPEED_MULT : 1;
    const speed = totalSpeed * PLAYER_SPEED * this.speedBoostMultiplier * this.slowMultiplier * dodgeMult / TICK_RATE;

    // During dodge, use dodge direction; otherwise use input
    const moveX = this.dodging ? this.dodgeDir.x : dx;
    const moveY = this.dodging ? this.dodgeDir.y : dy;
    const newX = this.state.position.x + moveX * speed;
    const newY = this.state.position.y + moveY * speed;

    // Check X movement
    if (!this.collidesWithWall(newX, this.state.position.y, tiles)) {
      this.state.position.x = newX;
    }
    // Check Y movement
    if (!this.collidesWithWall(this.state.position.x, newY, tiles)) {
      this.state.position.y = newY;
    }

    this.state.velocity = { x: moveX * speed, y: moveY * speed };

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

    // Mana regen (faster in solo) + talent bonus — drought halves it
    const baseManaRegen = this.isSolo ? SOLO_MANA_REGEN : 0.03;
    const manaRegenRate = (baseManaRegen + this.talentBonuses.manaRegen) * (droughtActive ? 0.5 : 1);
    if (this.state.mana < this.state.maxMana) {
      this.state.mana = Math.min(this.state.maxMana, this.state.mana + manaRegenRate);
    }

    // HP regen (solo out-of-combat + talent bonus always)
    this.ticksSinceLastDamage += 1;
    if (this.state.hp < this.state.maxHp) {
      let hpRegen = this.talentBonuses.hpRegen;
      if (this.isSolo && this.ticksSinceLastDamage >= SOLO_NO_COMBAT_THRESHOLD) {
        hpRegen += SOLO_HP_REGEN;
      }
      if (hpRegen > 0) {
        this.state.hp = Math.min(this.state.maxHp, this.state.hp + hpRegen);
      }
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
        const manaCost = 12;
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
      case 'healer': {
        const manaCost = 8;
        if (this.state.mana < manaCost) return null;
        this.state.mana -= manaCost;
        return new Projectile(
          this.state.id,
          spawnPos,
          dir,
          this.state.attack,
          'holy_bolt',
        );
      }
    }
  }

  findNearestTarget(monsters: MonsterTarget[]): Vec2 | null {
    const range = CLASS_STATS[this.state.class].attackRange;
    const maxDistSq = (range * 1.5) * (range * 1.5);
    const minDistSq = 0.0001;
    let closestDistSq = Infinity;
    let closestDx = 0;
    let closestDy = 0;

    for (const m of monsters) {
      if (!m.alive) continue;
      const dx = m.position.x - this.state.position.x;
      const dy = m.position.y - this.state.position.y;
      const distSq = dx * dx + dy * dy;

      // Compare squared distances — avoid sqrt until final result
      if (distSq <= maxDistSq && distSq > minDistSq && distSq < closestDistSq) {
        closestDistSq = distSq;
        closestDx = dx;
        closestDy = dy;
      }
    }

    if (closestDistSq === Infinity) return null;
    // Single sqrt only for the final result
    const dist = Math.sqrt(closestDistSq);
    return { x: closestDx / dist, y: closestDy / dist };
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
    const h = tiles.length;
    const w = tiles[0]?.length ?? 0;

    // Check 4 corners without allocating objects
    const x0 = Math.floor(x - r);
    const y0 = Math.floor(y - r);
    const x1 = Math.floor(x + r);
    const y1 = Math.floor(y + r);

    // Early bounds check
    if (x0 < 0 || y0 < 0 || x1 >= w || y1 >= h) return true;

    // Check all 4 corners inline (no array/object allocation)
    const t00 = tiles[y0][x0];
    if (t00 === 'wall' || t00 === 'void') return true;
    const t10 = tiles[y0][x1];
    if (t10 === 'wall' || t10 === 'void') return true;
    const t01 = tiles[y1][x0];
    if (t01 === 'wall' || t01 === 'void') return true;
    const t11 = tiles[y1][x1];
    if (t11 === 'wall' || t11 === 'void') return true;

    return false;
  }

  takeDamage(damage: number): { effectiveDamage: number; thornsDamage: number; dodged: boolean } {
    if (!this.state.alive) return { effectiveDamage: 0, thornsDamage: 0, dodged: false };

    // Dodge roll invincibility
    if (this.dodging) return { effectiveDamage: 0, thornsDamage: 0, dodged: true };

    this.ticksSinceLastDamage = 0;

    // Talent dodge chance kontrolü
    if (this.talentBonuses.dodgeChance > 0 && Math.random() < this.talentBonuses.dodgeChance) {
      return { effectiveDamage: 0, thornsDamage: 0, dodged: true };
    }

    // Warrior shield
    if (this.shieldActive) {
      const reduction = this.talentBonuses.shieldDmgReduction > 0 ? this.talentBonuses.shieldDmgReduction : 0.7;
      damage = Math.floor(damage * (1 - reduction));
    }

    const effectiveDamage = Math.max(1, damage - this.state.defense);
    this.state.hp -= effectiveDamage;

    // Thorns hasarı
    const thornsDamage = this.talentBonuses.thornsDamage;

    if (this.state.hp <= 0) {
      this.state.hp = 0;
      this.state.alive = false;
      this.totalDeaths += 1;

      if (this.isSolo) {
        if (this.totalDeaths < SOLO_MAX_DEATHS) {
          this.respawnTimer = SOLO_RESPAWN_DELAY_TICKS;
        }
      } else {
        this.respawnTimer = RESPAWN_DELAY_TICKS;
      }
    }

    return { effectiveDamage, thornsDamage, dodged: false };
  }

  getSoloDeathsRemaining(): number {
    return Math.max(0, SOLO_MAX_DEATHS - this.totalDeaths);
  }

  /** Check if player can be revived by a teammate standing nearby */
  canBeRevived(): boolean {
    return !this.state.alive && this.respawnTimer > 0;
  }

  /** Revive this player (co-op mechanic) — reviver must channel for ~3 seconds */
  revive(): void {
    if (this.state.alive) return;
    this.state.alive = true;
    this.state.hp = Math.floor(this.state.maxHp * 0.3); // Revive with 30% HP
    this.state.mana = Math.floor(this.state.maxMana * 0.2);
    this.slowMultiplier = 1;
    this.slowTicks = 0;
    this.respawnTimer = 0;
  }

  /** Get remaining respawn ticks (for revive progress display) */
  getRespawnTimer(): number {
    return this.respawnTimer;
  }

  private respawn(): void {
    this.state.alive = true;
    this.state.hp = Math.floor(this.state.maxHp * 0.5);
    this.state.mana = Math.floor(this.state.maxMana * 0.5);
    this.state.position = { ...this.spawnPosition };
    this.slowMultiplier = 1;
    this.slowTicks = 0;
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
        this.state.gold += loot.value;
        this.state.score += loot.value;
        this.state.goldCollected += loot.value;
        break;
    }
  }

  addXp(amount: number): boolean {
    this.state.xp += amount;
    const newLevel = levelFromXp(this.state.xp);

    if (newLevel > this.state.level) {
      this.state.level = newLevel;
      this.recalculateStats();
      this.state.hp = this.state.maxHp;
      this.state.mana = this.state.maxMana;
      this.state.pendingTalentChoice = true;
      return true;
    }

    return false;
  }

  /** Talent seçme */
  selectTalent(talentId: TalentId): boolean {
    const tree = TALENT_TREE[this.state.class];
    const talent = tree.find(t => t.id === talentId);
    if (!talent) return false;
    if (talent.level > this.state.level) return false;
    if (this.state.talents.includes(talentId)) return false;

    // Dalı kilitle (ilk seçimde)
    if (this.state.talentBranch === null) {
      this.state.talentBranch = talent.branch;
    } else if (talent.branch !== this.state.talentBranch) {
      return false; // yanlış dal
    }

    // Bu level için zaten seçilmiş talent var mı?
    const existingForLevel = tree.find(t => t.level === talent.level && this.state.talents.includes(t.id));
    if (existingForLevel) return false;

    this.state.talents.push(talentId);
    this.state.pendingTalentChoice = false;

    // Talent bonuslarını yeniden hesapla
    this.recalculateTalentBonuses();
    this.recalculateStats();

    return true;
  }

  /** Mevcut level için seçilebilir talentleri döndür */
  getAvailableTalents(): TalentDef[] {
    const tree = TALENT_TREE[this.state.class];
    const level = this.state.level;

    // Bu level için zaten seçilmiş mi?
    const alreadySelected = tree.some(t => t.level === level && this.state.talents.includes(t.id));
    if (alreadySelected) return [];

    // Dal belirlenmişse sadece o dalın talent'ını göster
    if (this.state.talentBranch !== null) {
      return tree.filter(t => t.level === level && t.branch === this.state.talentBranch);
    }

    // Dal belirlenmemişse tüm dallardan bu level'deki talent'ları göster
    return tree.filter(t => t.level === level);
  }

  private recalculateTalentBonuses(): void {
    const tree = TALENT_TREE[this.state.class];
    // Reset
    this.talentBonuses = {
      maxHp: 0, maxMana: 0, attack: 0, defense: 0, speed: 0,
      lifesteal: 0, manaCostReduction: 0, abilityDamageBonus: 0,
      shieldDmgReduction: 0, thornsDamage: 0,
      critChance: 0, critMultiplier: 1.5, dodgeChance: 0,
      manaRegen: 0, hpRegen: 0,
    };

    for (const talentId of this.state.talents) {
      const talent = tree.find(t => t.id === talentId);
      if (!talent) continue;
      const e = talent.effects;
      if (e.maxHp) this.talentBonuses.maxHp += e.maxHp;
      if (e.maxMana) this.talentBonuses.maxMana += e.maxMana;
      if (e.attack) this.talentBonuses.attack += e.attack;
      if (e.defense) this.talentBonuses.defense += e.defense;
      if (e.speed) this.talentBonuses.speed += e.speed;
      if (e.lifesteal) this.talentBonuses.lifesteal += e.lifesteal;
      if (e.manaCostReduction) this.talentBonuses.manaCostReduction += e.manaCostReduction;
      if (e.abilityDamageBonus) this.talentBonuses.abilityDamageBonus += e.abilityDamageBonus;
      if (e.shieldDmgReduction) this.talentBonuses.shieldDmgReduction = e.shieldDmgReduction; // override, not additive
      if (e.thornsDamage) this.talentBonuses.thornsDamage += e.thornsDamage;
      if (e.critChance) this.talentBonuses.critChance += e.critChance;
      if (e.critMultiplier) this.talentBonuses.critMultiplier = e.critMultiplier; // override
      if (e.dodgeChance) this.talentBonuses.dodgeChance += e.dodgeChance;
      if (e.manaRegen) this.talentBonuses.manaRegen += e.manaRegen;
      if (e.hpRegen) this.talentBonuses.hpRegen += e.hpRegen;
    }
  }

  /** Shop item satın al */
  buyShopItem(effect: { hp?: number; mana?: number; maxHp?: number; maxMana?: number; attack?: number; defense?: number; speed?: number }, cost: number): boolean {
    if (this.state.gold < cost) return false;
    this.state.gold -= cost;

    // Tüketimlik efektler
    if (effect.hp) {
      this.state.hp = Math.min(this.state.maxHp, this.state.hp + effect.hp);
    }
    if (effect.mana) {
      this.state.mana = Math.min(this.state.maxMana, this.state.mana + effect.mana);
    }
    // Kalıcı yükseltmeler
    if (effect.maxHp) this.shopBonuses.maxHp += effect.maxHp;
    if (effect.maxMana) this.shopBonuses.maxMana += effect.maxMana;
    if (effect.attack) this.shopBonuses.attack += effect.attack;
    if (effect.defense) this.shopBonuses.defense += effect.defense;
    if (effect.speed) this.shopBonuses.speed += effect.speed;

    this.recalculateStats();
    return true;
  }

  /** Tüm stat'ları base + talent + shop bonuslarıyla yeniden hesapla */
  private recalculateStats(): void {
    const baseStats = CLASS_STATS[this.state.class];
    const prevMaxHp = this.state.maxHp;
    const prevMaxMana = this.state.maxMana;

    this.state.maxHp = baseStats.maxHp + this.talentBonuses.maxHp + this.shopBonuses.maxHp;
    this.state.maxMana = baseStats.maxMana + this.talentBonuses.maxMana + this.shopBonuses.maxMana;
    this.state.attack = baseStats.attack + this.talentBonuses.attack + this.shopBonuses.attack;
    this.state.defense = baseStats.defense + this.talentBonuses.defense + this.shopBonuses.defense;

    // HP/Mana artışlarını koru
    if (this.state.maxHp > prevMaxHp) {
      this.state.hp += (this.state.maxHp - prevMaxHp);
    }
    if (this.state.maxMana > prevMaxMana) {
      this.state.mana += (this.state.maxMana - prevMaxMana);
    }
    this.state.hp = Math.min(this.state.hp, this.state.maxHp);
    this.state.mana = Math.min(this.state.mana, this.state.maxMana);
  }

  getTalentBonuses() {
    return this.talentBonuses;
  }

  getShopSpeedBonus(): number {
    return this.shopBonuses.speed + this.talentBonuses.speed;
  }

  useAbility(monsters: MonsterTarget[] = []): ServerAbilityResult | null {
    if (this.abilityCooldownTicks > 0) return null;
    const costReduction = 1 - this.talentBonuses.manaCostReduction;
    const abilityDmgMult = 1 + this.talentBonuses.abilityDamageBonus;

    switch (this.state.class) {
      case 'warrior': {
        const cost = Math.floor(15 * costReduction);
        if (this.state.mana < cost) return null;
        this.state.mana -= cost;
        this.shieldActive = true;
        this.abilityActiveTicks = 80;
        this.abilityCooldownTicks = 240;
        return { type: 'shield_wall' };
      }
      case 'mage': {
        const cost = Math.floor(35 * costReduction);
        if (this.state.mana < cost) return null;
        this.state.mana -= cost;
        this.abilityCooldownTicks = 300;
        return {
          type: 'ice_storm',
          position: { ...this.state.position },
          damage: Math.floor(this.state.attack * 1.5 * abilityDmgMult),
          radius: 4,
        };
      }
      case 'archer': {
        const cost = Math.floor(20 * costReduction);
        if (this.state.mana < cost) return null;
        this.state.mana -= cost;
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
      case 'healer': {
        const cost = Math.floor(30 * costReduction);
        if (this.state.mana < cost) return null;
        this.state.mana -= cost;
        this.abilityActiveTicks = 15; // visual feedback
        this.abilityCooldownTicks = 360;
        const healAmount = Math.floor((20 + this.state.attack * 0.5) * abilityDmgMult);
        return {
          type: 'healing_wave',
          position: { ...this.state.position },
          healAmount,
          radius: 4,
        };
      }
    }
  }

  /** Lifesteal uygula (hasar sonrası) */
  applyLifesteal(damageDealt: number): void {
    if (this.talentBonuses.lifesteal > 0 && this.state.alive) {
      const heal = Math.floor(damageDealt * this.talentBonuses.lifesteal);
      if (heal > 0) {
        this.state.hp = Math.min(this.state.maxHp, this.state.hp + heal);
      }
    }
  }

  /** Kritik vuruş kontrolü */
  rollCrit(): { isCrit: boolean; multiplier: number } {
    if (this.talentBonuses.critChance > 0 && Math.random() < this.talentBonuses.critChance) {
      return { isCrit: true, multiplier: this.talentBonuses.critMultiplier };
    }
    return { isCrit: false, multiplier: 1 };
  }

  getState(): PlayerState {
    return {
      ...this.state,
      abilityActive: this.shieldActive || this.abilityActiveTicks > 0,
      abilityCooldownTicks: this.abilityCooldownTicks,
      speedBoosted: this.speedBoostMultiplier > 1,
      shieldActive: this.shieldActive,
      poisoned: false, // will be set by GameRoom if poison aura active
      slowed: this.slowTicks > 0,
    };
  }
}

import {
  MonsterState,
  MonsterType,
  Vec2,
  Direction,
  TileType,
  DamageType,
  MONSTER_STATS,
  TICK_RATE,
  DEF_K,
  ATTACK_PROFILES,
  TELEGRAPH_NONE,
  STAGGER_TICKS,
  RANGED_MONSTERS,
  rollEliteAffix,
  ARMORED_DEFENSE_MULT,
  SWIFT_SPEED_MULT,
  SUMMONER_COOLDOWN_TICKS,
  DUNGEON_WIDTH,
  DUNGEON_HEIGHT,
} from '../../shared/types';

import {
  type AIState,
  type MonsterContext,
  type PendingAoe,
  resolvePendingAoe,
  DETECTION_RANGE,
  ATTACK_RANGE,
  advanceAttack,
  endAttack,
  SPIDER_WEB_COOLDOWN,
  WRAITH_PHASE_INTERVAL,
  updateSlime,
  updateSkeleton,
  updateBat,
  updateGoblin,
  updateRat,
  updateSpider,
  updateWraith,
  updateMushroom,
  updateRangedCaster,
  updateHeavyMelee,
  updateLavaSlime,
} from './MonsterAI';

import {
  BOSS_CHARGE_RANGE,
  BOSS_CHARGE_SPEED_MULT,
  BOSS_CHARGE_DURATION,
  BOSS_SUMMON_COOLDOWN,
  FORGE_SLAM_COOLDOWN,
  FORGE_OVERHEAT_HP,
  STONE_PETRIFY_COOLDOWN,
  STONE_SHIELD_DR,
  FLAME_CHARGE_COOLDOWN,
  FLAME_SPIN_COOLDOWN,
  updateBossSpiderQueen,
  updateBossDemon,
  updateBossForgeGuardian,
  updateBossStoneWarden,
  updateBossFlameKnight,
} from './BossAI';

const MONSTER_RADIUS_BASE = 0.4;

// How far a monster may drift from its spawn before it walks home (squared, tiles).
const LEASH_RANGE_SQ = 10 * 10;

// Premium combat feel
const MON_HITSTOP_NORMAL_TICKS = 2;
const MON_HITSTOP_CRIT_TICKS = 3;
const MON_HITSTOP_HEAVY_TICKS = 4;
const MON_KNOCKBACK_DECAY = 0.82;
const MON_KNOCKBACK_MIN = 0.02;

let nextMonsterId = 0;

const generateMonsterId = (): string => {
  nextMonsterId += 1;
  return `mon_${nextMonsterId}_${Date.now()}`;
};

export class Monster implements MonsterContext {
  public state: MonsterState;
  public aiState: AIState;
  private readonly monsterType: MonsterType;
  public wanderDir: Vec2;
  public wanderTimer: number;
  public chargeTimer: number;
  public chargeDir: Vec2;
  public summonCooldown: number;
  public attackCooldown: number;
  public radius: number;
  public roomId: number;
  /** Where this monster spawned — leash anchor */
  public readonly spawnPosition: Vec2;
  public shouldSummon: boolean;

  public scaledAttack: number;
  public scaledDefense: number;
  private slowTicks: number;
  public slowMultiplier: number;

  // Wraith phase state
  public phaseTimer: number;
  public phaseActive: boolean;

  // Spider web cooldown
  public webCooldown: number;
  public webTarget: { playerId: string; slowMult: number; slowTicks: number } | null;

  // Mushroom poison aura
  public poisonTickCounter: number;
  public poisonAuraTargets: { playerId: string; damage: number }[];
  public floorSpeedMultiplier: number;

  // Side boss state
  public slamCooldown: number;
  public spinCooldown: number;
  public petrifyGazeCooldown: number;
  public shieldActive: boolean;
  public shieldTicks: number;
  public shieldCooldownTicks: number;
  public flameChargeCooldown: number;
  public flameChargeTimer: number;
  public flameChargeDir: Vec2;
  /** Players already hit by the current charge — prevents per-tick multi-hits */
  public chargeHitPlayerIds: string[];
  /** Who applied the active burn/poison — used to credit XP on DoT kills */
  public burnSourceId: string | null;
  public poisonSourceId: string | null;
  /** AoE hits to apply this tick (populated by boss AI, consumed by GameRoom) */
  public aoeHits: { playerId: string; damage: number }[];
  /** Stun targets to apply this tick */
  public stunTargets: { playerId: string; ticks: number }[];

  // Attack state machine (windup → active → recovery)
  public attackPhaseTicks: number;
  public attackPhaseDuration: number;
  public pendingAttackTargetId: string | null;
  public pendingAttackDamage: number;
  public windupDamageTaken: number;
  /** Set on the active frame of a ranged attack; GameRoom spawns the projectile. */
  public pendingProjectile: { dirX: number; dirY: number; damage: number } | null;
  /** Telegraphed area attack awaiting resolution (boss abilities). */
  public pendingAoe: PendingAoe | null;

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
      isElite: false,
      eliteAffix: '',
      bossPhase: 0,
      shieldActive: false,
      phased: false,
      casting: false,
      enraged: false,
      hitStopTicks: 0,
      knockbackVx: 0,
      knockbackVy: 0,
      knockbackTicks: 0,
      burnTicks: 0,
      freezeTicks: 0,
      poisonTicks: 0,
      attackPhase: 'idle',
      attackProgress: 0,
      telegraphKind: TELEGRAPH_NONE,
      telegraphRadius: 0,
      telegraphDirX: 0,
      telegraphDirY: 1,
      telegraphArc: 0,
      staggerTicks: 0,
    };

    this.monsterType = type;
    this.scaledAttack = stats.attack;
    this.scaledDefense = stats.defense;
    this.aiState = 'idle';
    this.wanderDir = { x: 0, y: 0 };
    this.wanderTimer = 0;
    this.chargeTimer = 0;
    this.chargeDir = { x: 0, y: 0 };
    this.summonCooldown = BOSS_SUMMON_COOLDOWN;
    this.attackCooldown = 0;
    this.radius = MONSTER_RADIUS_BASE * stats.size;
    this.roomId = roomId;
    this.spawnPosition = { x: position.x, y: position.y };
    this.shouldSummon = false;
    this.slowTicks = 0;
    this.slowMultiplier = 1;

    this.phaseTimer = WRAITH_PHASE_INTERVAL;
    this.phaseActive = false;
    this.webCooldown = SPIDER_WEB_COOLDOWN;
    this.webTarget = null;
    this.poisonTickCounter = 0;
    this.poisonAuraTargets = [];
    this.floorSpeedMultiplier = 1;

    // Side boss
    this.slamCooldown = FORGE_SLAM_COOLDOWN;
    this.spinCooldown = FLAME_SPIN_COOLDOWN;
    this.petrifyGazeCooldown = STONE_PETRIFY_COOLDOWN;
    this.shieldActive = false;
    this.shieldTicks = 0;
    this.shieldCooldownTicks = 0;
    this.flameChargeCooldown = FLAME_CHARGE_COOLDOWN;
    this.flameChargeTimer = 0;
    this.flameChargeDir = { x: 0, y: 0 };
    this.chargeHitPlayerIds = [];
    this.burnSourceId = null;
    this.poisonSourceId = null;
    this.aoeHits = [];
    this.stunTargets = [];
    this.attackPhaseTicks = 0;
    this.attackPhaseDuration = 0;
    this.pendingAttackTargetId = null;
    this.pendingAttackDamage = 0;
    this.windupDamageTaken = 0;
    this.pendingProjectile = null;
    this.pendingAoe = null;
  }

  scaleForFloor(hpMultiplier: number, attackMultiplier: number): void {
    const scaledHp = Math.floor(this.state.maxHp * hpMultiplier);
    this.state.maxHp = scaledHp;
    this.state.hp = scaledHp;
    this.scaledAttack = Math.floor(MONSTER_STATS[this.monsterType].attack * attackMultiplier);
    // Defense scales alongside attack — otherwise late-game player damage faces
    // floor-1 mitigation and every hit collapses to raw damage.
    this.scaledDefense = Math.floor(MONSTER_STATS[this.monsterType].defense * attackMultiplier);
  }

  scaleForSolo(): void {
    // Solo mode: bosses keep 85% HP, regular monsters 70%
    const isBoss = this.monsterType.startsWith('boss_');
    const soloScale = isBoss ? 0.85 : 0.7;
    const soloHp = Math.floor(this.state.maxHp * soloScale);
    this.state.maxHp = soloHp;
    this.state.hp = soloHp;
  }

  scaleForPlayerCount(playerCount: number): void {
    if (playerCount <= 1) return;
    const hpScale = 1 + (playerCount - 1) * 0.35;
    const atkScale = 1 + (playerCount - 1) * 0.15;
    this.state.maxHp = Math.floor(this.state.maxHp * hpScale);
    this.state.hp = this.state.maxHp;
    // Compound onto the already floor-scaled attack. Recomputing from base stats
    // here silently discarded scaleForFloor's multiplier, which froze co-op monster
    // damage near floor-1 values while solo kept the full floor scaling.
    this.scaledAttack = Math.floor(this.scaledAttack * atkScale);
  }

  /**
   * Promote to elite. Beyond the stat bump each elite carries an affix that
   * changes how the fight plays, not just how long it lasts.
   */
  makeElite(floor: number): void {
    this.state.isElite = true;
    this.state.maxHp = Math.floor(this.state.maxHp * 2.5);
    this.state.hp = this.state.maxHp;
    this.scaledAttack = Math.floor(this.scaledAttack * 1.5);
    this.scaledDefense = Math.floor(this.scaledDefense * 1.4);
    this.radius *= 1.2;

    const affix = rollEliteAffix(floor);
    this.state.eliteAffix = affix;
    switch (affix) {
      case 'armored':
        this.scaledDefense = Math.floor(this.scaledDefense * ARMORED_DEFENSE_MULT);
        break;
      case 'swift':
        this.floorSpeedMultiplier *= SWIFT_SPEED_MULT;
        break;
      case 'summoner':
        this.summonCooldown = SUMMONER_COOLDOWN_TICKS;
        break;
      case 'vampiric':
      case 'volatile':
        // Handled at damage/death time in GameRoom.
        break;
    }
  }

  getRadius(): number {
    return this.radius;
  }

  /** Decrement every ability cooldown. Runs unconditionally each tick. */
  private tickAbilityCooldowns(): void {
    if (this.summonCooldown > 0) this.summonCooldown -= 1;
    if (this.webCooldown > 0) this.webCooldown -= 1;
    if (this.slamCooldown > 0) this.slamCooldown -= 1;
    if (this.spinCooldown > 0) this.spinCooldown -= 1;
    if (this.petrifyGazeCooldown > 0) this.petrifyGazeCooldown -= 1;
    if (this.flameChargeCooldown > 0) this.flameChargeCooldown -= 1;
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

    // Elemental status effect ticks
    if (this.state.burnTicks > 0) this.state.burnTicks--;
    if (this.state.freezeTicks > 0) {
      this.state.freezeTicks--;
      // Freeze = full stop; skip AI entirely
      this.state.velocity.x = 0;
      this.state.velocity.y = 0;
      return null;
    }
    if (this.state.poisonTicks > 0) this.state.poisonTicks--;

    // Hit-stop: freeze AI briefly for combat weight
    if (this.state.hitStopTicks > 0) {
      this.state.hitStopTicks--;
      this.state.velocity.x = 0;
      this.state.velocity.y = 0;
      return null;
    }

    // Knockback integration
    if (this.state.knockbackTicks > 0) {
      this.state.knockbackTicks--;
      const kbStep = 1 / TICK_RATE;
      const newX = this.state.position.x + this.state.knockbackVx * kbStep;
      const newY = this.state.position.y + this.state.knockbackVy * kbStep;
      if (!this.collidesWithWall(newX, this.state.position.y, tiles)) {
        this.state.position.x = newX;
      } else {
        this.state.knockbackVx = 0;
      }
      if (!this.collidesWithWall(this.state.position.x, newY, tiles)) {
        this.state.position.y = newY;
      } else {
        this.state.knockbackVy = 0;
      }
      this.state.knockbackVx *= MON_KNOCKBACK_DECAY;
      this.state.knockbackVy *= MON_KNOCKBACK_DECAY;
      if (Math.abs(this.state.knockbackVx) < MON_KNOCKBACK_MIN) this.state.knockbackVx = 0;
      if (Math.abs(this.state.knockbackVy) < MON_KNOCKBACK_MIN) this.state.knockbackVy = 0;
      if (this.state.knockbackTicks === 0) {
        this.state.knockbackVx = 0;
        this.state.knockbackVy = 0;
      }
      // During knockback, skip AI
      return null;
    }

    this.shouldSummon = false;
    this.pendingProjectile = null;
    this.webTarget = null;
    this.poisonAuraTargets = [];
    this.aoeHits = [];
    this.stunTargets = [];

    // Ability cooldowns tick every frame, including while an attack is in flight.
    // They used to live inside each AI function, which the attack state machine now
    // short-circuits — so boss slams and summons would have almost never come up.
    this.tickAbilityCooldowns();

    if (this.attackCooldown > 0) {
      this.attackCooldown -= 1;
    }

    // Stagger — interrupted mid-windup, briefly helpless.
    if (this.state.staggerTicks > 0) {
      this.state.staggerTicks -= 1;
      this.state.velocity.x = 0;
      this.state.velocity.y = 0;
      return null;
    }

    // A telegraphed area attack also commits the monster — it plants and casts.
    if (this.pendingAoe) {
      this.state.velocity.x = 0;
      this.state.velocity.y = 0;
      resolvePendingAoe(this, players);
      return null;
    }

    // An attack in flight owns the monster completely: no chasing, no wandering.
    // That commitment is what makes the windup readable — a monster that kept
    // closing distance while winding up would be impossible to react to.
    if (this.state.attackPhase !== 'idle') {
      this.state.velocity.x = 0;
      this.state.velocity.y = 0;
      const result = advanceAttack(this, players);
      if (result && RANGED_MONSTERS.has(this.monsterType)) {
        // Ranged types fire a projectile instead of landing a contact hit.
        this.pendingProjectile = {
          dirX: this.state.telegraphDirX,
          dirY: this.state.telegraphDirY,
          damage: result.damage,
        };
        return null;
      }
      return result;
    }

    const nearest = this.findNearestPlayer(players);

    // Leash: with nobody in aggro range and the monster dragged far from where it
    // spawned, walk back instead of idling wherever the last chase ended.
    if (!this.monsterType.startsWith('boss_') && (!nearest || nearest.distance > DETECTION_RANGE)) {
      const hdx = this.spawnPosition.x - this.state.position.x;
      const hdy = this.spawnPosition.y - this.state.position.y;
      if (hdx * hdx + hdy * hdy > LEASH_RANGE_SQ) {
        this.aiState = 'idle';
        this.state.targetPlayerId = null;
        this.moveToward(this.spawnPosition, MONSTER_STATS[this.monsterType].speed * 0.8, tiles);
        return null;
      }
    }

    switch (this.monsterType) {
      case 'slime':
        return updateSlime(this, nearest, tiles);
      case 'skeleton':
        return updateSkeleton(this, nearest, tiles);
      case 'bat':
        return updateBat(this, nearest, tiles);
      case 'goblin':
        return updateGoblin(this, nearest, tiles);
      case 'rat':
        return updateRat(this, nearest, tiles);
      case 'spider':
        return updateSpider(this, nearest, players, tiles);
      case 'wraith':
        return updateWraith(this, nearest, tiles);
      case 'mushroom':
        return updateMushroom(this, nearest, players, tiles);
      case 'gargoyle':
        return updateRangedCaster(this, nearest, tiles);
      case 'dark_knight':
        return updateHeavyMelee(this, nearest, tiles);
      case 'phantom':
        return updateRangedCaster(this, nearest, tiles);
      case 'lava_slime':
        return updateLavaSlime(this, nearest, tiles);
      case 'boss_spider_queen':
        return updateBossSpiderQueen(this, nearest, players, tiles);
      case 'boss_demon':
        return updateBossDemon(this, nearest, tiles);
      case 'boss_forge_guardian':
        return updateBossForgeGuardian(this, nearest, players, tiles);
      case 'boss_stone_warden':
        return updateBossStoneWarden(this, nearest, players, tiles);
      case 'boss_flame_knight':
        return updateBossFlameKnight(this, nearest, players, tiles);
      default:
        return null;
    }
  }

  // Reusable result object for findNearestPlayer — avoids allocation per tick per monster
  private _nearestResult: { id: string; position: Vec2; distance: number } = { id: '', position: { x: 0, y: 0 }, distance: 0 };

  private findNearestPlayer(
    players: ReadonlyArray<{ id: string; position: Vec2; alive: boolean }>,
  ): { id: string; position: Vec2; distance: number } | null {
    let bestDistSq = Infinity;
    let bestPlayer: typeof players[number] | null = null;

    for (const player of players) {
      if (!player.alive) continue;
      const dx = player.position.x - this.state.position.x;
      const dy = player.position.y - this.state.position.y;
      const distSq = dx * dx + dy * dy;

      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        bestPlayer = player;
      }
    }

    if (!bestPlayer) return null;

    // Single sqrt only for the result
    const r = this._nearestResult;
    r.id = bestPlayer.id;
    r.position = bestPlayer.position;
    r.distance = Math.sqrt(bestDistSq);
    return r;
  }

  // Wall-stuck counter for simple obstacle avoidance
  private wallStuckTicks = 0;
  private wallSlideDir = 0; // -1 or 1 for perpendicular slide direction

  moveToward(target: Vec2, speed: number, tiles: TileType[][]): void {
    const dx = target.x - this.state.position.x;
    const dy = target.y - this.state.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 0.01) return;

    const effectiveSpeed = speed * this.slowMultiplier * this.floorSpeedMultiplier;
    const ndx = dx / dist;
    const ndy = dy / dist;
    let vx = ndx * effectiveSpeed / TICK_RATE;
    let vy = ndy * effectiveSpeed / TICK_RATE;

    const prevX = this.state.position.x;
    const prevY = this.state.position.y;

    this.tryMove(vx, vy, tiles);

    // Wall avoidance: if didn't move, try sliding along the wall
    const movedX = Math.abs(this.state.position.x - prevX) > 0.001;
    const movedY = Math.abs(this.state.position.y - prevY) > 0.001;

    if (!movedX && !movedY) {
      this.wallStuckTicks++;
      // After 3 ticks stuck, try perpendicular slide
      if (this.wallStuckTicks > 3) {
        if (this.wallStuckTicks === 4) {
          // Pick slide direction (perpendicular to movement)
          this.wallSlideDir = Math.random() < 0.5 ? 1 : -1;
        }
        // Try perpendicular: rotate 90 degrees
        const slideVx = -ndy * this.wallSlideDir * effectiveSpeed / TICK_RATE;
        const slideVy = ndx * this.wallSlideDir * effectiveSpeed / TICK_RATE;
        this.tryMove(slideVx, slideVy, tiles);

        // If still stuck after 10 ticks, try other direction
        if (this.wallStuckTicks > 10) {
          this.wallSlideDir = -this.wallSlideDir;
          this.wallStuckTicks = 4;
        }
      }
    } else {
      this.wallStuckTicks = 0;
    }

    this.updateFacing(dx, dy);
  }

  tryMove(vx: number, vy: number, tiles: TileType[][]): void {
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
    const h = tiles.length;
    const w = tiles[0]?.length ?? 0;

    // Check 4 corners inline — no array/object allocation per call
    const x0 = Math.floor(x - r);
    const y0 = Math.floor(y - r);
    const x1 = Math.floor(x + r);
    const y1 = Math.floor(y + r);

    if (x0 < 0 || y0 < 0 || x1 >= w || y1 >= h) return true;

    // door_locked seals the arena for monsters only. Players pass freely so a
    // teammate is never shut out of a fight and retreat stays possible — the
    // point of the lock is to stop enemies leaking into corridors, not to trap
    // the party.
    const t00 = tiles[y0][x0];
    if (t00 === 'wall' || t00 === 'void' || t00 === 'door_locked') return true;
    const t10 = tiles[y0][x1];
    if (t10 === 'wall' || t10 === 'void' || t10 === 'door_locked') return true;
    const t01 = tiles[y1][x0];
    if (t01 === 'wall' || t01 === 'void' || t01 === 'door_locked') return true;
    const t11 = tiles[y1][x1];
    if (t11 === 'wall' || t11 === 'void' || t11 === 'door_locked') return true;

    return false;
  }

  updateFacing(dx: number, dy: number): void {
    if (Math.abs(dx) > Math.abs(dy)) {
      this.state.facing = dx > 0 ? 'right' : 'left';
    } else {
      this.state.facing = dy > 0 ? 'down' : 'up';
    }
  }

  /** Returns true if the wraith is currently phased (invulnerable). */
  isPhased(): boolean {
    return this.monsterType === 'wraith' && this.phaseActive;
  }

  takeDamage(
    damage: number,
    severity: 'normal' | 'crit' | 'heavy' = 'normal',
    damageType: DamageType = 'physical',
    sourceId?: string,
  ): number {
    if (!this.state.alive) return 0;

    // Wraith is invulnerable while phased
    if (this.isPhased()) return 0;

    // Stone Warden rock shield — %70 damage reduction
    if (this.shieldActive) {
      damage = Math.floor(damage * (1 - STONE_SHIELD_DR));
    }

    // Hybrid mitigation: flat subtraction bottomed out at max(1, …) and made high
    // defense meaningless once player damage scaled. Diminishing-returns keeps
    // armour relevant at every tier without ever hard-flooring damage.
    const effectiveDamage = Math.max(1, Math.floor(damage * (DEF_K / (DEF_K + this.scaledDefense))));
    this.state.hp -= effectiveDamage;

    // Elemental status application. Remember who applied the DoT so its ticks can
    // be credited back — DoT kills previously passed a literal 'burning'/'poison'
    // as killerId, which resolved to no player and silently awarded zero XP.
    if (damageType === 'fire') {
      this.state.burnTicks = Math.max(this.state.burnTicks, 40); // 2s burn
      if (sourceId) this.burnSourceId = sourceId;
    } else if (damageType === 'ice') {
      // Ice slows; if already burning, triggers freeze (Faz 3 elemental reaction)
      if (this.state.burnTicks > 0) {
        this.state.freezeTicks = Math.max(this.state.freezeTicks, 30); // 1.5s freeze
        this.state.burnTicks = 0;
      } else {
        this.applySlow(0.5, 40);
      }
    } else if (damageType === 'poison') {
      this.state.poisonTicks = Math.max(this.state.poisonTicks, 60); // 3s poison
      if (sourceId) this.poisonSourceId = sourceId;
    }

    // Poise / interrupt — enough damage during the windup cancels the attack and
    // staggers the monster. This is the reward for punishing a telegraph instead of
    // just backing away from it, and it gives melee builds a reason to trade.
    if (this.state.attackPhase === 'windup') {
      const poise = ATTACK_PROFILES[this.monsterType].poise;
      if (poise > 0) {
        this.windupDamageTaken += effectiveDamage;
        if (this.windupDamageTaken >= poise) {
          endAttack(this, ATTACK_PROFILES[this.monsterType].cooldownTicks);
          this.state.staggerTicks = STAGGER_TICKS;
        }
      }
    }

    // Hit-stop by severity
    const hitStop = severity === 'heavy' ? MON_HITSTOP_HEAVY_TICKS
      : severity === 'crit' ? MON_HITSTOP_CRIT_TICKS
      : MON_HITSTOP_NORMAL_TICKS;
    if (hitStop > this.state.hitStopTicks) this.state.hitStopTicks = hitStop;

    if (this.state.hp <= 0) {
      this.state.hp = 0;
      this.state.alive = false;
    }

    return effectiveDamage;
  }

  /** External knockback from a hit */
  applyKnockback(dirX: number, dirY: number, strength: number, ticks = 3): void {
    const mag = Math.sqrt(dirX * dirX + dirY * dirY);
    if (mag < 0.0001) return;
    // Elite and bosses resist knockback
    const resist = this.state.isElite ? 0.5 : this.monsterType.startsWith('boss_') ? 0.15 : 1;
    this.state.knockbackVx = (dirX / mag) * strength * resist;
    this.state.knockbackVy = (dirY / mag) * strength * resist;
    this.state.knockbackTicks = ticks;
  }

  getState(): MonsterState {
    // Sync internal visual state flags for client rendering
    this.state.shieldActive = this.shieldActive;
    this.state.phased = this.phaseActive;
    this.state.casting = this.webCooldown <= 0 || this.slamCooldown <= 0 || this.spinCooldown <= 0;
    this.state.enraged = this.monsterType === 'boss_forge_guardian' && this.state.hp < this.state.maxHp * FORGE_OVERHEAT_HP;
    return this.state;
  }
}

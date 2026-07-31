import {
  Vec2,
  TileType,
  MonsterType,
  AttackProfile,
  AttackPhase,
  TelegraphKind,
  MONSTER_STATS,
  ATTACK_PROFILES,
  TELEGRAPH_NONE,
  TELEGRAPH_CONE,
  TICK_RATE,
  DUNGEON_WIDTH,
  DUNGEON_HEIGHT,
} from '../../shared/types';

// --- Normal monster constants ---
export const RAT_ERRATIC_CHANCE = 0.3;
export const SPIDER_WEB_COOLDOWN = 70; // ticks
export const SPIDER_WEB_SLOW_MULT = 0.5;
export const SPIDER_WEB_SLOW_DURATION = 40; // ticks
export const WRAITH_PHASE_DURATION = 20; // ticks invulnerable
export const WRAITH_PHASE_INTERVAL = 80; // ticks between phases
export const MUSHROOM_AGGRO_RANGE = 3; // tiles
export const MUSHROOM_POISON_RANGE = 1.5; // tiles
export const MUSHROOM_POISON_DAMAGE = 4;
export const MUSHROOM_POISON_INTERVAL = 15; // ticks

// --- Common constants ---
export const DETECTION_RANGE = 7;
export const ATTACK_RANGE = 1.2;
export const WANDER_CHANGE_INTERVAL = 60; // ticks
export const GOBLIN_RETREAT_HP_RATIO = 0.3;

// --- Types for monster context passed to AI functions ---

export type AIState = 'idle' | 'chase' | 'attack' | 'retreat' | 'charge' | 'phase';

export type NearestPlayer = { id: string; position: Vec2; distance: number };

export type AttackResult = { targetId: string; damage: number } | null;

/** A telegraphed area attack awaiting resolution. */
export type PendingAoe = {
  kind: TelegraphKind;
  radius: number;
  damage: number;
  dirX: number;
  dirY: number;
  arc: number;
  stunTicks: number;
  ticksLeft: number;
  windupTotal: number;
};

/**
 * Shared monster context interface. Monster.ts exposes these fields to AI functions
 * so they can read/write monster state without being class methods.
 */
export interface MonsterContext {
  state: {
    id: string;
    position: Vec2;
    velocity: Vec2;
    hp: number;
    maxHp: number;
    alive: boolean;
    targetPlayerId: string | null;
    facing: string;
    isElite: boolean;
    bossPhase: number;
    shieldActive: boolean;
    phased: boolean;
    casting: boolean;
    enraged: boolean;
    type: string;
    attackPhase: AttackPhase;
    attackProgress: number;
    telegraphKind: TelegraphKind;
    telegraphRadius: number;
    telegraphDirX: number;
    telegraphDirY: number;
    telegraphArc: number;
    staggerTicks: number;
  };
  aiState: AIState;
  wanderDir: Vec2;
  wanderTimer: number;
  attackCooldown: number;
  scaledAttack: number;
  slowMultiplier: number;
  floorSpeedMultiplier: number;
  radius: number;
  shouldSummon: boolean;

  // Wraith
  phaseTimer: number;
  phaseActive: boolean;

  // Spider
  webCooldown: number;
  webTarget: { playerId: string; slowMult: number; slowTicks: number } | null;

  // Mushroom
  poisonTickCounter: number;
  poisonAuraTargets: { playerId: string; damage: number }[];

  // Boss shared fields (needed by some normal monster AI delegations)
  chargeTimer: number;
  chargeDir: Vec2;
  summonCooldown: number;
  aoeHits: { playerId: string; damage: number }[];
  stunTargets: { playerId: string; ticks: number }[];

  // Side boss state
  slamCooldown: number;
  spinCooldown: number;
  petrifyGazeCooldown: number;
  shieldActive: boolean;
  shieldTicks: number;
  shieldCooldownTicks: number;
  flameChargeCooldown: number;
  flameChargeTimer: number;
  flameChargeDir: Vec2;
  /** Players already hit by the current charge (reset when a new charge starts) */
  chargeHitPlayerIds: string[];

  // Attack state machine bookkeeping
  attackPhaseTicks: number;
  attackPhaseDuration: number;
  pendingAttackTargetId: string | null;
  pendingAttackDamage: number;
  windupDamageTaken: number;
  pendingAoe: PendingAoe | null;

  // Movement helpers — bound methods from Monster class
  moveToward(target: Vec2, speed: number, tiles: TileType[][]): void;
  tryMove(vx: number, vy: number, tiles: TileType[][]): void;
  updateFacing(dx: number, dy: number): void;
}

// --- Common helpers ---

/**
 * Begin an attack if in range and off cooldown.
 *
 * This only *starts* the windup — it never deals damage. Damage is resolved later
 * by `advanceAttack` when the active frame arrives, against the player's position
 * at that moment. That delay is the whole point: it is the window the player dodges
 * into. The previous version returned damage the same tick range and cooldown were
 * satisfied, so there was no counterplay at all.
 */
export function tryAttack(
  m: MonsterContext,
  target: { id: string; distance: number; position: Vec2 },
  damage: number,
): AttackResult {
  if (m.state.attackPhase !== 'idle') return null;
  const profile = ATTACK_PROFILES[m.state.type as MonsterType];
  if (target.distance > profile.range || m.attackCooldown > 0) return null;

  m.state.attackPhase = 'windup';
  m.attackPhaseTicks = profile.windupTicks;
  m.attackPhaseDuration = profile.windupTicks;
  m.pendingAttackTargetId = target.id;
  m.pendingAttackDamage = damage;
  m.windupDamageTaken = 0;

  // Aim the telegraph at where the target is right now.
  const dx = target.position.x - m.state.position.x;
  const dy = target.position.y - m.state.position.y;
  const mag = Math.sqrt(dx * dx + dy * dy) || 1;
  m.state.telegraphKind = profile.telegraph;
  m.state.telegraphRadius = profile.range;
  m.state.telegraphDirX = dx / mag;
  m.state.telegraphDirY = dy / mag;
  m.state.telegraphArc = profile.arc;
  m.updateFacing(dx, dy);
  return null;
}

/**
 * Advance an in-flight attack one tick. Returns a hit only on the tick the active
 * frame opens, and only if the target is still inside the telegraphed shape.
 */
export function advanceAttack(
  m: MonsterContext,
  players: ReadonlyArray<{ id: string; position: Vec2; alive: boolean }>,
): AttackResult {
  const profile = ATTACK_PROFILES[m.state.type as MonsterType];
  m.attackPhaseTicks -= 1;
  m.state.attackProgress = m.attackPhaseDuration > 0
    ? 1 - Math.max(0, m.attackPhaseTicks) / m.attackPhaseDuration
    : 1;

  if (m.attackPhaseTicks > 0) return null;

  switch (m.state.attackPhase) {
    case 'windup': {
      m.state.attackPhase = 'active';
      m.attackPhaseTicks = profile.activeTicks;
      m.attackPhaseDuration = profile.activeTicks;
      return resolveAttackHit(m, players, profile);
    }
    case 'active': {
      m.state.attackPhase = 'recovery';
      m.attackPhaseTicks = profile.recoveryTicks;
      m.attackPhaseDuration = profile.recoveryTicks;
      m.state.telegraphKind = TELEGRAPH_NONE;
      return null;
    }
    default: {
      endAttack(m, profile.cooldownTicks);
      return null;
    }
  }
}

/** Check the telegraphed shape against live player positions and return a hit. */
function resolveAttackHit(
  m: MonsterContext,
  players: ReadonlyArray<{ id: string; position: Vec2; alive: boolean }>,
  profile: AttackProfile,
): AttackResult {
  const target = players.find((p) => p.id === m.pendingAttackTargetId && p.alive);
  if (!target) return null;

  const dx = target.position.x - m.state.position.x;
  const dy = target.position.y - m.state.position.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  // Small forgiveness margin so a hit that visually connects still lands.
  if (dist > profile.range + 0.35) return null;

  // Cone attacks additionally require the target to still be in the arc.
  if (profile.telegraph === TELEGRAPH_CONE && dist > 0.01) {
    const dot = (dx / dist) * m.state.telegraphDirX + (dy / dist) * m.state.telegraphDirY;
    if (dot < Math.cos(profile.arc)) return null;
  }

  return { targetId: target.id, damage: m.pendingAttackDamage };
}

/**
 * Begin a telegraphed area attack. The shape is broadcast immediately but damage
 * is not applied until `resolvePendingAoe` fires `windupTicks` later, so players
 * have a real window to walk or dodge out of it.
 */
export function startBossAoe(
  m: MonsterContext,
  opts: {
    kind: TelegraphKind;
    radius: number;
    damage: number;
    windupTicks: number;
    dirX?: number;
    dirY?: number;
    arc?: number;
    stunTicks?: number;
  },
): void {
  m.pendingAoe = {
    kind: opts.kind,
    radius: opts.radius,
    damage: opts.damage,
    dirX: opts.dirX ?? m.state.telegraphDirX,
    dirY: opts.dirY ?? m.state.telegraphDirY,
    arc: opts.arc ?? 0,
    stunTicks: opts.stunTicks ?? 0,
    ticksLeft: opts.windupTicks,
    windupTotal: opts.windupTicks,
  };
  m.state.telegraphKind = opts.kind;
  m.state.telegraphRadius = opts.radius;
  m.state.telegraphDirX = opts.dirX ?? m.state.telegraphDirX;
  m.state.telegraphDirY = opts.dirY ?? m.state.telegraphDirY;
  m.state.telegraphArc = opts.arc ?? 0;
  m.state.attackProgress = 0;
  m.state.casting = true;
}

/**
 * Tick a pending area attack. On the resolution tick it evaluates the shape
 * against *current* player positions — that is what makes dodging work.
 */
export function resolvePendingAoe(
  m: MonsterContext,
  players: ReadonlyArray<{ id: string; position: Vec2; alive: boolean }>,
): void {
  const aoe = m.pendingAoe;
  if (!aoe) return;

  aoe.ticksLeft -= 1;
  m.state.attackProgress = 1 - Math.max(0, aoe.ticksLeft) / Math.max(1, aoe.windupTotal);
  if (aoe.ticksLeft > 0) return;

  for (const player of players) {
    if (!player.alive) continue;
    const dx = player.position.x - m.state.position.x;
    const dy = player.position.y - m.state.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > aoe.radius) continue;

    if (aoe.kind === TELEGRAPH_CONE && dist > 0.01) {
      const dot = (dx / dist) * aoe.dirX + (dy / dist) * aoe.dirY;
      if (dot < Math.cos(aoe.arc)) continue;
    }

    if (aoe.damage > 0) m.aoeHits.push({ playerId: player.id, damage: aoe.damage });
    if (aoe.stunTicks > 0) m.stunTargets.push({ playerId: player.id, ticks: aoe.stunTicks });
  }

  m.pendingAoe = null;
  m.state.telegraphKind = TELEGRAPH_NONE;
  m.state.casting = false;
  m.state.attackProgress = 0;
}

/** Reset the attack state machine and start the cooldown. */
export function endAttack(m: MonsterContext, cooldownTicks: number): void {
  m.state.attackPhase = 'idle';
  m.state.attackProgress = 0;
  m.state.telegraphKind = TELEGRAPH_NONE;
  m.attackPhaseTicks = 0;
  m.attackPhaseDuration = 0;
  m.pendingAttackTargetId = null;
  m.pendingAttackDamage = 0;
  m.windupDamageTaken = 0;
  m.attackCooldown = cooldownTicks;
}

// --- Slime: slow, random wander ---
export function updateSlime(
  m: MonsterContext,
  nearest: NearestPlayer | null,
  tiles: TileType[][],
): AttackResult {
  const stats = MONSTER_STATS.slime;

  if (nearest && nearest.distance <= DETECTION_RANGE) {
    m.aiState = 'chase';
    m.state.targetPlayerId = nearest.id;
    m.moveToward(nearest.position, stats.speed * 0.7, tiles);
    return tryAttack(m, nearest, m.scaledAttack);
  }

  // Random wander
  m.aiState = 'idle';
  m.state.targetPlayerId = null;
  m.wanderTimer -= 1;

  if (m.wanderTimer <= 0) {
    const angle = Math.random() * Math.PI * 2;
    m.wanderDir = { x: Math.cos(angle), y: Math.sin(angle) };
    m.wanderTimer = WANDER_CHANGE_INTERVAL + Math.floor(Math.random() * 40);
  }

  const speed = stats.speed * 0.3 / TICK_RATE;
  m.tryMove(m.wanderDir.x * speed, m.wanderDir.y * speed, tiles);

  return null;
}

// --- Skeleton: direct chase ---
export function updateSkeleton(
  m: MonsterContext,
  nearest: NearestPlayer | null,
  tiles: TileType[][],
): AttackResult {
  const stats = MONSTER_STATS.skeleton;

  if (nearest && nearest.distance <= DETECTION_RANGE) {
    m.aiState = 'chase';
    m.state.targetPlayerId = nearest.id;
    m.moveToward(nearest.position, stats.speed, tiles);
    return tryAttack(m, nearest, m.scaledAttack);
  }

  m.aiState = 'idle';
  m.state.targetPlayerId = null;
  m.state.velocity = { x: 0, y: 0 };
  return null;
}

// --- Bat: fast, erratic ---
export function updateBat(
  m: MonsterContext,
  nearest: NearestPlayer | null,
  tiles: TileType[][],
): AttackResult {
  const stats = MONSTER_STATS.bat;

  if (nearest && nearest.distance <= DETECTION_RANGE) {
    m.aiState = 'chase';
    m.state.targetPlayerId = nearest.id;

    // Erratic: add noise to movement direction
    const dx = nearest.position.x - m.state.position.x;
    const dy = nearest.position.y - m.state.position.y;
    const dist = nearest.distance;

    const noiseAngle = (Math.random() - 0.5) * Math.PI * 0.8;
    const baseDx = dx / dist;
    const baseDy = dy / dist;
    const noisedX = baseDx * Math.cos(noiseAngle) - baseDy * Math.sin(noiseAngle);
    const noisedY = baseDx * Math.sin(noiseAngle) + baseDy * Math.cos(noiseAngle);

    const speed = stats.speed / TICK_RATE;
    m.tryMove(noisedX * speed, noisedY * speed, tiles);
    m.updateFacing(dx, dy);

    return tryAttack(m, nearest, m.scaledAttack);
  }

  // Fast random wander
  m.aiState = 'idle';
  m.state.targetPlayerId = null;
  m.wanderTimer -= 1;

  if (m.wanderTimer <= 0) {
    const angle = Math.random() * Math.PI * 2;
    m.wanderDir = { x: Math.cos(angle), y: Math.sin(angle) };
    m.wanderTimer = 20 + Math.floor(Math.random() * 20);
  }

  const speed = stats.speed * 0.4 / TICK_RATE;
  m.tryMove(m.wanderDir.x * speed, m.wanderDir.y * speed, tiles);

  return null;
}

// --- Goblin: chase + retreat when low hp ---
export function updateGoblin(
  m: MonsterContext,
  nearest: NearestPlayer | null,
  tiles: TileType[][],
): AttackResult {
  const stats = MONSTER_STATS.goblin;
  const hpRatio = m.state.hp / m.state.maxHp;

  if (nearest && nearest.distance <= DETECTION_RANGE) {
    m.state.targetPlayerId = nearest.id;

    if (hpRatio <= GOBLIN_RETREAT_HP_RATIO && nearest.distance < 3) {
      // Retreat: move away from player
      m.aiState = 'retreat';
      const dx = m.state.position.x - nearest.position.x;
      const dy = m.state.position.y - nearest.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 0.01) {
        const speed = stats.speed * 1.2 / TICK_RATE;
        m.tryMove((dx / dist) * speed, (dy / dist) * speed, tiles);
        m.updateFacing(-dx, -dy);
      }

      return null;
    }

    m.aiState = 'chase';
    m.moveToward(nearest.position, stats.speed, tiles);
    return tryAttack(m, nearest, m.scaledAttack);
  }

  m.aiState = 'idle';
  m.state.targetPlayerId = null;
  m.state.velocity = { x: 0, y: 0 };
  return null;
}

// --- Rat: very fast, erratic chase, small ---
export function updateRat(
  m: MonsterContext,
  nearest: NearestPlayer | null,
  tiles: TileType[][],
): AttackResult {
  const stats = MONSTER_STATS.rat;

  if (nearest && nearest.distance <= DETECTION_RANGE) {
    m.aiState = 'chase';
    m.state.targetPlayerId = nearest.id;

    // Sometimes move erratically instead of directly chasing
    if (Math.random() < RAT_ERRATIC_CHANCE) {
      const dx = nearest.position.x - m.state.position.x;
      const dy = nearest.position.y - m.state.position.y;
      const dist = nearest.distance;
      const noiseAngle = (Math.random() - 0.5) * Math.PI * 1.2;
      const baseDx = dx / dist;
      const baseDy = dy / dist;
      const noisedX = baseDx * Math.cos(noiseAngle) - baseDy * Math.sin(noiseAngle);
      const noisedY = baseDx * Math.sin(noiseAngle) + baseDy * Math.cos(noiseAngle);

      const speed = stats.speed / TICK_RATE;
      m.tryMove(noisedX * speed, noisedY * speed, tiles);
      m.updateFacing(dx, dy);
    } else {
      m.moveToward(nearest.position, stats.speed, tiles);
    }

    return tryAttack(m, nearest, m.scaledAttack);
  }

  // Fast random wander
  m.aiState = 'idle';
  m.state.targetPlayerId = null;
  m.wanderTimer -= 1;

  if (m.wanderTimer <= 0) {
    const angle = Math.random() * Math.PI * 2;
    m.wanderDir = { x: Math.cos(angle), y: Math.sin(angle) };
    m.wanderTimer = 15 + Math.floor(Math.random() * 20);
  }

  const speed = stats.speed * 0.5 / TICK_RATE;
  m.tryMove(m.wanderDir.x * speed, m.wanderDir.y * speed, tiles);

  return null;
}

// --- Spider: slow chase, web shot to slow players ---
export function updateSpider(
  m: MonsterContext,
  nearest: NearestPlayer | null,
  players: ReadonlyArray<{ id: string; position: Vec2; alive: boolean }>,
  tiles: TileType[][],
): AttackResult {
  const stats = MONSTER_STATS.spider;

  // Web cooldown tick
  if (m.webCooldown > 0) {
    m.webCooldown -= 1;
  }

  if (nearest && nearest.distance <= DETECTION_RANGE) {
    m.aiState = 'chase';
    m.state.targetPlayerId = nearest.id;

    // Web shot: mark nearest player with slow debuff
    if (m.webCooldown <= 0 && nearest.distance <= DETECTION_RANGE) {
      m.webCooldown = SPIDER_WEB_COOLDOWN;
      m.webTarget = {
        playerId: nearest.id,
        slowMult: SPIDER_WEB_SLOW_MULT,
        slowTicks: SPIDER_WEB_SLOW_DURATION,
      };
    }

    // Chase slightly smarter than slime (faster ratio)
    m.moveToward(nearest.position, stats.speed * 0.85, tiles);
    return tryAttack(m, nearest, m.scaledAttack);
  }

  // Idle wander like slime
  m.aiState = 'idle';
  m.state.targetPlayerId = null;
  m.wanderTimer -= 1;

  if (m.wanderTimer <= 0) {
    const angle = Math.random() * Math.PI * 2;
    m.wanderDir = { x: Math.cos(angle), y: Math.sin(angle) };
    m.wanderTimer = WANDER_CHANGE_INTERVAL + Math.floor(Math.random() * 40);
  }

  const speed = stats.speed * 0.3 / TICK_RATE;
  m.tryMove(m.wanderDir.x * speed, m.wanderDir.y * speed, tiles);

  return null;
}

// --- Wraith: phases through walls, periodic invulnerability ---
export function updateWraith(
  m: MonsterContext,
  nearest: NearestPlayer | null,
  tiles: TileType[][],
): AttackResult {
  const stats = MONSTER_STATS.wraith;

  // Phase mechanic
  m.phaseTimer -= 1;
  if (m.phaseActive) {
    if (m.phaseTimer <= 0) {
      m.phaseActive = false;
      m.phaseTimer = WRAITH_PHASE_INTERVAL;
    }
    // While phased, float toward player but cannot attack or be damaged
    if (nearest && nearest.distance <= DETECTION_RANGE) {
      m.state.targetPlayerId = nearest.id;
      moveTowardIgnoreWalls(m, nearest.position, stats.speed * 0.6);
    }
    m.aiState = 'phase';
    return null;
  }

  if (m.phaseTimer <= 0) {
    m.phaseActive = true;
    m.phaseTimer = WRAITH_PHASE_DURATION;
    return null;
  }

  // Normal behavior: float toward player, ignore walls
  if (nearest && nearest.distance <= DETECTION_RANGE) {
    m.aiState = 'chase';
    m.state.targetPlayerId = nearest.id;
    moveTowardIgnoreWalls(m, nearest.position, stats.speed);
    return tryAttack(m, nearest, m.scaledAttack);
  }

  // Idle wander (ignore walls)
  m.aiState = 'idle';
  m.state.targetPlayerId = null;
  m.wanderTimer -= 1;

  if (m.wanderTimer <= 0) {
    const angle = Math.random() * Math.PI * 2;
    m.wanderDir = { x: Math.cos(angle), y: Math.sin(angle) };
    m.wanderTimer = WANDER_CHANGE_INTERVAL + Math.floor(Math.random() * 30);
  }

  const speed = stats.speed * 0.3 / TICK_RATE;
  m.state.position.x += m.wanderDir.x * speed;
  m.state.position.y += m.wanderDir.y * speed;

  // Clamp to dungeon bounds
  m.state.position.x = Math.max(0, Math.min(DUNGEON_WIDTH - 1, m.state.position.x));
  m.state.position.y = Math.max(0, Math.min(DUNGEON_HEIGHT - 1, m.state.position.y));

  return null;
}

// --- Mushroom: tanky, slow, poison aura ---
export function updateMushroom(
  m: MonsterContext,
  nearest: NearestPlayer | null,
  players: ReadonlyArray<{ id: string; position: Vec2; alive: boolean }>,
  tiles: TileType[][],
): AttackResult {
  const stats = MONSTER_STATS.mushroom;

  // Poison aura tick
  m.poisonTickCounter += 1;
  if (m.poisonTickCounter >= MUSHROOM_POISON_INTERVAL) {
    m.poisonTickCounter = 0;

    // Damage all players within poison range
    for (const player of players) {
      if (!player.alive) continue;
      const dx = player.position.x - m.state.position.x;
      const dy = player.position.y - m.state.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= MUSHROOM_POISON_RANGE) {
        m.poisonAuraTargets.push({
          playerId: player.id,
          damage: MUSHROOM_POISON_DAMAGE,
        });
      }
    }
  }

  // Only chase if player is within aggro range
  if (nearest && nearest.distance <= MUSHROOM_AGGRO_RANGE) {
    m.aiState = 'chase';
    m.state.targetPlayerId = nearest.id;
    m.moveToward(nearest.position, stats.speed, tiles);
    return tryAttack(m, nearest, m.scaledAttack);
  }

  // Very slow idle
  m.aiState = 'idle';
  m.state.targetPlayerId = null;
  m.state.velocity = { x: 0, y: 0 };
  return null;
}

/** Move toward target ignoring wall collision (for wraith). */
export function moveTowardIgnoreWalls(m: MonsterContext, target: Vec2, speed: number): void {
  const dx = target.x - m.state.position.x;
  const dy = target.y - m.state.position.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 0.01) return;

  const effectiveSpeed = speed * m.slowMultiplier;
  const vx = (dx / dist) * effectiveSpeed / TICK_RATE;
  const vy = (dy / dist) * effectiveSpeed / TICK_RATE;

  m.state.position.x += vx;
  m.state.position.y += vy;

  // Clamp to dungeon bounds
  m.state.position.x = Math.max(0, Math.min(DUNGEON_WIDTH - 1, m.state.position.x));
  m.state.position.y = Math.max(0, Math.min(DUNGEON_HEIGHT - 1, m.state.position.y));

  m.state.velocity = { x: vx, y: vy };
  m.updateFacing(dx, dy);
}

// --- Ranged caster (gargoyle, phantom): keeps its distance and shoots ---
// These used to be copies of the skeleton/wraith melee AI, so a whole floor of
// "ranged" enemies played identically to floor-1 chasers. Kiting gives the player
// a reason to move and repositions the fight around cover.
export const CASTER_PREFERRED_MIN = 3.5; // tiles — closer than this, back off
export const CASTER_STRAFE_CHANCE = 0.02;

export function updateRangedCaster(
  m: MonsterContext,
  nearest: NearestPlayer | null,
  tiles: TileType[][],
): AttackResult {
  const stats = MONSTER_STATS[m.state.type as MonsterType];
  const profile = ATTACK_PROFILES[m.state.type as MonsterType];

  if (!nearest || nearest.distance > DETECTION_RANGE + 2) {
    m.aiState = 'idle';
    m.state.targetPlayerId = null;
    m.state.velocity = { x: 0, y: 0 };
    return null;
  }

  m.state.targetPlayerId = nearest.id;

  // Too close — retreat to regain firing distance.
  if (nearest.distance < CASTER_PREFERRED_MIN) {
    m.aiState = 'retreat';
    const dx = m.state.position.x - nearest.position.x;
    const dy = m.state.position.y - nearest.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 0.01) {
      const speed = stats.speed * 1.1 / TICK_RATE;
      m.tryMove((dx / dist) * speed, (dy / dist) * speed, tiles);
    }
    m.updateFacing(-dx, -dy);
    return null;
  }

  // In range — hold position and fire.
  if (nearest.distance <= profile.range) {
    m.aiState = 'attack';
    m.state.velocity = { x: 0, y: 0 };
    // Occasional strafe so it is not a static turret.
    if (Math.random() < CASTER_STRAFE_CHANCE) {
      const dx = nearest.position.x - m.state.position.x;
      const dy = nearest.position.y - m.state.position.y;
      const speed = stats.speed * 0.6 / TICK_RATE;
      m.tryMove(-dy * speed, dx * speed, tiles);
    }
    return tryAttack(m, nearest, m.scaledAttack);
  }

  // Out of range — close the gap.
  m.aiState = 'chase';
  m.moveToward(nearest.position, stats.speed * 0.9, tiles);
  return null;
}

// --- Heavy melee (dark knight): relentless, never retreats, hits hard ---
// Previously reused the goblin AI, which made the game's toughest regular enemy
// flee at 30% HP like a floor-3 mook.
export function updateHeavyMelee(
  m: MonsterContext,
  nearest: NearestPlayer | null,
  tiles: TileType[][],
): AttackResult {
  const stats = MONSTER_STATS[m.state.type as MonsterType];

  if (!nearest || nearest.distance > DETECTION_RANGE + 3) {
    m.aiState = 'idle';
    m.state.targetPlayerId = null;
    m.state.velocity = { x: 0, y: 0 };
    return null;
  }

  m.aiState = 'chase';
  m.state.targetPlayerId = nearest.id;
  // Speeds up as it gets wounded rather than fleeing — pressure, not retreat.
  const rage = m.state.hp / m.state.maxHp < 0.4 ? 1.25 : 1.0;
  m.moveToward(nearest.position, stats.speed * rage, tiles);
  return tryAttack(m, nearest, m.scaledAttack);
}

// --- Lava slime: slow but committed, and it does not lose interest ---
export function updateLavaSlime(
  m: MonsterContext,
  nearest: NearestPlayer | null,
  tiles: TileType[][],
): AttackResult {
  const stats = MONSTER_STATS.lava_slime;

  if (nearest && nearest.distance <= DETECTION_RANGE + 1) {
    m.aiState = 'chase';
    m.state.targetPlayerId = nearest.id;
    m.moveToward(nearest.position, stats.speed, tiles);
    return tryAttack(m, nearest, m.scaledAttack);
  }

  m.aiState = 'idle';
  m.state.targetPlayerId = null;
  m.wanderTimer -= 1;
  if (m.wanderTimer <= 0) {
    const angle = Math.random() * Math.PI * 2;
    m.wanderDir = { x: Math.cos(angle), y: Math.sin(angle) };
    m.wanderTimer = WANDER_CHANGE_INTERVAL + Math.floor(Math.random() * 30);
  }
  const speed = stats.speed * 0.35 / TICK_RATE;
  m.tryMove(m.wanderDir.x * speed, m.wanderDir.y * speed, tiles);
  return null;
}

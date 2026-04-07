import {
  Vec2,
  TileType,
  MONSTER_STATS,
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
  flameChargeCooldown: number;
  flameChargeTimer: number;
  flameChargeDir: Vec2;

  // Movement helpers — bound methods from Monster class
  moveToward(target: Vec2, speed: number, tiles: TileType[][]): void;
  tryMove(vx: number, vy: number, tiles: TileType[][]): void;
  updateFacing(dx: number, dy: number): void;
}

// --- Common helpers ---

export function tryAttack(
  m: MonsterContext,
  target: { id: string; distance: number },
  damage: number,
): AttackResult {
  if (target.distance <= ATTACK_RANGE && m.attackCooldown <= 0) {
    m.attackCooldown = Math.floor(TICK_RATE * 0.8);
    return { targetId: target.id, damage };
  }
  return null;
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

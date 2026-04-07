import {
  Vec2,
  TileType,
  MONSTER_STATS,
  TICK_RATE,
} from '../../shared/types';

import {
  type MonsterContext,
  type NearestPlayer,
  type AttackResult,
  DETECTION_RANGE,
  ATTACK_RANGE,
  SPIDER_WEB_COOLDOWN,
  SPIDER_WEB_SLOW_MULT,
  SPIDER_WEB_SLOW_DURATION,
  tryAttack,
} from './MonsterAI';

// --- Boss charge constants ---
export const BOSS_CHARGE_RANGE = 6;
export const BOSS_CHARGE_SPEED_MULT = 3.0;
export const BOSS_CHARGE_DURATION = 20; // ticks
export const BOSS_SUMMON_COOLDOWN = 200; // ticks

// --- Forge Guardian constants ---
export const FORGE_SLAM_COOLDOWN = 120; // ticks — AoE slam every 6s
export const FORGE_SLAM_RANGE = 2.5; // tiles
export const FORGE_SLAM_DAMAGE_MULT = 1.8;
export const FORGE_OVERHEAT_HP = 0.5; // enrage at 50% HP

// --- Stone Warden constants ---
export const STONE_PETRIFY_COOLDOWN = 150; // ticks — petrify gaze every 7.5s
export const STONE_PETRIFY_RANGE = 4; // tiles
export const STONE_PETRIFY_STUN_TICKS = 40; // 2 seconds
export const STONE_SHIELD_HP = 0.4; // rock shield at 40% HP
export const STONE_SHIELD_DURATION = 80; // 4 seconds
export const STONE_SHIELD_DR = 0.7; // %70 damage reduction

// --- Flame Knight constants ---
export const FLAME_CHARGE_COOLDOWN = 100; // ticks — charge every 5s
export const FLAME_CHARGE_SPEED_MULT = 4.0;
export const FLAME_CHARGE_DURATION = 15; // ticks
export const FLAME_SPIN_COOLDOWN = 160; // ticks — spinning slash every 8s
export const FLAME_SPIN_RANGE = 2.0; // tiles
export const FLAME_SPIN_DAMAGE_MULT = 2.0;

// --- Selvira (Spider Queen): web swarms, 2 phases at 50% HP ---
export function updateBossSpiderQueen(
  m: MonsterContext,
  nearest: NearestPlayer | null,
  players: ReadonlyArray<{ id: string; position: Vec2; alive: boolean }>,
  tiles: TileType[][],
): AttackResult {
  const stats = MONSTER_STATS.boss_spider_queen;

  m.summonCooldown -= 1;
  if (m.webCooldown > 0) m.webCooldown -= 1;

  // Phase 2 at 50% HP: faster web, more summons, web all players
  const hpRatio = m.state.hp / m.state.maxHp;
  const phase2 = hpRatio <= 0.5;
  if (phase2 && m.state.bossPhase < 1) {
    m.state.bossPhase = 1;
  }

  const webCd = phase2 ? Math.floor(SPIDER_WEB_COOLDOWN * 0.5) : SPIDER_WEB_COOLDOWN;
  const summonCd = phase2 ? Math.floor(BOSS_SUMMON_COOLDOWN * 0.6) : BOSS_SUMMON_COOLDOWN;

  // Web shot — in phase 2, webs ALL players in range
  if (m.webCooldown <= 0 && nearest && nearest.distance <= DETECTION_RANGE) {
    m.webCooldown = webCd;
    if (phase2) {
      // Web all nearby players
      for (const player of players) {
        if (!player.alive) continue;
        const dx = player.position.x - m.state.position.x;
        const dy = player.position.y - m.state.position.y;
        if (Math.sqrt(dx * dx + dy * dy) <= DETECTION_RANGE) {
          m.stunTargets.push({ playerId: player.id, ticks: SPIDER_WEB_SLOW_DURATION });
        }
      }
    } else {
      m.webTarget = {
        playerId: nearest.id,
        slowMult: SPIDER_WEB_SLOW_MULT,
        slowTicks: SPIDER_WEB_SLOW_DURATION,
      };
    }
  }

  // Summon spider minions
  if (m.summonCooldown <= 0) {
    m.summonCooldown = summonCd;
    m.shouldSummon = true;
  }

  // Handle charging (same as demon)
  if (m.chargeTimer > 0) {
    m.chargeTimer -= 1;
    const speed = stats.speed * BOSS_CHARGE_SPEED_MULT / TICK_RATE;
    m.tryMove(m.chargeDir.x * speed, m.chargeDir.y * speed, tiles);
    if (nearest && nearest.distance <= ATTACK_RANGE * 1.5 && m.attackCooldown <= 0) {
      m.attackCooldown = Math.floor(TICK_RATE * 0.35);
      return { targetId: nearest.id, damage: Math.floor(m.scaledAttack * 1.5) };
    }
    return null;
  }

  if (!nearest) {
    m.aiState = 'idle';
    m.state.targetPlayerId = null;
    m.state.velocity = { x: 0, y: 0 };
    return null;
  }

  m.state.targetPlayerId = nearest.id;

  if (nearest.distance <= BOSS_CHARGE_RANGE && nearest.distance > ATTACK_RANGE && m.attackCooldown <= 0) {
    m.aiState = 'charge';
    m.chargeTimer = BOSS_CHARGE_DURATION;
    const dx = nearest.position.x - m.state.position.x;
    const dy = nearest.position.y - m.state.position.y;
    const dist = nearest.distance;
    m.chargeDir = { x: dx / dist, y: dy / dist };
    m.updateFacing(dx, dy);
    return null;
  }

  m.aiState = 'chase';
  m.moveToward(nearest.position, stats.speed * (phase2 ? 1.2 : 1.0), tiles);
  return tryAttack(m, nearest, m.scaledAttack);
}

// --- Karanmir (Boss Demon): 3 phases at 75/50/25% HP ---
export function updateBossDemon(
  m: MonsterContext,
  nearest: NearestPlayer | null,
  tiles: TileType[][],
): AttackResult {
  const stats = MONSTER_STATS.boss_demon;

  m.summonCooldown -= 1;

  // Phase transitions: 0→1 at 75%, 1→2 at 50%, 2→3 at 25%
  const hpRatio = m.state.hp / m.state.maxHp;
  if (hpRatio <= 0.25 && m.state.bossPhase < 3) {
    m.state.bossPhase = 3;
  } else if (hpRatio <= 0.5 && m.state.bossPhase < 2) {
    m.state.bossPhase = 2;
  } else if (hpRatio <= 0.75 && m.state.bossPhase < 1) {
    m.state.bossPhase = 1;
  }

  const phase = m.state.bossPhase;

  // Phase scaling: faster summons, faster charges, more damage
  const summonCdMult = phase >= 3 ? 0.4 : phase >= 2 ? 0.6 : phase >= 1 ? 0.8 : 1.0;
  const speedMult = phase >= 3 ? 1.5 : phase >= 2 ? 1.3 : phase >= 1 ? 1.1 : 1.0;
  const atkMult = phase >= 3 ? 1.6 : phase >= 2 ? 1.3 : phase >= 1 ? 1.1 : 1.0;

  // Summon minions periodically
  if (m.summonCooldown <= 0) {
    m.summonCooldown = Math.floor(BOSS_SUMMON_COOLDOWN * summonCdMult);
    m.shouldSummon = true;
  }

  // Handle charging
  if (m.chargeTimer > 0) {
    m.chargeTimer -= 1;
    const speed = stats.speed * BOSS_CHARGE_SPEED_MULT * speedMult / TICK_RATE;
    m.tryMove(m.chargeDir.x * speed, m.chargeDir.y * speed, tiles);

    if (nearest && nearest.distance <= ATTACK_RANGE * 1.5 && m.attackCooldown <= 0) {
      m.attackCooldown = Math.floor(TICK_RATE * 0.35);
      return { targetId: nearest.id, damage: Math.floor(m.scaledAttack * 1.5 * atkMult) };
    }

    return null;
  }

  if (!nearest) {
    m.aiState = 'idle';
    m.state.targetPlayerId = null;
    m.state.velocity = { x: 0, y: 0 };
    return null;
  }

  m.state.targetPlayerId = nearest.id;

  // Initiate charge if in range
  if (
    nearest.distance <= BOSS_CHARGE_RANGE &&
    nearest.distance > ATTACK_RANGE &&
    m.attackCooldown <= 0
  ) {
    m.aiState = 'charge';
    m.chargeTimer = BOSS_CHARGE_DURATION;
    const dx = nearest.position.x - m.state.position.x;
    const dy = nearest.position.y - m.state.position.y;
    const dist = nearest.distance;
    m.chargeDir = { x: dx / dist, y: dy / dist };
    m.updateFacing(dx, dy);
    return null;
  }

  // Normal chase
  m.aiState = 'chase';
  m.moveToward(nearest.position, stats.speed * speedMult, tiles);
  return tryAttack(m, nearest, Math.floor(m.scaledAttack * atkMult));
}

// --- Forge Guardian: AoE ground slam, overheat enrage at 50% HP ---
export function updateBossForgeGuardian(
  m: MonsterContext,
  nearest: NearestPlayer | null,
  players: ReadonlyArray<{ id: string; position: Vec2; alive: boolean }>,
  tiles: TileType[][],
): AttackResult {
  const stats = MONSTER_STATS.boss_forge_guardian;

  m.summonCooldown -= 1;
  if (m.slamCooldown > 0) m.slamCooldown -= 1;

  // Enrage at 50% HP — faster attacks, faster movement
  const hpRatio = m.state.hp / m.state.maxHp;
  const enraged = hpRatio <= FORGE_OVERHEAT_HP;
  const speedMult = enraged ? 1.4 : 1.0;
  const atkMult = enraged ? 1.3 : 1.0;

  // Ground slam AoE — damages all players within range
  if (m.slamCooldown <= 0 && nearest && nearest.distance <= FORGE_SLAM_RANGE) {
    m.slamCooldown = enraged ? Math.floor(FORGE_SLAM_COOLDOWN * 0.6) : FORGE_SLAM_COOLDOWN;
    const slamDmg = Math.floor(m.scaledAttack * FORGE_SLAM_DAMAGE_MULT * atkMult);
    for (const player of players) {
      if (!player.alive) continue;
      const dx = player.position.x - m.state.position.x;
      const dy = player.position.y - m.state.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= FORGE_SLAM_RANGE) {
        m.aoeHits.push({ playerId: player.id, damage: slamDmg });
      }
    }
  }

  // Summon minions periodically (slower than demon)
  if (m.summonCooldown <= 0) {
    m.summonCooldown = BOSS_SUMMON_COOLDOWN * 1.5;
    m.shouldSummon = true;
  }

  if (!nearest) {
    m.aiState = 'idle';
    m.state.targetPlayerId = null;
    m.state.velocity = { x: 0, y: 0 };
    return null;
  }

  m.state.targetPlayerId = nearest.id;
  m.aiState = 'chase';
  m.moveToward(nearest.position, stats.speed * speedMult, tiles);
  return tryAttack(m, nearest, Math.floor(m.scaledAttack * atkMult));
}

// --- Stone Warden: Petrify gaze (stun), rock shield phase, ground slam ---
export function updateBossStoneWarden(
  m: MonsterContext,
  nearest: NearestPlayer | null,
  players: ReadonlyArray<{ id: string; position: Vec2; alive: boolean }>,
  tiles: TileType[][],
): AttackResult {
  const stats = MONSTER_STATS.boss_stone_warden;

  m.summonCooldown -= 1;
  if (m.petrifyGazeCooldown > 0) m.petrifyGazeCooldown -= 1;
  if (m.slamCooldown > 0) m.slamCooldown -= 1;

  // Rock shield — activate at 40% HP, lasts 4 seconds, recharges
  if (m.shieldActive) {
    m.shieldTicks -= 1;
    if (m.shieldTicks <= 0) {
      m.shieldActive = false;
    }
  }

  const hpRatio = m.state.hp / m.state.maxHp;
  if (!m.shieldActive && hpRatio <= STONE_SHIELD_HP && m.shieldTicks <= -200) {
    // Activate shield (cooldown tracked via negative shieldTicks)
    m.shieldActive = true;
    m.shieldTicks = STONE_SHIELD_DURATION;
  }

  // Petrify gaze — stun nearest player
  if (m.petrifyGazeCooldown <= 0 && nearest && nearest.distance <= STONE_PETRIFY_RANGE) {
    m.petrifyGazeCooldown = STONE_PETRIFY_COOLDOWN;
    m.stunTargets.push({ playerId: nearest.id, ticks: STONE_PETRIFY_STUN_TICKS });
  }

  // Ground slam AoE (slower than forge)
  if (m.slamCooldown <= 0 && nearest && nearest.distance <= 2.0) {
    m.slamCooldown = FORGE_SLAM_COOLDOWN * 1.2;
    const slamDmg = Math.floor(m.scaledAttack * 1.5);
    for (const player of players) {
      if (!player.alive) continue;
      const dx = player.position.x - m.state.position.x;
      const dy = player.position.y - m.state.position.y;
      if (Math.sqrt(dx * dx + dy * dy) <= 2.0) {
        m.aoeHits.push({ playerId: player.id, damage: slamDmg });
      }
    }
  }

  // Summon gargoyle minions
  if (m.summonCooldown <= 0) {
    m.summonCooldown = BOSS_SUMMON_COOLDOWN * 1.3;
    m.shouldSummon = true;
  }

  if (!nearest) {
    m.aiState = 'idle';
    m.state.targetPlayerId = null;
    m.state.velocity = { x: 0, y: 0 };
    return null;
  }

  m.state.targetPlayerId = nearest.id;
  m.aiState = 'chase';
  // Stone Warden is slow but tanky
  m.moveToward(nearest.position, stats.speed * 0.7, tiles);
  return tryAttack(m, nearest, m.scaledAttack);
}

// --- Flame Knight: Fast charges, spinning slash AoE, burn DoT ---
export function updateBossFlameKnight(
  m: MonsterContext,
  nearest: NearestPlayer | null,
  players: ReadonlyArray<{ id: string; position: Vec2; alive: boolean }>,
  tiles: TileType[][],
): AttackResult {
  const stats = MONSTER_STATS.boss_flame_knight;

  m.summonCooldown -= 1;
  if (m.flameChargeCooldown > 0) m.flameChargeCooldown -= 1;
  if (m.spinCooldown > 0) m.spinCooldown -= 1;

  // Handle active flame charge
  if (m.flameChargeTimer > 0) {
    m.flameChargeTimer -= 1;
    const speed = stats.speed * FLAME_CHARGE_SPEED_MULT / TICK_RATE;
    m.tryMove(m.flameChargeDir.x * speed, m.flameChargeDir.y * speed, tiles);

    // Hit players during charge
    for (const player of players) {
      if (!player.alive) continue;
      const dx = player.position.x - m.state.position.x;
      const dy = player.position.y - m.state.position.y;
      if (Math.sqrt(dx * dx + dy * dy) <= ATTACK_RANGE * 1.5) {
        m.aoeHits.push({ playerId: player.id, damage: Math.floor(m.scaledAttack * 1.5) });
      }
    }
    return null;
  }

  // Spinning slash AoE — damages all in range
  if (m.spinCooldown <= 0 && nearest && nearest.distance <= FLAME_SPIN_RANGE) {
    m.spinCooldown = FLAME_SPIN_COOLDOWN;
    const spinDmg = Math.floor(m.scaledAttack * FLAME_SPIN_DAMAGE_MULT);
    for (const player of players) {
      if (!player.alive) continue;
      const dx = player.position.x - m.state.position.x;
      const dy = player.position.y - m.state.position.y;
      if (Math.sqrt(dx * dx + dy * dy) <= FLAME_SPIN_RANGE) {
        m.aoeHits.push({ playerId: player.id, damage: spinDmg });
      }
    }
  }

  // Initiate charge at medium range
  if (
    m.flameChargeCooldown <= 0 &&
    nearest &&
    nearest.distance <= BOSS_CHARGE_RANGE &&
    nearest.distance > ATTACK_RANGE * 2
  ) {
    m.flameChargeCooldown = FLAME_CHARGE_COOLDOWN;
    m.flameChargeTimer = FLAME_CHARGE_DURATION;
    const dx = nearest.position.x - m.state.position.x;
    const dy = nearest.position.y - m.state.position.y;
    const dist = nearest.distance;
    m.flameChargeDir = { x: dx / dist, y: dy / dist };
    m.updateFacing(dx, dy);
    m.aiState = 'charge';
    return null;
  }

  // Summon lava_slime minions
  if (m.summonCooldown <= 0) {
    m.summonCooldown = BOSS_SUMMON_COOLDOWN * 1.4;
    m.shouldSummon = true;
  }

  if (!nearest) {
    m.aiState = 'idle';
    m.state.targetPlayerId = null;
    m.state.velocity = { x: 0, y: 0 };
    return null;
  }

  m.state.targetPlayerId = nearest.id;
  m.aiState = 'chase';
  // Flame Knight is fast
  m.moveToward(nearest.position, stats.speed * 1.3, tiles);
  return tryAttack(m, nearest, m.scaledAttack);
}

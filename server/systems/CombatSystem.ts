import { Server } from 'socket.io';
import {
  MonsterType,
  LootState,
  MONSTER_STATS,
} from '../../shared/types';
import { Player } from '../entities/Player';
import { Monster } from '../entities/Monster';
import { Projectile } from '../entities/Projectile';

export const AOE_DAMAGE_MULTIPLIER = 0.6;

export interface CombatContext {
  io: Server;
  roomCode: string;
  players: Map<string, Player>;
  monsters: Map<string, Monster>;
  projectiles: Map<string, Projectile>;
  loot: Map<string, LootState>;
  rooms: Array<{ id: number; monsterIds: string[]; isBossRoom?: boolean }>;
  isSolo: boolean;
  playerCount: number;
  currentFloor: number;
  floorHpMultiplier: number;
  floorAttackMultiplier: number;
  bossPhaseTracker: Map<string, number>;
  hasModifier: (id: string) => boolean;
  queueDamage: (targetId: string, damage: number, sourceId: string) => void;
  generateLootId: () => string;
  dropLoot: (position: { x: number; y: number }) => void;
}

/**
 * Process monster attacks, AoE hits, stun targets, poison aura, web, boss summons,
 * and boss phase changes for all active monsters.
 */
export function processMonsterCombat(
  ctx: CombatContext,
  activeRoomIds: Set<number>,
): void {
  for (const [monsterId, monster] of ctx.monsters) {
    if (!monster.state.alive) continue;
    if (!activeRoomIds.has(monster.roomId)) continue;

    // Build alive players list (reuse each call — small array)
    const alivePlayers: Array<{ id: string; position: { x: number; y: number }; alive: boolean }> = [];
    for (const p of ctx.players.values()) {
      if (p.state.alive) {
        alivePlayers.push({ id: p.state.id, position: p.state.position, alive: true });
      }
    }

    const attackResult = monster.update(alivePlayers, []);

    if (attackResult) {
      const targetPlayer = ctx.players.get(attackResult.targetId);
      if (targetPlayer) {
        const fragileMultiplier = ctx.hasModifier('fragile') ? 1.2 : 1;
        const result = targetPlayer.takeDamage(Math.floor(attackResult.damage * fragileMultiplier));
        if (!result.dodged && result.effectiveDamage > 0) {
          ctx.queueDamage(attackResult.targetId, result.effectiveDamage, monsterId);
          // Thorns damage — reflected damage to attacking monster
          if (result.thornsDamage > 0) {
            const thornsDmg = monster.takeDamage(result.thornsDamage);
            ctx.queueDamage(monsterId, thornsDmg, attackResult.targetId);
            if (!monster.state.alive) {
              handleMonsterKilled(ctx, monster, attackResult.targetId);
            }
          }
        }

        if (!targetPlayer.state.alive) {
          handlePlayerDeath(ctx, targetPlayer);
        }
      }
    }

    // Spider web: apply slow debuff to targeted player
    if (monster.webTarget) {
      const webPlayer = ctx.players.get(monster.webTarget.playerId);
      if (webPlayer && webPlayer.state.alive) {
        webPlayer.applySlow(monster.webTarget.slowMult, monster.webTarget.slowTicks);
      }
    }

    // Mushroom poison aura: damage nearby players
    for (const poisonTarget of monster.poisonAuraTargets) {
      const poisonPlayer = ctx.players.get(poisonTarget.playerId);
      if (poisonPlayer && poisonPlayer.state.alive) {
        const poisonResult = poisonPlayer.takeDamage(poisonTarget.damage);
        if (!poisonResult.dodged && poisonResult.effectiveDamage > 0) {
          ctx.queueDamage(poisonTarget.playerId, poisonResult.effectiveDamage, monsterId);
        }

        if (!poisonPlayer.state.alive) {
          handlePlayerDeath(ctx, poisonPlayer);
        }
      }
    }

    // Side boss AoE hits (forge slam, stone slam, flame spin/charge)
    for (const aoeHit of monster.aoeHits) {
      const aoePlayer = ctx.players.get(aoeHit.playerId);
      if (aoePlayer && aoePlayer.state.alive) {
        const fragileMultiplier = ctx.hasModifier('fragile') ? 1.2 : 1;
        const aoeResult = aoePlayer.takeDamage(Math.floor(aoeHit.damage * fragileMultiplier));
        if (!aoeResult.dodged && aoeResult.effectiveDamage > 0) {
          ctx.queueDamage(aoeHit.playerId, aoeResult.effectiveDamage, monsterId);
        }
        if (!aoePlayer.state.alive) {
          handlePlayerDeath(ctx, aoePlayer);
        }
      }
    }

    // Side boss stun targets (stone warden petrify)
    for (const stunTarget of monster.stunTargets) {
      const stunPlayer = ctx.players.get(stunTarget.playerId);
      if (stunPlayer && stunPlayer.state.alive) {
        stunPlayer.state.stunTicks = Math.max(stunPlayer.state.stunTicks, stunTarget.ticks);
      }
    }

    // Boss summon minions
    if (monster.shouldSummon) {
      processBossSummon(ctx, monster);
    }

    // Boss phase change detection + dialogue
    if (monster.state.bossPhase > 0) {
      processBossPhaseChange(ctx, monsterId, monster);
    }
  }
}

/**
 * Process projectile collisions: player projectiles vs monsters, monster projectiles vs players.
 * Returns array of projectile IDs to remove.
 */
export function processProjectileCollisions(
  ctx: CombatContext,
  projRemoveBuf: string[],
): void {
  projRemoveBuf.length = 0;

  for (const [projId, projectile] of ctx.projectiles) {
    const alive = projectile.update([]);
    if (!alive) {
      projRemoveBuf.push(projId);
      continue;
    }

    const owner = ctx.players.get(projectile.state.ownerId);
    const isPlayerProjectile = owner !== undefined;

    if (isPlayerProjectile) {
      let hitSomething = false;

      for (const [monsterId, monster] of ctx.monsters) {
        if (!monster.state.alive) continue;

        if (projectile.checkCircleCollision(monster.state.position, monster.getRadius())) {
          // Crit check
          let projDmg = projectile.state.damage;
          if (owner) {
            const crit = owner.rollCrit();
            if (crit.isCrit) projDmg = Math.floor(projDmg * crit.multiplier);
          }
          const actualDamage = monster.takeDamage(projDmg);
          if (owner) {
            owner.state.totalDamageDealt += actualDamage;
            owner.applyLifesteal(actualDamage);
          }
          ctx.queueDamage(monsterId, actualDamage, projectile.state.ownerId);

          if (!monster.state.alive) {
            handleMonsterKilled(ctx, monster, projectile.state.ownerId);
          }

          hitSomething = true;

          // AoE: damage nearby monsters too
          if (projectile.getIsAoe()) {
            for (const [otherId, otherMonster] of ctx.monsters) {
              if (!otherMonster.state.alive || otherId === monsterId) continue;
              if (projectile.getAoeTargetsInRange(otherMonster.state.position, otherMonster.getRadius())) {
                const aoeDamage = otherMonster.takeDamage(Math.floor(projectile.state.damage * AOE_DAMAGE_MULTIPLIER));
                if (owner) owner.state.totalDamageDealt += aoeDamage;
                ctx.queueDamage(otherId, aoeDamage, projectile.state.ownerId);
                if (!otherMonster.state.alive) {
                  handleMonsterKilled(ctx, otherMonster, projectile.state.ownerId);
                }
              }
            }
          }

          break;
        }
      }

      if (hitSomething) {
        projRemoveBuf.push(projId);
      }
    } else {
      // Monster projectile: check collision with players
      for (const [, player] of ctx.players) {
        if (!player.state.alive) continue;

        if (projectile.checkCircleCollision(player.state.position, player.getRadius())) {
          const projResult = player.takeDamage(projectile.state.damage);
          if (!projResult.dodged && projResult.effectiveDamage > 0) {
            ctx.queueDamage(player.state.id, projResult.effectiveDamage, projectile.state.ownerId);
          }

          if (!player.state.alive) {
            handlePlayerDeath(ctx, player);
          }

          projRemoveBuf.push(projId);
          break;
        }
      }
    }
  }

  for (const projId of projRemoveBuf) {
    ctx.projectiles.delete(projId);
  }
}

/**
 * Handle monster being killed: emit event, grant XP, drop loot.
 */
export function handleMonsterKilled(ctx: CombatContext, monster: Monster, killerId: string): void {
  const stats = MONSTER_STATS[monster.state.type];

  ctx.io.to(ctx.roomCode).emit('game:monster_killed', {
    monsterId: monster.state.id,
    killerId,
    xp: stats.xp,
  });

  // Grant XP to killer (scaled for multiplayer to prevent over-leveling)
  const killer = ctx.players.get(killerId);
  if (killer) {
    const xpMultipliers: Record<number, number> = { 1: 1.0, 2: 0.75, 3: 0.6, 4: 0.5 };
    const clampedPlayers = Math.max(1, Math.min(4, ctx.playerCount));
    const xpScale = xpMultipliers[clampedPlayers] ?? 1.0;
    const eliteXpMult = monster.state.isElite ? 3 : 1;
    const scaledXp = Math.max(1, Math.floor(stats.xp * xpScale * eliteXpMult));
    const leveled = killer.addXp(scaledXp);
    killer.state.score += scaledXp;

    if (leveled) {
      ctx.io.to(ctx.roomCode).emit('game:level_up', {
        playerId: killerId,
        level: killer.state.level,
      });
      // Send talent choices
      const availableTalents = killer.getAvailableTalents();
      if (availableTalents.length > 0) {
        ctx.io.to(ctx.roomCode).emit('game:talent_choice', {
          playerId: killerId,
          talents: availableTalents as unknown as typeof availableTalents,
        });
      }
    }
  }

  // Drop loot — elites drop 1-2, normal monsters drop 1
  const dropCount = monster.state.isElite ? 1 + Math.floor(Math.random() * 2) : 1;
  for (let i = 0; i < dropCount; i++) {
    ctx.dropLoot(monster.state.position);
  }
}

/**
 * Handle player death: emit event, apply gold penalty in co-op.
 */
export function handlePlayerDeath(ctx: CombatContext, player: Player): void {
  ctx.io.to(ctx.roomCode).emit('game:player_died', {
    playerId: player.state.id,
  });
  // Co-op death penalty: 20% gold loss
  if (!ctx.isSolo && player.state.gold > 0) {
    const goldLoss = Math.max(5, Math.floor(player.state.gold * 0.2));
    player.state.gold -= goldLoss;
    // Drop lost gold on the ground
    const lootItem: LootState = {
      id: ctx.generateLootId(),
      type: 'gold',
      position: {
        x: player.state.position.x + (Math.random() - 0.5),
        y: player.state.position.y + (Math.random() - 0.5),
      },
      value: goldLoss,
    };
    ctx.loot.set(lootItem.id, lootItem);
  }
}

/** Process boss minion summoning. */
function processBossSummon(ctx: CombatContext, monster: Monster): void {
  const isBossType = monster.state.type === 'boss_demon' ||
    monster.state.type === 'boss_spider_queen' ||
    monster.state.type === 'boss_forge_guardian' ||
    monster.state.type === 'boss_stone_warden' ||
    monster.state.type === 'boss_flame_knight';

  if (isBossType) {
    const room = ctx.rooms.find((r) => r.id === monster.roomId);
    if (room) {
      const minionTypeMap: Record<string, MonsterType> = {
        boss_demon: 'skeleton',
        boss_spider_queen: 'spider',
        boss_forge_guardian: 'skeleton',
        boss_stone_warden: 'gargoyle',
        boss_flame_knight: 'lava_slime',
      };
      const minionType = minionTypeMap[monster.state.type] ?? 'skeleton';
      const minion = new Monster(minionType, {
        x: monster.state.position.x + (Math.random() - 0.5) * 3,
        y: monster.state.position.y + (Math.random() - 0.5) * 3,
      }, monster.roomId);
      minion.scaleForFloor(ctx.floorHpMultiplier, ctx.floorAttackMultiplier);
      if (ctx.isSolo) minion.scaleForSolo();
      minion.scaleForPlayerCount(ctx.playerCount);
      ctx.monsters.set(minion.state.id, minion);
      room.monsterIds.push(minion.state.id);
    }
  }
}

/** Detect boss phase changes and emit dialogue. */
function processBossPhaseChange(
  ctx: CombatContext,
  monsterId: string,
  monster: Monster,
): void {
  const prevPhase = ctx.bossPhaseTracker.get(monsterId) ?? 0;
  if (monster.state.bossPhase !== prevPhase) {
    ctx.bossPhaseTracker.set(monsterId, monster.state.bossPhase);
    ctx.io.to(ctx.roomCode).emit('game:boss_phase', {
      monsterId,
      phase: monster.state.bossPhase,
    });

    const phaseDialogues: Record<string, Record<number, string>> = {
      boss_demon: {
        1: 'Acı... her yeri sarıyor...',
        2: 'Ateş! Daha fazla ateş!',
        3: 'DURDURUN BENİ!',
      },
      boss_spider_queen: {
        1: 'Ağlarım... her yere yayılacak!',
      },
      boss_forge_guardian: {
        1: 'Ocak kızışıyor!',
      },
    };

    const dialogue = phaseDialogues[monster.state.type]?.[monster.state.bossPhase];
    if (dialogue) {
      ctx.io.to(ctx.roomCode).emit('game:boss_dialogue', {
        monsterId,
        bossType: monster.state.type,
        dialogue,
        phase: monster.state.bossPhase,
      });
    }
  }
}

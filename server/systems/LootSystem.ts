import { Server } from 'socket.io';
import {
  LootType,
  LootState,
  LOOT_TABLE,
  goldValueForFloor,
} from '../../shared/types';
import { Player } from '../entities/Player';

// --- Loot ID generation ---
let nextLootId = 0;

export function generateLootId(): string {
  nextLootId += 1;
  return `loot_${nextLootId}_${Date.now()}`;
}

export interface LootContext {
  io: Server;
  roomCode: string;
  loot: Map<string, LootState>;
  isSolo: boolean;
  playerCount: number;
  currentFloor: number;
  hasModifier: (id: string) => boolean;
}

/**
 * Drop loot at the given position. Rolls each loot type against its drop chance
 * (scaled for solo / multiplayer), then creates LootState entries in the loot map.
 */
export function dropLoot(ctx: LootContext, position: { x: number; y: number }): void {
  const lootTypes: LootType[] = ['health_potion', 'mana_potion', 'damage_boost', 'speed_boost', 'gold'];
  // Solo mode: slight boost; multiplayer: small scale up to compensate split
  const dropMultiplier = ctx.isSolo
    ? 1.15
    : 1 + (ctx.playerCount - 1) * 0.15; // 2p=1.15, 3p=1.3, 4p=1.45

  for (const lootType of lootTypes) {
    const lootInfo = LOOT_TABLE[lootType];
    if (Math.random() < lootInfo.chance * dropMultiplier) {
      const lootItem: LootState = {
        id: generateLootId(),
        type: lootType,
        position: {
          x: position.x + (Math.random() - 0.5) * 1.5,
          y: position.y + (Math.random() - 0.5) * 1.5,
        },
        value: lootType === 'gold'
          ? goldValueForFloor(ctx.currentFloor)
          : (lootType === 'health_potion' || lootType === 'mana_potion') && ctx.hasModifier('reduced_healing')
            ? Math.floor(lootInfo.value * 0.5)
            : lootInfo.value,
      };
      ctx.loot.set(lootItem.id, lootItem);
    }
  }
}

/**
 * Process loot pickup for all players. Checks proximity and applies pickup.
 * Removes collected loot from the map and emits events.
 */
export function processLootPickup(
  ctx: LootContext,
  players: Map<string, Player>,
  lootRemoveBuf: string[],
): void {
  lootRemoveBuf.length = 0;
  for (const [lootId, lootItem] of ctx.loot) {
    for (const player of players.values()) {
      if (player.tryPickupLoot(lootItem)) {
        lootRemoveBuf.push(lootId);
        ctx.io.to(ctx.roomCode).emit('game:loot_pickup', {
          playerId: player.state.id,
          loot: lootItem,
        });
        break;
      }
    }
  }
  for (const lootId of lootRemoveBuf) {
    ctx.loot.delete(lootId);
  }
}

// ==========================================
// Dungeon Mates — Socket Events
// ==========================================

import type { PlayerClass } from './classes';
import type { TalentId, TalentDef } from './talents';
import type { ShopItem } from './shop';
import type { FloorModifier } from './floor-modifiers';
import type { PlayerState, LootState, GamePhase, GameState, PlayerInput } from './entities';

// --- Socket Events ---

// Client → Server
export type ClientEvents = {
  'room:create': (data: { playerName: string }) => void;
  'room:create_solo': (data: { playerName: string }) => void;
  'room:join': (data: { roomCode: string; playerName: string }) => void;
  'player:class_select': (data: { playerClass: PlayerClass }) => void;
  'player:ready': () => void;
  'player:input': (data: PlayerInput) => void;
  'player:attack': () => void;
  'player:use_ability': () => void;
  'player:interact': () => void;
  'player:select_talent': (data: { talentId: TalentId }) => void;
  'player:buy_item': (data: { itemId: string }) => void;
  'player:shop_done': () => void;
  'chat:send': (data: { text: string }) => void;
};

// Server → Client
export type ServerEvents = {
  'room:created': (data: { roomCode: string; playerId: string }) => void;
  'room:joined': (data: { playerId: string; players: Record<string, PlayerState> }) => void;
  'room:player_joined': (data: { player: PlayerState }) => void;
  'room:player_left': (data: { playerId: string }) => void;
  'room:error': (data: { message: string }) => void;
  'game:phase_change': (data: { phase: GamePhase }) => void;
  'game:state': (data: GameState) => void;
  'game:damage': (data: { targetId: string; damage: number; sourceId: string }) => void;
  'game:damage_batch': (data: Array<{ targetId: string; damage: number; sourceId: string }>) => void;
  'game:loot_pickup': (data: { playerId: string; loot: LootState }) => void;
  'game:monster_killed': (data: { monsterId: string; killerId: string; xp: number }) => void;
  'game:player_died': (data: { playerId: string }) => void;
  'game:room_cleared': (data: { roomId: number }) => void;
  'game:floor_complete': (data: { floor: number }) => void;
  'game:chest_opened': (data: { x: number; y: number }) => void;
  'game:stairs_used': () => void;
  'game:victory': () => void;
  'game:defeat': () => void;
  'game:talent_choice': (data: { playerId: string; talents: TalentDef[] }) => void;
  'game:talent_selected': (data: { playerId: string; talentId: TalentId }) => void;
  'game:level_up': (data: { playerId: string; level: number }) => void;
  'game:shop_open': (data: { items: ShopItem[]; playerGold: Record<string, number> }) => void;
  'game:item_purchased': (data: { playerId: string; itemId: string; remainingGold: number }) => void;
  'game:boss_phase': (data: { monsterId: string; phase: number }) => void;
  'game:boss_dialogue': (data: { monsterId: string; bossType: string; dialogue: string; phase: number }) => void;
  'game:floor_modifier': (data: { modifiers: FloorModifier[] }) => void;
  'chat:message': (data: { playerId: string; name: string; text: string }) => void;
};

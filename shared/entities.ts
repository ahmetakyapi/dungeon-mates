// ==========================================
// Dungeon Mates — Core Entity Types
// ==========================================

import type { PlayerClass } from './classes';
import type { TalentId, TalentBranch } from './talents';
import type { MonsterType } from './monsters';
import type { LootType } from './loot';
import type { FloorModifier } from './floor-modifiers';

// --- Enum'lar ---
export type GamePhase = 'lobby' | 'class_select' | 'playing' | 'boss' | 'victory' | 'defeat' | 'game_over' | 'shopping';
export type TileType = 'floor' | 'wall' | 'door' | 'stairs' | 'chest' | 'void';
export type Direction = 'up' | 'down' | 'left' | 'right';

// --- Entity Tipleri ---
export type Vec2 = { x: number; y: number };

export type PlayerState = {
  id: string;
  name: string;
  class: PlayerClass;
  position: Vec2;
  velocity: Vec2;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  attack: number;
  defense: number;
  xp: number;
  level: number;
  alive: boolean;
  facing: Direction;
  attacking: boolean;
  lastAttackTime: number;
  score: number;
  abilityActive: boolean;
  abilityCooldownTicks: number;
  speedBoosted: boolean;
  totalDamageDealt: number;
  goldCollected: number;
  // Phase 1: Talent sistemi
  gold: number;
  talents: TalentId[];
  talentBranch: TalentBranch | null;
  pendingTalentChoice: boolean;
  // Phase 3: Elite/Modifier istatistikleri
  stunTicks: number;
  // Dodge/roll state
  dodging: boolean;
  dodgeCooldownTicks: number;
  // Visual state for client rendering
  shieldActive: boolean;
  poisoned: boolean;
  slowed: boolean;
  // Premium combat feel — hit-stop & knockback
  hitStopTicks: number;
  knockbackVx: number;
  knockbackVy: number;
  knockbackTicks: number;
  // Combo tracking
  comboCount: number;
  comboExpiry: number;
  // Ultimate ability (level 5+ unlock, F key)
  ultimateCooldownTicks: number;
  ultimateReady: boolean;
  // Co-op aura — which classes are currently providing aura to this player
  // (used by client to render class-colored halo rings)
  auraFrom: string; // bitmask-like string "warrior,mage" for cheap serialization
};

export type MonsterState = {
  id: string;
  type: MonsterType;
  position: Vec2;
  velocity: Vec2;
  hp: number;
  maxHp: number;
  alive: boolean;
  targetPlayerId: string | null;
  facing: Direction;
  isElite: boolean;
  bossPhase: number;
  // Visual state for client rendering
  shieldActive: boolean;
  phased: boolean;
  casting: boolean;
  enraged: boolean;
  // Premium combat feel — hit-stop & knockback
  hitStopTicks: number;
  knockbackVx: number;
  knockbackVy: number;
  knockbackTicks: number;
  // Status effects (elemental — Faz 3 hazırlığı ama sprite layer şimdi kullanıyor)
  burnTicks: number;
  freezeTicks: number;
  poisonTicks: number;
};

// --- Damage / Event Metadata ---
export type DamageType = 'physical' | 'fire' | 'ice' | 'poison' | 'holy';

export type ProjectileState = {
  id: string;
  ownerId: string;
  position: Vec2;
  velocity: Vec2;
  direction: Vec2;
  damage: number;
  lifetime: number;
  type: 'arrow' | 'fireball' | 'sword_slash' | 'holy_bolt';
};

export type LootState = {
  id: string;
  type: LootType;
  position: Vec2;
  value: number;
};

export type RoomCategory = 'normal' | 'boss' | 'start' | 'treasure' | 'rest' | 'trap';

export type DungeonRoom = {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  isBossRoom: boolean;
  isStartRoom: boolean;
  category: RoomCategory;
  cleared: boolean;
  monsterIds: string[];
};

// --- Oyun Durumu ---
export type GameState = {
  roomCode: string;
  phase: GamePhase;
  tick: number;
  players: Record<string, PlayerState>;
  monsters: Record<string, MonsterState>;
  projectiles: Record<string, ProjectileState>;
  loot: Record<string, LootState>;
  dungeon: {
    tiles: TileType[][];
    rooms: DungeonRoom[];
    width: number;
    height: number;
    currentFloor: number;
  };
  currentRoomId: number;
  isSolo: boolean;
  soloDeathsRemaining: number;
  currentFloorModifiers: FloorModifier[];
};

// Player Input (her tick gönderilir)
export type PlayerInput = {
  dx: number; // -1 to 1
  dy: number; // -1 to 1
  attack: boolean;
  ability: boolean;
  interact?: boolean;
  sprint?: boolean;
  dodge?: boolean;
  toggleMap?: boolean;
  ultimate?: boolean; // F key — per-class ultimate (level 5+)
};

// --- Yetenek Sonuçları ---
export type AbilityResult =
  | { type: 'shield_wall' }
  | { type: 'ice_storm'; position: Vec2; damage: number; radius: number }
  | { type: 'arrow_rain'; projectiles: { id: string; ownerId: string; position: Vec2; direction: Vec2; damage: number }[] }
  | { type: 'healing_wave'; position: Vec2; healAmount: number; radius: number };

// --- Ultimate Ability Sonuçları (Faz 3) ---
export type UltimateKind =
  | 'berserker_rush'       // warrior: 5x rapid sword slashes
  | 'arcane_nova'          // mage: large AoE, triggers fire+ice reactions
  | 'piercing_volley'      // archer: 8 arrows wide fan, 2x pierce
  | 'divine_intervention'; // healer: full team heal + 3s immunity

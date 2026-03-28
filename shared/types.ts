// ==========================================
// Dungeon Mates — Shared Types
// Server & Client ortak kullanır
// ==========================================

// --- Sabitler ---
export const TICK_RATE = 20; // server tick/saniye
export const TICK_MS = 1000 / TICK_RATE;
export const TILE_SIZE = 16;
export const PLAYER_SPEED = 2.5; // tile/saniye
export const ROOM_MIN_SIZE = 7;
export const ROOM_MAX_SIZE = 13;
export const DUNGEON_WIDTH = 64;
export const DUNGEON_HEIGHT = 64;
export const MAX_PLAYERS = 4;
export const ROOM_CODE_LENGTH = 4;

// --- Enum'lar ---
export type PlayerClass = 'warrior' | 'mage' | 'archer';
export type GamePhase = 'lobby' | 'class_select' | 'playing' | 'boss' | 'victory' | 'defeat' | 'game_over';
export type TileType = 'floor' | 'wall' | 'door' | 'stairs' | 'chest' | 'void';
export type Direction = 'up' | 'down' | 'left' | 'right';
export type MonsterType = 'skeleton' | 'slime' | 'bat' | 'goblin' | 'rat' | 'spider' | 'wraith' | 'mushroom' | 'boss_demon';
export type LootType = 'health_potion' | 'mana_potion' | 'damage_boost' | 'speed_boost' | 'gold';

// --- Sınıf İstatistikleri ---
export const CLASS_STATS: Record<PlayerClass, {
  maxHp: number;
  maxMana: number;
  attack: number;
  defense: number;
  speed: number;
  attackRange: number;
  attackCooldown: number;
  color: string;
  label: string;
  emoji: string;
}> = {
  warrior: {
    maxHp: 120,
    maxMana: 30,
    attack: 18,
    defense: 10,
    speed: 2.2,
    attackRange: 1.5,
    attackCooldown: 500,
    color: '#ef4444',
    label: 'Savaşçı',
    emoji: '⚔️',
  },
  mage: {
    maxHp: 70,
    maxMana: 100,
    attack: 20,
    defense: 3,
    speed: 2.0,
    attackRange: 5,
    attackCooldown: 800,
    color: '#8b5cf6',
    label: 'Büyücü',
    emoji: '🔮',
  },
  archer: {
    maxHp: 90,
    maxMana: 50,
    attack: 12,
    defense: 5,
    speed: 2.8,
    attackRange: 6,
    attackCooldown: 400,
    color: '#10b981',
    label: 'Okçu',
    emoji: '🏹',
  },
} as const;

// --- Monster İstatistikleri ---
export const MONSTER_STATS: Record<MonsterType, {
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  xp: number;
  color: string;
  size: number;
}> = {
  skeleton: { hp: 30, attack: 8, defense: 2, speed: 1.2, xp: 10, color: '#d1d5db', size: 1 },
  slime: { hp: 20, attack: 5, defense: 1, speed: 0.8, xp: 5, color: '#4ade80', size: 0.8 },
  bat: { hp: 15, attack: 6, defense: 0, speed: 2.5, xp: 7, color: '#a78bfa', size: 0.6 },
  goblin: { hp: 40, attack: 10, defense: 4, speed: 1.5, xp: 15, color: '#84cc16', size: 0.9 },
  rat: { hp: 12, attack: 4, defense: 0, speed: 2.2, xp: 3, color: '#78716c', size: 0.5 },
  spider: { hp: 25, attack: 7, defense: 2, speed: 1.0, xp: 8, color: '#581c87', size: 0.8 },
  wraith: { hp: 35, attack: 14, defense: 1, speed: 1.8, xp: 15, color: '#a5f3fc', size: 1.0 },
  mushroom: { hp: 45, attack: 8, defense: 6, speed: 0.6, xp: 12, color: '#f472b6', size: 0.9 },
  boss_demon: { hp: 300, attack: 25, defense: 12, speed: 1.0, xp: 100, color: '#dc2626', size: 2.5 },
} as const;

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
};

export type ProjectileState = {
  id: string;
  ownerId: string;
  position: Vec2;
  velocity: Vec2;
  direction: Vec2;
  damage: number;
  lifetime: number;
  type: 'arrow' | 'fireball' | 'sword_slash';
};

export type LootState = {
  id: string;
  type: LootType;
  position: Vec2;
  value: number;
};

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
};

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
  'game:loot_pickup': (data: { playerId: string; loot: LootState }) => void;
  'game:monster_killed': (data: { monsterId: string; killerId: string; xp: number }) => void;
  'game:player_died': (data: { playerId: string }) => void;
  'game:room_cleared': (data: { roomId: number }) => void;
  'game:floor_complete': (data: { floor: number }) => void;
  'game:chest_opened': (data: { x: number; y: number }) => void;
  'game:stairs_used': () => void;
  'game:victory': () => void;
  'game:defeat': () => void;
  'chat:message': (data: { playerId: string; name: string; text: string }) => void;
};

// Player Input (her tick gönderilir)
export type PlayerInput = {
  dx: number; // -1 to 1
  dy: number; // -1 to 1
  attack: boolean;
  ability: boolean;
  interact?: boolean;
  sprint?: boolean;
  toggleMap?: boolean;
};

// --- Yetenek Sonuçları ---
export type AbilityResult =
  | { type: 'shield_wall' }
  | { type: 'ice_storm'; position: Vec2; damage: number; radius: number }
  | { type: 'arrow_rain'; projectiles: { id: string; ownerId: string; position: Vec2; direction: Vec2; damage: number }[] };

// Loot tablosu
export const LOOT_TABLE: Record<LootType, { chance: number; value: number; label: string; color: string }> = {
  health_potion: { chance: 0.3, value: 30, label: 'Can İksiri', color: '#ef4444' },
  mana_potion: { chance: 0.2, value: 25, label: 'Mana İksiri', color: '#3b82f6' },
  damage_boost: { chance: 0.1, value: 5, label: 'Güç Artışı', color: '#f59e0b' },
  speed_boost: { chance: 0.08, value: 0.3, label: 'Hız Artışı', color: '#06b6d4' },
  gold: { chance: 0.5, value: 10, label: 'Altın', color: '#eab308' },
} as const;

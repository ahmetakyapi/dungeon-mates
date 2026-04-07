import { Server } from 'socket.io';
import {
  MonsterType,
  TileType,
  Vec2,
  DungeonRoom,
  FloorModifier,
  ShopItem,
  GamePhase,
  SHOP_ITEMS,
  FLOOR_MODIFIERS,
} from '../../shared/types';
import { Player } from '../entities/Player';
import { Monster } from '../entities/Monster';
import { DungeonGenerator, MONSTER_MULTIPLIER_BY_PLAYERS } from '../dungeon/DungeonGenerator';

// --- Room-related constants ---
export const ROOM_AREA_PER_MONSTER = 14;
export const MAX_MONSTERS_PER_ROOM = 14;
export const MIN_MONSTERS_PER_ROOM = 4;

// --- Floor-based monster pools with weights ---
type WeightedMonster = { type: MonsterType; weight: number };

export const MONSTER_POOL_BY_FLOOR: Record<number, WeightedMonster[]> = {
  1: [
    { type: 'rat', weight: 3 },
    { type: 'slime', weight: 3 },
    { type: 'bat', weight: 2 },
  ],
  2: [
    { type: 'skeleton', weight: 3 },
    { type: 'spider', weight: 2 },
    { type: 'rat', weight: 2 },
    { type: 'slime', weight: 2 },
    { type: 'bat', weight: 2 },
  ],
  3: [
    { type: 'skeleton', weight: 3 },
    { type: 'goblin', weight: 2 },
    { type: 'spider', weight: 2 },
    { type: 'wraith', weight: 2 },
    { type: 'mushroom', weight: 1 },
  ],
  4: [
    { type: 'skeleton', weight: 2 },
    { type: 'goblin', weight: 3 },
    { type: 'spider', weight: 2 },
    { type: 'wraith', weight: 3 },
    { type: 'mushroom', weight: 1 },
    { type: 'rat', weight: 1 },
    { type: 'bat', weight: 1 },
    { type: 'slime', weight: 1 },
  ],
  5: [
    { type: 'skeleton', weight: 2 },
    { type: 'goblin', weight: 3 },
    { type: 'spider', weight: 2 },
    { type: 'wraith', weight: 3 },
    { type: 'mushroom', weight: 1 },
    { type: 'rat', weight: 1 },
    { type: 'bat', weight: 1 },
  ],
  6: [
    { type: 'skeleton', weight: 2 },
    { type: 'goblin', weight: 3 },
    { type: 'gargoyle', weight: 3 },
    { type: 'wraith', weight: 2 },
    { type: 'mushroom', weight: 2 },
    { type: 'spider', weight: 1 },
  ],
  7: [
    { type: 'gargoyle', weight: 3 },
    { type: 'dark_knight', weight: 2 },
    { type: 'phantom', weight: 2 },
    { type: 'wraith', weight: 2 },
    { type: 'goblin', weight: 2 },
    { type: 'mushroom', weight: 1 },
  ],
  8: [
    { type: 'dark_knight', weight: 3 },
    { type: 'phantom', weight: 3 },
    { type: 'gargoyle', weight: 2 },
    { type: 'lava_slime', weight: 2 },
    { type: 'wraith', weight: 2 },
  ],
  9: [
    { type: 'dark_knight', weight: 3 },
    { type: 'phantom', weight: 3 },
    { type: 'lava_slime', weight: 3 },
    { type: 'gargoyle', weight: 2 },
    { type: 'wraith', weight: 1 },
  ],
  10: [
    { type: 'dark_knight', weight: 3 },
    { type: 'phantom', weight: 2 },
    { type: 'lava_slime', weight: 2 },
    { type: 'gargoyle', weight: 2 },
    { type: 'wraith', weight: 2 },
    { type: 'goblin', weight: 1 },
  ],
};

/** Pick a random monster type from a weighted pool. */
export function pickWeightedMonster(pool: WeightedMonster[]): MonsterType {
  const totalWeight = pool.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const entry of pool) {
    roll -= entry.weight;
    if (roll <= 0) return entry.type;
  }
  return pool[pool.length - 1].type;
}

// --- FloorManager context: mutable state passed from GameRoom ---
export interface FloorContext {
  io: Server;
  roomCode: string;
  players: Map<string, Player>;
  monsters: Map<string, Monster>;
  projectiles: Map<string, import('../entities/Projectile').Projectile>;
  loot: Map<string, import('../../shared/types').LootState>;
  rooms: DungeonRoom[];
  tiles: TileType[][];
  openedChests: Set<string>;
  currentFloor: number;
  maxFloors: number;
  floorHpMultiplier: number;
  floorAttackMultiplier: number;
  playerCount: number;
  isSolo: boolean;
  currentFloorModifiers: FloorModifier[];
  currentRoomId: number;
  /** Callback to set tiles on the GameRoom instance */
  setTiles: (tiles: TileType[][]) => void;
  /** Callback to set rooms on the GameRoom instance */
  setRooms: (rooms: DungeonRoom[]) => void;
  /** Callback to set floor difficulty multipliers */
  setFloorDifficulty: (hp: number, attack: number) => void;
  /** Callback to build the spatial room grid */
  buildTileRoomGrid: (width: number, height: number) => void;
  /** Callback to set the current room id */
  setCurrentRoomId: (id: number) => void;
  /** Callback to set floor modifiers */
  setFloorModifiers: (mods: FloorModifier[]) => void;
  /** Callback to set the phase */
  setPhase: (phase: GamePhase) => void;
  /** Callback to broadcast state */
  broadcastState: () => void;
  hasModifier: (id: string) => boolean;
}

/**
 * Generate a dungeon floor: clears existing state, creates dungeon,
 * spawns players in start room, populates rooms with monsters.
 */
export function generateFloor(ctx: FloorContext, floor: number): void {
  // Clear existing monsters, projectiles, loot, opened chests
  ctx.monsters.clear();
  ctx.projectiles.clear();
  ctx.loot.clear();
  ctx.openedChests.clear();

  // Generate dungeon for current floor (scaled by player count)
  const generator = new DungeonGenerator();
  const dungeon = generator.generate(floor, ctx.playerCount);
  ctx.setTiles(dungeon.tiles);
  ctx.setRooms(dungeon.rooms);
  ctx.setFloorDifficulty(dungeon.floorDifficulty.hpMultiplier, dungeon.floorDifficulty.attackMultiplier);

  // Build spatial room lookup grid
  ctx.buildTileRoomGrid(dungeon.width, dungeon.height);

  // Spawn players in start room
  const startRoom = dungeon.rooms.find((r) => r.isStartRoom);
  if (startRoom) {
    ctx.setCurrentRoomId(startRoom.id);
    let offset = 0;
    for (const player of ctx.players.values()) {
      const spawnX = startRoom.centerX + (offset % 2 === 0 ? -1 : 1) * Math.ceil(offset / 2);
      const spawnY = startRoom.centerY;
      player.state.position = { x: spawnX, y: spawnY };
      player.setSpawnPosition({ x: spawnX, y: spawnY });
      offset++;
    }
  }

  // Populate rooms with monsters (scaled for floor and solo)
  spawnMonstersInRooms(ctx, floor, dungeon.rooms);
}

/**
 * Spawn monsters in all rooms (except start room) based on floor difficulty.
 */
export function spawnMonstersInRooms(
  ctx: FloorContext,
  floor: number,
  rooms: DungeonRoom[],
): void {
  const clampedPlayers = Math.max(1, Math.min(4, ctx.playerCount));
  const monsterMultiplier = MONSTER_MULTIPLIER_BY_PLAYERS[clampedPlayers] ?? 1.0;
  const hasteMultiplier = ctx.hasModifier('haste_monsters') ? 1.3 : 1;

  for (const room of rooms) {
    if (room.isStartRoom) continue;

    if (room.isBossRoom) {
      spawnBossRoom(ctx, room, floor, clampedPlayers);
    } else {
      spawnNormalRoom(ctx, room, floor, clampedPlayers, monsterMultiplier);
    }
  }

  // Floor modifier: fast monsters
  if (hasteMultiplier > 1) {
    for (const monster of ctx.monsters.values()) {
      monster.floorSpeedMultiplier = hasteMultiplier;
    }
  }
}

function spawnBossRoom(
  ctx: FloorContext,
  room: DungeonRoom,
  floor: number,
  clampedPlayers: number,
): void {
  const bossTypeMap: Record<number, MonsterType> = {
    3: 'boss_forge_guardian',
    5: 'boss_spider_queen',
    7: 'boss_stone_warden',
    8: 'boss_flame_knight',
  };
  const bossType: MonsterType = floor === ctx.maxFloors
    ? 'boss_demon'
    : (bossTypeMap[floor] ?? 'boss_spider_queen');
  const boss = new Monster(bossType, { x: room.centerX, y: room.centerY }, room.id);
  boss.scaleForFloor(ctx.floorHpMultiplier, ctx.floorAttackMultiplier);
  if (ctx.isSolo) boss.scaleForSolo();
  boss.scaleForPlayerCount(clampedPlayers);
  ctx.monsters.set(boss.state.id, boss);
  room.monsterIds.push(boss.state.id);

  // Skeleton minions: 1 + playerCount instead of always 2
  const skeletonCount = 1 + clampedPlayers;
  for (let i = 0; i < skeletonCount; i++) {
    const angle = (i / skeletonCount) * Math.PI * 2;
    const sx = room.centerX + Math.cos(angle) * 2;
    const sy = room.centerY + Math.sin(angle) * 2;
    const skel = new Monster('skeleton', { x: sx, y: sy }, room.id);
    skel.scaleForFloor(ctx.floorHpMultiplier, ctx.floorAttackMultiplier);
    if (ctx.isSolo) skel.scaleForSolo();
    skel.scaleForPlayerCount(clampedPlayers);
    ctx.monsters.set(skel.state.id, skel);
    room.monsterIds.push(skel.state.id);
  }

  // For 3-4 players, add goblin elite adds
  if (clampedPlayers >= 3) {
    const goblinCount = clampedPlayers >= 4 ? 2 : 1;
    for (let i = 0; i < goblinCount; i++) {
      const gx = room.centerX + (i === 0 ? -3 : 3);
      const gy = room.centerY + (i === 0 ? 2 : -2);
      const goblin = new Monster('goblin', { x: gx, y: gy }, room.id);
      goblin.scaleForFloor(ctx.floorHpMultiplier, ctx.floorAttackMultiplier);
      goblin.scaleForPlayerCount(clampedPlayers);
      ctx.monsters.set(goblin.state.id, goblin);
      room.monsterIds.push(goblin.state.id);
    }
  }
}

function spawnNormalRoom(
  ctx: FloorContext,
  room: DungeonRoom,
  floor: number,
  clampedPlayers: number,
  monsterMultiplier: number,
): void {
  const area = room.width * room.height;
  const baseCount = Math.max(MIN_MONSTERS_PER_ROOM, Math.floor(area / ROOM_AREA_PER_MONSTER));
  const scaledCount = Math.min(MAX_MONSTERS_PER_ROOM, Math.max(1, Math.round(baseCount * monsterMultiplier)));

  const pool = MONSTER_POOL_BY_FLOOR[floor] ?? MONSTER_POOL_BY_FLOOR[4];

  for (let i = 0; i < scaledCount; i++) {
    const type = pickWeightedMonster(pool);

    const mx = room.x + 1 + Math.floor(Math.random() * (room.width - 2));
    const my = room.y + 1 + Math.floor(Math.random() * (room.height - 2));

    // Rats spawn in groups of 2-3
    if (type === 'rat') {
      const groupSize = 2 + Math.floor(Math.random() * 2); // 2-3
      for (let r = 0; r < groupSize; r++) {
        const rx = mx + (Math.random() - 0.5) * 1.5;
        const ry = my + (Math.random() - 0.5) * 1.5;
        const rat = new Monster('rat', { x: rx + 0.5, y: ry + 0.5 }, room.id);
        rat.scaleForFloor(ctx.floorHpMultiplier, ctx.floorAttackMultiplier);
        if (ctx.isSolo) rat.scaleForSolo();
        rat.scaleForPlayerCount(clampedPlayers);
        ctx.monsters.set(rat.state.id, rat);
        room.monsterIds.push(rat.state.id);
      }
    } else {
      const monster = new Monster(type, { x: mx + 0.5, y: my + 0.5 }, room.id);
      monster.scaleForFloor(ctx.floorHpMultiplier, ctx.floorAttackMultiplier);
      if (ctx.isSolo) monster.scaleForSolo();
      monster.scaleForPlayerCount(clampedPlayers);
      ctx.monsters.set(monster.state.id, monster);
      room.monsterIds.push(monster.state.id);
    }
  }

  // Elite monster: 15% + floor*3% chance to spawn an elite (max 60%)
  const eliteChance = Math.min(0.6, 0.15 + floor * 0.03);
  if (Math.random() < eliteChance) {
    const elitePool = MONSTER_POOL_BY_FLOOR[floor] ?? MONSTER_POOL_BY_FLOOR[4];
    const eliteType = pickWeightedMonster(elitePool);
    const ex = room.x + 1 + Math.floor(Math.random() * (room.width - 2));
    const ey = room.y + 1 + Math.floor(Math.random() * (room.height - 2));
    const elite = new Monster(eliteType, { x: ex + 0.5, y: ey + 0.5 }, room.id);
    elite.scaleForFloor(ctx.floorHpMultiplier, ctx.floorAttackMultiplier);
    if (ctx.isSolo) elite.scaleForSolo();
    elite.scaleForPlayerCount(clampedPlayers);
    elite.makeElite();
    ctx.monsters.set(elite.state.id, elite);
    room.monsterIds.push(elite.state.id);
  }
}

/**
 * Advance to the next floor: increment floor, emit events, heal players, open shopping phase.
 */
export function advanceToNextFloor(ctx: FloorContext): void {
  ctx.currentFloor += 1;

  // Notify clients about floor completion
  ctx.io.to(ctx.roomCode).emit('game:floor_complete', { floor: ctx.currentFloor - 1 });

  // Heal players between floors
  const recoveryByPlayers: Record<number, number> = { 1: 0.25, 2: 0.2, 3: 0.15, 4: 0.1 };
  const clampedPlayers = Math.max(1, Math.min(4, ctx.playerCount));
  const recoveryRate = recoveryByPlayers[clampedPlayers] ?? 0.2;
  for (const player of ctx.players.values()) {
    if (player.state.alive) {
      player.state.hp = Math.min(player.state.maxHp, player.state.hp + Math.floor(player.state.maxHp * recoveryRate));
      player.state.mana = Math.min(player.state.maxMana, player.state.mana + Math.floor(player.state.maxMana * recoveryRate));
    }
  }

  // Open shopping phase (except for final boss floor)
  if (ctx.currentFloor <= ctx.maxFloors) {
    startShoppingPhase(ctx);
  }
}

/**
 * Open the shopping phase: emit shop events, set 30s timeout.
 * Returns the timeout handle so GameRoom can track it.
 */
export function startShoppingPhase(ctx: FloorContext): ReturnType<typeof setTimeout> {
  ctx.setPhase('shopping');
  const currentFloor = ctx.currentFloor;
  const availableItems = SHOP_ITEMS.filter(
    item => (!item.floorRequirement || currentFloor >= item.floorRequirement)
  );
  const playerGold: Record<string, number> = {};
  for (const [id, player] of ctx.players) {
    playerGold[id] = player.state.gold;
  }
  ctx.io.to(ctx.roomCode).emit('game:phase_change', { phase: 'shopping' });
  ctx.io.to(ctx.roomCode).emit('game:shop_open', {
    items: availableItems as ShopItem[],
    playerGold,
  });
  // 30 second timeout
  return setTimeout(() => {
    endShoppingPhase(ctx);
  }, 30000);
}

/**
 * End the shopping phase and generate the next floor.
 */
export function endShoppingPhase(ctx: FloorContext): void {
  generateNextFloor(ctx);
}

/**
 * Assign floor modifiers (floor 4+) and generate the new floor.
 */
export function generateNextFloor(ctx: FloorContext): void {
  // Floor modifier assignment (floor 4+)
  ctx.currentFloorModifiers.length = 0;
  if (ctx.currentFloor >= 4) {
    const allModIds = Object.keys(FLOOR_MODIFIERS) as Array<keyof typeof FLOOR_MODIFIERS>;
    const shuffled = allModIds.sort(() => Math.random() - 0.5);
    const count = ctx.currentFloor >= 7 ? 2 : 1;
    for (let i = 0; i < count && i < shuffled.length; i++) {
      ctx.currentFloorModifiers.push(FLOOR_MODIFIERS[shuffled[i]]);
    }
    ctx.io.to(ctx.roomCode).emit('game:floor_modifier', { modifiers: ctx.currentFloorModifiers });
  }
  ctx.setFloorModifiers(ctx.currentFloorModifiers);

  // Generate new floor
  generateFloor(ctx, ctx.currentFloor);
  ctx.setPhase('playing');

  // Broadcast updated state
  ctx.broadcastState();
}

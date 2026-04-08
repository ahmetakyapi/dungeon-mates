import { Server, Socket } from 'socket.io';
import {
  GameState,
  GamePhase,
  PlayerState,
  PlayerInput,
  PlayerClass,
  MonsterType,
  LootType,
  LootState,
  DungeonRoom,
  TileType,
  Vec2,
  FloorModifier,
  ShopItem,
  TICK_MS,
  TICK_RATE,
  MAX_PLAYERS,
  MONSTER_STATS,
  LOOT_TABLE,
  SHOP_ITEMS,
  FLOOR_MODIFIERS,
  goldValueForFloor,
} from '../shared/types';
import { Player } from './entities/Player';
import { Monster } from './entities/Monster';
import { Projectile } from './entities/Projectile';
import { DungeonGenerator, MONSTER_MULTIPLIER_BY_PLAYERS } from './dungeon/DungeonGenerator';

type ReadyState = {
  classSelected: boolean;
  ready: boolean;
};

// Floor-based monster pools with weights
type WeightedMonster = { type: MonsterType; weight: number };

const MONSTER_POOL_BY_FLOOR: Record<number, WeightedMonster[]> = {
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
function pickWeightedMonster(pool: WeightedMonster[]): MonsterType {
  const totalWeight = pool.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const entry of pool) {
    roll -= entry.weight;
    if (roll <= 0) return entry.type;
  }
  return pool[pool.length - 1].type;
}

// --- Game constants ---
const RECONNECT_TIMEOUT_MS = 30_000;
const ROOM_AREA_PER_MONSTER = 14;
const MAX_MONSTERS_PER_ROOM = 14;
const MIN_MONSTERS_PER_ROOM = 4;
const AOE_DAMAGE_MULTIPLIER = 0.6;
const MAX_CHAT_LENGTH = 100;

let nextLootId = 0;

const generateLootId = (): string => {
  nextLootId += 1;
  return `loot_${nextLootId}_${Date.now()}`;
};

export class GameRoom {
  public readonly roomCode: string;
  public isSolo: boolean;
  private readonly io: Server;
  private phase: GamePhase;
  private tick: number;
  private gameLoopTimer: ReturnType<typeof setInterval> | null;

  private players: Map<string, Player>;
  private monsters: Map<string, Monster>;
  private projectiles: Map<string, Projectile>;
  private loot: Map<string, LootState>;
  private readyStates: Map<string, ReadyState>;
  private playerInputs: Map<string, PlayerInput>;
  private disconnectedPlayers: Map<string, { name: string; timeout: ReturnType<typeof setTimeout> }>;

  private tiles: TileType[][];
  private rooms: DungeonRoom[];
  private currentRoomId: number;
  private openedChests: Set<string> = new Set();

  private currentFloor: number;
  private floorAdvancedThisTick: boolean;
  private readonly maxFloors: number;
  private floorHpMultiplier: number;
  private floorAttackMultiplier: number;
  private playerCount: number;
  private shopReadyPlayers: Set<string> = new Set();
  private shopTimeout: ReturnType<typeof setTimeout> | null = null;
  private currentFloorModifiers: FloorModifier[] = [];
  private bossPhaseTracker: Map<string, number> = new Map();

  // Reusable buffers to avoid per-tick allocations
  private readonly _roomCountsMap = new Map<number, number>();
  private readonly _activeRoomIds = new Set<number>();
  private readonly _monsterTargetsBuf: Array<{ position: { x: number; y: number }; alive: boolean }> = [];
  private readonly _alivePlayersBuf: Array<{ id: string; position: Vec2; alive: boolean }> = [];

  // Damage event batch buffer — accumulated per tick, flushed at end
  private readonly _damageBatch: Array<{ targetId: string; damage: number; sourceId: string }> = [];

  // Reusable removal buffers (avoids allocation per tick)
  private readonly _projRemoveBuf: string[] = [];
  private readonly _lootRemoveBuf: string[] = [];

  // Spatial lookup: tileRoomGrid[y][x] = roomId (-1 = no room) — built once per floor
  private tileRoomGrid: Int16Array[] = [];

  private onEmpty: (code: string) => void;

  constructor(io: Server, roomCode: string, onEmpty: (code: string) => void) {
    this.io = io;
    this.roomCode = roomCode;
    this.isSolo = false;
    this.phase = 'lobby';
    this.tick = 0;
    this.gameLoopTimer = null;

    this.players = new Map();
    this.monsters = new Map();
    this.projectiles = new Map();
    this.loot = new Map();
    this.readyStates = new Map();
    this.playerInputs = new Map();
    this.disconnectedPlayers = new Map();

    this.tiles = [];
    this.rooms = [];
    this.currentRoomId = 0;
    this.currentFloor = 1;
    this.floorAdvancedThisTick = false;
    this.maxFloors = 10;
    this.floorHpMultiplier = 1.0;
    this.floorAttackMultiplier = 1.0;
    this.playerCount = 1;
    this.onEmpty = onEmpty;
  }

  private posKey(x: number, y: number): string {
    return `${x},${y}`;
  }

  getPlayerCount(): number {
    return this.players.size;
  }

  getPhase(): GamePhase {
    return this.phase;
  }

  /** Transition to class_select phase immediately (used for solo mode). */
  skipToClassSelect(): void {
    this.phase = 'class_select';
  }

  getAllPlayers(): Record<string, PlayerState> {
    return this.getPlayersRecord();
  }

  addPlayer(socket: Socket, playerName: string): string {
    if (this.players.size >= MAX_PLAYERS) {
      socket.emit('room:error', { message: 'Oda dolu' });
      return '';
    }

    if (this.phase !== 'lobby' && this.phase !== 'class_select') {
      // Check for reconnection
      const disconnected = this.disconnectedPlayers.get(socket.id);
      if (!disconnected) {
        // Check if name matches a disconnected player
        for (const [oldId, dc] of this.disconnectedPlayers.entries()) {
          if (dc.name === playerName) {
            clearTimeout(dc.timeout);
            this.disconnectedPlayers.delete(oldId);

            // Transfer player to new socket
            const existingPlayer = this.players.get(oldId);
            if (existingPlayer) {
              this.players.delete(oldId);
              existingPlayer.state.id = socket.id;
              this.players.set(socket.id, existingPlayer);

              const inputState = this.playerInputs.get(oldId);
              if (inputState) {
                this.playerInputs.delete(oldId);
                this.playerInputs.set(socket.id, inputState);
              }

              socket.join(this.roomCode);
              socket.emit('room:joined', {
                playerId: socket.id,
                players: this.getPlayersRecord(),
              });
              this.io.to(this.roomCode).emit('game:phase_change', { phase: this.phase });

              return socket.id;
            }
          }
        }

        socket.emit('room:error', { message: 'Oyun devam ediyor' });
        return '';
      }
    }

    const spawnPos: Vec2 = { x: 5, y: 5 };
    const player = new Player(socket.id, playerName, spawnPos);

    this.players.set(socket.id, player);
    this.readyStates.set(socket.id, { classSelected: false, ready: false });
    this.playerInputs.set(socket.id, { dx: 0, dy: 0, attack: false, ability: false });

    socket.join(this.roomCode);

    return socket.id;
  }

  removePlayer(socketId: string): void {
    const player = this.players.get(socketId);
    if (!player) return;

    if (this.phase === 'playing' || this.phase === 'boss') {
      // Store for reconnection (30 seconds timeout)
      const timeout = setTimeout(() => {
        this.disconnectedPlayers.delete(socketId);
        this.finalizeRemovePlayer(socketId);
      }, RECONNECT_TIMEOUT_MS);

      this.disconnectedPlayers.set(socketId, {
        name: player.state.name,
        timeout,
      });

      this.io.to(this.roomCode).emit('room:player_left', { playerId: socketId });
    } else {
      this.finalizeRemovePlayer(socketId);
    }
  }

  private finalizeRemovePlayer(socketId: string): void {
    this.players.delete(socketId);
    this.readyStates.delete(socketId);
    this.playerInputs.delete(socketId);

    this.io.to(this.roomCode).emit('room:player_left', { playerId: socketId });

    if (this.players.size === 0 && this.disconnectedPlayers.size === 0) {
      this.stopGameLoop();
      this.onEmpty(this.roomCode);
    }
  }

  handleClassSelect(socketId: string, playerClass: PlayerClass): void {
    const player = this.players.get(socketId);
    const readyState = this.readyStates.get(socketId);
    if (!player || !readyState) return;

    if (this.phase === 'lobby') {
      this.setPhase('class_select');
    }

    if (this.phase !== 'class_select') return;

    player.selectClass(playerClass);
    readyState.classSelected = true;

    this.broadcastState();
  }

  handleReady(socketId: string): void {
    const readyState = this.readyStates.get(socketId);
    if (!readyState || !readyState.classSelected) return;

    readyState.ready = true;

    if (this.isSolo) {
      // Solo mode: start immediately when the single player readies
      this.startGame();
      return;
    }

    // Check if all players are ready
    let allReady = true;
    for (const rs of this.readyStates.values()) {
      if (!rs.classSelected || !rs.ready) { allReady = false; break; }
    }

    if (allReady && this.players.size >= 1) {
      this.startGame();
    }
  }

  handleInput(socketId: string, input: PlayerInput): void {
    const existing = this.playerInputs.get(socketId);
    if (existing) {
      // Update continuous values
      existing.dx = input.dx;
      existing.dy = input.dy;
      existing.sprint = input.sprint;
      existing.toggleMap = input.toggleMap;
      // Preserve one-shot flags that haven't been processed yet
      existing.interact = input.interact || existing.interact;
      existing.dodge = input.dodge || existing.dodge;
      // Don't overwrite attack/ability — they're set via separate events
    } else {
      this.playerInputs.set(socketId, { ...input });
    }
  }

  handleAttack(socketId: string): void {
    const input = this.playerInputs.get(socketId);
    if (input) {
      input.attack = true;
    }
  }

  handleAbility(socketId: string): void {
    const input = this.playerInputs.get(socketId);
    if (input) {
      input.ability = true;
    }
  }

  handleInteract(socketId: string): void {
    const input = this.playerInputs.get(socketId);
    if (input) {
      input.interact = true;
    }
  }

  handleSelectTalent(socketId: string, talentId: string): void {
    const player = this.players.get(socketId);
    if (!player) return;
    const success = player.selectTalent(talentId);
    if (success) {
      this.io.to(this.roomCode).emit('game:talent_selected', {
        playerId: socketId,
        talentId,
      });
    }
  }

  handleBuyItem(socketId: string, itemId: string): void {
    if (this.phase !== 'shopping') return;
    const player = this.players.get(socketId);
    if (!player) return;
    const item = SHOP_ITEMS.find(i => i.id === itemId);
    if (!item) return;
    if (item.floorRequirement && this.currentFloor < item.floorRequirement) return;
    if (item.levelRequirement && player.state.level < item.levelRequirement) return;
    const success = player.buyShopItem(item.effect, item.cost);
    if (success) {
      this.io.to(this.roomCode).emit('game:item_purchased', {
        playerId: socketId,
        itemId,
        remainingGold: player.state.gold,
      });
    }
  }

  handleShopDone(socketId: string): void {
    if (this.phase !== 'shopping') return;
    this.shopReadyPlayers.add(socketId);
    // Tüm oyuncular hazırsa devam et
    if (this.shopReadyPlayers.size >= this.players.size) {
      this.endShoppingPhase();
    }
  }

  private startShoppingPhase(): void {
    this.phase = 'shopping';
    this.shopReadyPlayers.clear();
    const currentFloor = this.currentFloor;
    // Send all items up to this floor — client filters by player level
    const availableItems = SHOP_ITEMS.filter(
      item => (!item.floorRequirement || currentFloor >= item.floorRequirement)
    );
    const playerGold: Record<string, number> = {};
    for (const [id, player] of this.players) {
      playerGold[id] = player.state.gold;
    }
    this.io.to(this.roomCode).emit('game:phase_change', { phase: 'shopping' });
    this.io.to(this.roomCode).emit('game:shop_open', {
      items: availableItems as ShopItem[],
      playerGold,
    });
    // 30 saniye timeout
    this.shopTimeout = setTimeout(() => {
      this.endShoppingPhase();
    }, 30000);
  }

  private endShoppingPhase(): void {
    if (this.shopTimeout) {
      clearTimeout(this.shopTimeout);
      this.shopTimeout = null;
    }
    this.shopReadyPlayers.clear();
    this.generateNextFloor();
  }

  private startGame(): void {
    // Store player count at game start for scaling
    this.playerCount = this.players.size;

    // Mark solo players
    if (this.isSolo) {
      for (const player of this.players.values()) {
        player.isSolo = true;
      }
    }

    this.generateFloor(this.currentFloor);

    this.setPhase('playing');
    this.startGameLoop();
  }

  private generateFloor(floor: number): void {
    // Clear existing monsters, projectiles, loot, opened chests
    this.monsters.clear();
    this.projectiles.clear();
    this.loot.clear();
    this.openedChests.clear();

    // Generate dungeon for current floor (scaled by player count)
    const generator = new DungeonGenerator();
    const dungeon = generator.generate(floor, this.playerCount);
    this.tiles = dungeon.tiles;
    this.rooms = dungeon.rooms;
    this.floorHpMultiplier = dungeon.floorDifficulty.hpMultiplier;
    this.floorAttackMultiplier = dungeon.floorDifficulty.attackMultiplier;

    // Invalidate dungeon cache — tiles/rooms references changed
    this._cachedDungeon = null;

    // Build spatial room lookup grid (O(1) room-at-position instead of O(rooms) linear scan)
    this.buildTileRoomGrid(dungeon.width, dungeon.height);

    // Spawn players in start room
    const startRoom = this.rooms.find((r) => r.isStartRoom);
    if (startRoom) {
      this.currentRoomId = startRoom.id;
      let offset = 0;
      for (const player of this.players.values()) {
        const spawnX = startRoom.centerX + (offset % 2 === 0 ? -1 : 1) * Math.ceil(offset / 2);
        const spawnY = startRoom.centerY;
        player.state.position = { x: spawnX, y: spawnY };
        player.setSpawnPosition({ x: spawnX, y: spawnY });
        offset++;
      }
    }

    // Populate rooms with monsters (scaled for floor and solo)
    this.spawnMonstersInRooms();
  }

  private spawnMonstersInRooms(): void {
    const clampedPlayers = Math.max(1, Math.min(4, this.playerCount));
    const monsterMultiplier = MONSTER_MULTIPLIER_BY_PLAYERS[clampedPlayers] ?? 1.0;
    const hasteMultiplier = this.hasModifier('haste_monsters') ? 1.3 : 1;

    for (const room of this.rooms) {
      if (room.isStartRoom) continue;

      if (room.isBossRoom) {
        // Boss room: spawn boss type based on floor
        const bossTypeMap: Record<number, MonsterType> = {
          3: 'boss_forge_guardian',
          5: 'boss_spider_queen',
          7: 'boss_stone_warden',
          8: 'boss_flame_knight',
        };
        const bossType: MonsterType = this.currentFloor === this.maxFloors
          ? 'boss_demon'
          : (bossTypeMap[this.currentFloor] ?? 'boss_spider_queen');
        const boss = new Monster(bossType, { x: room.centerX, y: room.centerY }, room.id);
        // Boss uses its own MONSTER_STATS HP, then scale for floor + players
        boss.scaleForFloor(this.floorHpMultiplier, this.floorAttackMultiplier);
        if (this.isSolo) boss.scaleForSolo();
        boss.scaleForPlayerCount(clampedPlayers);
        this.monsters.set(boss.state.id, boss);
        room.monsterIds.push(boss.state.id);

        // Skeleton minions: 1 + playerCount instead of always 2
        const skeletonCount = 1 + clampedPlayers;
        for (let i = 0; i < skeletonCount; i++) {
          const angle = (i / skeletonCount) * Math.PI * 2;
          const sx = room.centerX + Math.cos(angle) * 2;
          const sy = room.centerY + Math.sin(angle) * 2;
          const skel = new Monster('skeleton', { x: sx, y: sy }, room.id);
          skel.scaleForFloor(this.floorHpMultiplier, this.floorAttackMultiplier);
          if (this.isSolo) skel.scaleForSolo();
          skel.scaleForPlayerCount(clampedPlayers);
          this.monsters.set(skel.state.id, skel);
          room.monsterIds.push(skel.state.id);
        }

        // For 3-4 players, add goblin elite adds
        if (clampedPlayers >= 3) {
          const goblinCount = clampedPlayers >= 4 ? 2 : 1;
          for (let i = 0; i < goblinCount; i++) {
            const gx = room.centerX + (i === 0 ? -3 : 3);
            const gy = room.centerY + (i === 0 ? 2 : -2);
            const goblin = new Monster('goblin', { x: gx, y: gy }, room.id);
            goblin.scaleForFloor(this.floorHpMultiplier, this.floorAttackMultiplier);
            goblin.scaleForPlayerCount(clampedPlayers);
            this.monsters.set(goblin.state.id, goblin);
            room.monsterIds.push(goblin.state.id);
          }
        }
      } else {
        // Normal room: base 3-6 monsters scaled by player count multiplier
        const area = room.width * room.height;
        const baseCount = Math.max(MIN_MONSTERS_PER_ROOM, Math.floor(area / ROOM_AREA_PER_MONSTER));
        const scaledCount = Math.min(MAX_MONSTERS_PER_ROOM, Math.max(1, Math.round(baseCount * monsterMultiplier)));

        const pool = MONSTER_POOL_BY_FLOOR[this.currentFloor] ?? MONSTER_POOL_BY_FLOOR[4];

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
              rat.scaleForFloor(this.floorHpMultiplier, this.floorAttackMultiplier);
              if (this.isSolo) rat.scaleForSolo();
              rat.scaleForPlayerCount(clampedPlayers);
              this.monsters.set(rat.state.id, rat);
              room.monsterIds.push(rat.state.id);
            }
          } else {
            const monster = new Monster(type, { x: mx + 0.5, y: my + 0.5 }, room.id);
            monster.scaleForFloor(this.floorHpMultiplier, this.floorAttackMultiplier);
            if (this.isSolo) monster.scaleForSolo();
            monster.scaleForPlayerCount(clampedPlayers);
            this.monsters.set(monster.state.id, monster);
            room.monsterIds.push(monster.state.id);
          }
        }

        // Elite monster: %15 + kat*3% şansla bir elite canavar spawn et (max %60)
        const eliteChance = Math.min(0.6, 0.15 + this.currentFloor * 0.03);
        if (Math.random() < eliteChance) {
          const elitePool = MONSTER_POOL_BY_FLOOR[this.currentFloor] ?? MONSTER_POOL_BY_FLOOR[4];
          const eliteType = pickWeightedMonster(elitePool);
          const ex = room.x + 1 + Math.floor(Math.random() * (room.width - 2));
          const ey = room.y + 1 + Math.floor(Math.random() * (room.height - 2));
          const elite = new Monster(eliteType, { x: ex + 0.5, y: ey + 0.5 }, room.id);
          elite.scaleForFloor(this.floorHpMultiplier, this.floorAttackMultiplier);
          if (this.isSolo) elite.scaleForSolo();
          elite.scaleForPlayerCount(clampedPlayers);
          elite.makeElite();
          this.monsters.set(elite.state.id, elite);
          room.monsterIds.push(elite.state.id);
        }
      }
    }

    // Floor modifier: hızlı canavarlar
    if (hasteMultiplier > 1) {
      for (const monster of this.monsters.values()) {
        monster.floorSpeedMultiplier = hasteMultiplier;
      }
    }
  }

  private startGameLoop(): void {
    if (this.gameLoopTimer) return;

    this.gameLoopTimer = setInterval(() => {
      this.gameTick();
    }, TICK_MS);
  }

  private stopGameLoop(): void {
    if (this.gameLoopTimer) {
      clearInterval(this.gameLoopTimer);
      this.gameLoopTimer = null;
    }
  }

  private hasModifier(id: string): boolean {
    const mods = this.currentFloorModifiers;
    for (let i = 0; i < mods.length; i++) {
      if (mods[i].id === id) return true;
    }
    return false;
  }

  private gameTick(): void {
    if (this.phase !== 'playing' && this.phase !== 'boss') return;

    this.tick += 1;
    this.floorAdvancedThisTick = false;

    // Single-pass: determine active rooms + find most-populated room
    const activeRoomIds = this._activeRoomIds;
    activeRoomIds.clear();
    const roomCounts = this._roomCountsMap;
    roomCounts.clear();
    for (const player of this.players.values()) {
      if (!player.state.alive) continue;
      const roomId = this.getRoomAtPosition(player.state.position);
      if (roomId !== null) {
        activeRoomIds.add(roomId);
        const prev = roomCounts.get(roomId) ?? 0;
        roomCounts.set(roomId, prev + 1);
      }
    }
    if (activeRoomIds.size > 0) {
      let maxCount = 0;
      for (const [rid, count] of roomCounts) {
        if (count > maxCount) {
          maxCount = count;
          this.currentRoomId = rid;
        }
      }
    }

    // Build monster target list for auto-aim (reuse array, reference state directly)
    const monsterTargets = this._monsterTargetsBuf;
    let mtIdx = 0;
    for (const m of this.monsters.values()) {
      if (mtIdx < monsterTargets.length) {
        monsterTargets[mtIdx].position = m.state.position;
        monsterTargets[mtIdx].alive = m.state.alive;
      } else {
        monsterTargets.push({ position: m.state.position, alive: m.state.alive });
      }
      mtIdx++;
    }
    monsterTargets.length = mtIdx;

    // Process player inputs
    for (const [socketId, player] of this.players) {
      const input = this.playerInputs.get(socketId);
      if (!input) continue;

      const droughtActive = this.hasModifier('drought');
      const projectile = player.processInput(input, this.tiles, this.tick, monsterTargets, droughtActive);
      if (projectile) {
        this.projectiles.set(projectile.state.id, projectile);
      }

      // Process ability
      if (input.ability) {
        const abilityResult = player.useAbility(monsterTargets);
        if (abilityResult) {
          switch (abilityResult.type) {
            case 'shield_wall':
              // Görsel efekt — hasar azaltma Player.takeDamage içinde
              break;
            case 'ice_storm': {
              // Yarıçap içindeki tüm canavarlara hasar ver
              for (const [monsterId, monster] of this.monsters) {
                if (!monster.state.alive) continue;
                const dx = monster.state.position.x - abilityResult.position.x;
                const dy = monster.state.position.y - abilityResult.position.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist <= abilityResult.radius) {
                  const actualDamage = monster.takeDamage(abilityResult.damage);
                  player.state.totalDamageDealt += actualDamage;
                  player.applyLifesteal(actualDamage);
                  monster.applySlow(0.5, 60); // %50 yavaşlama, 3 saniye
                  this.queueDamage(monsterId, actualDamage, player.state.id);
                  if (!monster.state.alive) {
                    this.handleMonsterKilled(monster, player.state.id);
                  }
                }
              }
              break;
            }
            case 'arrow_rain': {
              for (const proj of abilityResult.projectiles) {
                this.projectiles.set(proj.state.id, proj);
              }
              break;
            }
            case 'healing_wave': {
              // Heal all alive allies (including self) within radius
              for (const [, ally] of this.players) {
                if (!ally.state.alive) continue;
                const dx = ally.state.position.x - abilityResult.position.x;
                const dy = ally.state.position.y - abilityResult.position.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist <= abilityResult.radius) {
                  const prevHp = ally.state.hp;
                  ally.state.hp = Math.min(ally.state.maxHp, ally.state.hp + abilityResult.healAmount);
                  const healed = ally.state.hp - prevHp;
                  if (healed > 0) {
                    this.queueDamage(ally.state.id, -healed, player.state.id); // negative = heal
                  }
                }
              }
              break;
            }
          }
        }
      }

      // Reset attack flag after processing
      input.attack = false;
      input.ability = false;
    }

    // Burning ground: random fire damage to players every 40 ticks
    if (this.hasModifier('burning_ground') && this.tick % 40 === 0) {
      for (const [, player] of this.players) {
        if (!player.state.alive) continue;
        // 25% chance per player per tick interval
        if (Math.random() < 0.25) {
          const burnDmg = 3 + this.currentFloor;
          const burnResult = player.takeDamage(burnDmg);
          if (!burnResult.dodged && burnResult.effectiveDamage > 0) {
            this.queueDamage(player.state.id, burnResult.effectiveDamage, 'burning_ground');
          }
          if (!player.state.alive) {
            this.handlePlayerDeath(player);
          }
        }
      }
    }

    // Update monsters (only in active rooms) — reuse buffer to avoid 3 array allocations per tick
    const alivePlayers = this._alivePlayersBuf;
    alivePlayers.length = 0;
    for (const p of this.players.values()) {
      if (p.state.alive) {
        alivePlayers.push({ id: p.state.id, position: p.state.position, alive: true });
      }
    }

    for (const [monsterId, monster] of this.monsters) {
      if (!monster.state.alive) continue;
      if (!activeRoomIds.has(monster.roomId)) continue;

      const attackResult = monster.update(alivePlayers, this.tiles);

      if (attackResult) {
        const targetPlayer = this.players.get(attackResult.targetId);
        if (targetPlayer) {
          const fragileMultiplier = this.hasModifier('fragile') ? 1.2 : 1;
          const result = targetPlayer.takeDamage(Math.floor(attackResult.damage * fragileMultiplier));
          if (!result.dodged && result.effectiveDamage > 0) {
            this.queueDamage(attackResult.targetId, result.effectiveDamage, monsterId);
            // Thorns hasarı — canavar saldırana yansıyan hasar
            if (result.thornsDamage > 0) {
              const thornsDmg = monster.takeDamage(result.thornsDamage);
              this.queueDamage(monsterId, thornsDmg, attackResult.targetId);
              if (!monster.state.alive) {
                this.handleMonsterKilled(monster, attackResult.targetId);
              }
            }
          }

          if (!targetPlayer.state.alive) {
            this.handlePlayerDeath(targetPlayer);
          }
        }
      }

      // Spider web: apply slow debuff to targeted player
      if (monster.webTarget) {
        const webPlayer = this.players.get(monster.webTarget.playerId);
        if (webPlayer && webPlayer.state.alive) {
          webPlayer.applySlow(monster.webTarget.slowMult, monster.webTarget.slowTicks);
        }
      }

      // Mushroom poison aura: damage nearby players
      for (const poisonTarget of monster.poisonAuraTargets) {
        const poisonPlayer = this.players.get(poisonTarget.playerId);
        if (poisonPlayer && poisonPlayer.state.alive) {
          const poisonResult = poisonPlayer.takeDamage(poisonTarget.damage);
          if (!poisonResult.dodged && poisonResult.effectiveDamage > 0) {
            this.queueDamage(poisonTarget.playerId, poisonResult.effectiveDamage, monsterId);
          }

          if (!poisonPlayer.state.alive) {
            this.handlePlayerDeath(poisonPlayer);
          }
        }
      }

      // Side boss AoE hits (forge slam, stone slam, flame spin/charge)
      for (const aoeHit of monster.aoeHits) {
        const aoePlayer = this.players.get(aoeHit.playerId);
        if (aoePlayer && aoePlayer.state.alive) {
          const fragileMultiplier = this.hasModifier('fragile') ? 1.2 : 1;
          const aoeResult = aoePlayer.takeDamage(Math.floor(aoeHit.damage * fragileMultiplier));
          if (!aoeResult.dodged && aoeResult.effectiveDamage > 0) {
            this.queueDamage(aoeHit.playerId, aoeResult.effectiveDamage, monsterId);
          }
          if (!aoePlayer.state.alive) {
            this.handlePlayerDeath(aoePlayer);
          }
        }
      }

      // Side boss stun targets (stone warden petrify)
      for (const stunTarget of monster.stunTargets) {
        const stunPlayer = this.players.get(stunTarget.playerId);
        if (stunPlayer && stunPlayer.state.alive) {
          stunPlayer.state.stunTicks = Math.max(stunPlayer.state.stunTicks, stunTarget.ticks);
        }
      }

      // Boss summon minions
      if (monster.shouldSummon) {
        const isBossType = monster.state.type === 'boss_demon' ||
          monster.state.type === 'boss_spider_queen' ||
          monster.state.type === 'boss_forge_guardian' ||
          monster.state.type === 'boss_stone_warden' ||
          monster.state.type === 'boss_flame_knight';

        if (isBossType) {
          const room = this.rooms.find((r) => r.id === monster.roomId);
          if (room) {
            // Boss-specific minion type
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
            minion.scaleForFloor(this.floorHpMultiplier, this.floorAttackMultiplier);
            if (this.isSolo) minion.scaleForSolo();
            minion.scaleForPlayerCount(this.playerCount);
            this.monsters.set(minion.state.id, minion);
            room.monsterIds.push(minion.state.id);
          }
        }
      }

      // Boss phase change detection + dialogue
      if (monster.state.bossPhase > 0) {
        const prevPhase = this.bossPhaseTracker.get(monsterId) ?? 0;
        if (monster.state.bossPhase !== prevPhase) {
          this.bossPhaseTracker.set(monsterId, monster.state.bossPhase);
          this.io.to(this.roomCode).emit('game:boss_phase', {
            monsterId,
            phase: monster.state.bossPhase,
          });

          // Boss dialogue per phase
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
            this.io.to(this.roomCode).emit('game:boss_dialogue', {
              monsterId,
              bossType: monster.state.type,
              dialogue,
              phase: monster.state.bossPhase,
            });
          }
        }
      }
    }

    // Update projectiles
    const projectilesToRemove = this._projRemoveBuf;
    projectilesToRemove.length = 0;

    for (const [projId, projectile] of this.projectiles) {
      const alive = projectile.update(this.tiles);
      if (!alive) {
        projectilesToRemove.push(projId);
        continue;
      }

      const owner = this.players.get(projectile.state.ownerId);
      const isPlayerProjectile = owner !== undefined;

      if (isPlayerProjectile) {
        // Check collision with monsters
        let hitSomething = false;

        for (const [monsterId, monster] of this.monsters) {
          if (!monster.state.alive) continue;

          if (projectile.checkCircleCollision(monster.state.position, monster.getRadius())) {
            // Crit kontrolü
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
            this.queueDamage(monsterId, actualDamage, projectile.state.ownerId);

            if (!monster.state.alive) {
              this.handleMonsterKilled(monster, projectile.state.ownerId);
            }

            hitSomething = true;

            // AoE: damage nearby monsters too
            if (projectile.getIsAoe()) {
              for (const [otherId, otherMonster] of this.monsters) {
                if (!otherMonster.state.alive || otherId === monsterId) continue;
                if (projectile.getAoeTargetsInRange(otherMonster.state.position, otherMonster.getRadius())) {
                  const aoeDamage = otherMonster.takeDamage(Math.floor(projectile.state.damage * AOE_DAMAGE_MULTIPLIER));
                  if (owner) owner.state.totalDamageDealt += aoeDamage;
                  this.queueDamage(otherId, aoeDamage, projectile.state.ownerId);
                  if (!otherMonster.state.alive) {
                    this.handleMonsterKilled(otherMonster, projectile.state.ownerId);
                  }
                }
              }
            }

            break;
          }
        }

        if (hitSomething) {
          projectilesToRemove.push(projId);
        }
      } else {
        // Monster projectile: check collision with players
        for (const [, player] of this.players) {
          if (!player.state.alive) continue;

          if (projectile.checkCircleCollision(player.state.position, player.getRadius())) {
            const projResult = player.takeDamage(projectile.state.damage);
            if (!projResult.dodged && projResult.effectiveDamage > 0) {
              this.queueDamage(player.state.id, projResult.effectiveDamage, projectile.state.ownerId);
            }

            if (!player.state.alive) {
              this.handlePlayerDeath(player);
            }

            projectilesToRemove.push(projId);
            break;
          }
        }
      }
    }

    for (const projId of projectilesToRemove) {
      this.projectiles.delete(projId);
    }

    // Loot pickup
    const lootToRemove = this._lootRemoveBuf;
    lootToRemove.length = 0;
    for (const [lootId, lootItem] of this.loot) {
      for (const player of this.players.values()) {
        if (player.tryPickupLoot(lootItem)) {
          lootToRemove.push(lootId);
          this.io.to(this.roomCode).emit('game:loot_pickup', {
            playerId: player.state.id,
            loot: lootItem,
          });
          break;
        }
      }
    }
    for (const lootId of lootToRemove) {
      this.loot.delete(lootId);
    }

    // Co-op revive: alive player near dead player with interact key → revive
    if (!this.isSolo) {
      const REVIVE_RADIUS = 1.8;
      for (const [socketId, player] of this.players) {
        if (!player.state.alive) continue;
        const input = this.playerInputs.get(socketId);
        if (!input?.interact) continue;

        for (const [deadId, deadPlayer] of this.players) {
          if (deadId === socketId || deadPlayer.state.alive) continue;
          if (!deadPlayer.canBeRevived()) continue;

          const rdx = player.state.position.x - deadPlayer.state.position.x;
          const rdy = player.state.position.y - deadPlayer.state.position.y;
          if (rdx * rdx + rdy * rdy <= REVIVE_RADIUS * REVIVE_RADIUS) {
            deadPlayer.revive();
            input.interact = false;
            this.io.to(this.roomCode).emit('chat:message', {
              playerId: socketId,
              name: 'Sistem',
              text: `${player.state.name}, ${deadPlayer.state.name} oyuncusunu canlandırdı!`,
            });
            break;
          }
        }
      }
    }

    // Sandık ve merdiven etkileşimi (R tuşu ile, 1.5 tile yarıçapında)
    const INTERACT_RADIUS = 1.5;
    for (const [socketId, player] of this.players) {
      if (!player.state.alive) continue;
      const input = this.playerInputs.get(socketId);
      if (!input?.interact) continue;
      input.interact = false; // Consume the interact input

      const px = player.state.position.x;
      const py = player.state.position.y;
      const startX = Math.max(0, Math.floor(px - INTERACT_RADIUS));
      const endX = Math.min(this.tiles[0].length - 1, Math.floor(px + INTERACT_RADIUS));
      const startY = Math.max(0, Math.floor(py - INTERACT_RADIUS));
      const endY = Math.min(this.tiles.length - 1, Math.floor(py + INTERACT_RADIUS));

      for (let ty = startY; ty <= endY; ty++) {
        for (let tx = startX; tx <= endX; tx++) {
          const dx = px - (tx + 0.5);
          const dy = py - (ty + 0.5);
          if (dx * dx + dy * dy > INTERACT_RADIUS * INTERACT_RADIUS) continue;

          // Sandık etkileşimi
          if (this.tiles[ty][tx] === 'chest' && !this.openedChests.has(this.posKey(tx, ty))) {
            this.openedChests.add(this.posKey(tx, ty));
            this.tiles[ty][tx] = 'floor';

            this.io.to(this.roomCode).emit('game:chest_opened', { x: tx, y: ty });

            // 1-2 loot düşür (sandıklar nadir, ödülü iyi)
            const lootCount = 1 + Math.floor(Math.random() * 2);
            for (let i = 0; i < lootCount; i++) {
              this.dropLoot({ x: tx + 0.5, y: ty + 0.5 });
            }
          }

          // Merdiven etkileşimi
          if (this.tiles[ty][tx] === 'stairs') {
            const allRoomsCleared = this.rooms.every(r => r.cleared || r.isStartRoom);
            if (allRoomsCleared && this.currentFloor < this.maxFloors) {
              this.io.to(this.roomCode).emit('game:stairs_used');
              this.advanceToNextFloor();
              break;
            }
          }
        }
      }
    }

    // Check room clearing
    this.checkRoomClearing();

    // Check victory/defeat
    this.checkGameEnd();

    // Flush batched damage events before state broadcast
    this.flushDamageBatch();

    // Broadcast state
    this.broadcastState();
  }

  private handlePlayerDeath(player: Player): void {
    this.io.to(this.roomCode).emit('game:player_died', {
      playerId: player.state.id,
    });
    // Co-op ölüm cezası: %20 altın kaybı
    if (!this.isSolo && player.state.gold > 0) {
      const goldLoss = Math.max(5, Math.floor(player.state.gold * 0.2));
      player.state.gold -= goldLoss;
      // Kaybedilen altını yere düşür
      const lootItem: LootState = {
        id: generateLootId(),
        type: 'gold',
        position: {
          x: player.state.position.x + (Math.random() - 0.5),
          y: player.state.position.y + (Math.random() - 0.5),
        },
        value: goldLoss,
      };
      this.loot.set(lootItem.id, lootItem);
    }
  }

  private handleMonsterKilled(monster: Monster, killerId: string): void {
    const stats = MONSTER_STATS[monster.state.type];

    this.io.to(this.roomCode).emit('game:monster_killed', {
      monsterId: monster.state.id,
      killerId,
      xp: stats.xp,
    });

    // Grant XP to killer (scaled for multiplayer to prevent over-leveling)
    const killer = this.players.get(killerId);
    if (killer) {
      const xpMultipliers: Record<number, number> = { 1: 1.0, 2: 0.75, 3: 0.6, 4: 0.5 };
      const clampedPlayers = Math.max(1, Math.min(4, this.playerCount));
      const xpScale = xpMultipliers[clampedPlayers] ?? 1.0;
      const eliteXpMult = monster.state.isElite ? 3 : 1;
      const scaledXp = Math.max(1, Math.floor(stats.xp * xpScale * eliteXpMult));
      const leveled = killer.addXp(scaledXp);
      killer.state.score += scaledXp;

      if (leveled) {
        this.io.to(this.roomCode).emit('game:level_up', {
          playerId: killerId,
          level: killer.state.level,
        });
        // Talent seçeneği gönder
        const availableTalents = killer.getAvailableTalents();
        if (availableTalents.length > 0) {
          this.io.to(this.roomCode).emit('game:talent_choice', {
            playerId: killerId,
            talents: availableTalents,
          });
        }
      }
    }

    // Drop loot — elite'ler 1-2 loot droplar, normal canavarlar 1
    const dropCount = monster.state.isElite ? 1 + Math.floor(Math.random() * 2) : 1;
    for (let i = 0; i < dropCount; i++) {
      this.dropLoot(monster.state.position);
    }
  }

  private dropLoot(position: Vec2): void {
    const lootTypes: LootType[] = ['health_potion', 'mana_potion', 'damage_boost', 'speed_boost', 'gold'];
    // Solo mode: slight boost; multiplayer: small scale up to compensate split
    const dropMultiplier = this.isSolo
      ? 1.15
      : 1 + (this.playerCount - 1) * 0.15; // 2p=1.15, 3p=1.3, 4p=1.45

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
            ? goldValueForFloor(this.currentFloor)
            : (lootType === 'health_potion' || lootType === 'mana_potion') && this.hasModifier('reduced_healing')
              ? Math.floor(lootInfo.value * 0.5)
              : lootInfo.value,
        };
        this.loot.set(lootItem.id, lootItem);
      }
    }
  }

  private checkRoomClearing(): void {
    for (const room of this.rooms) {
      if (room.cleared) continue;

      const allDead = room.monsterIds.every((mId) => {
        const m = this.monsters.get(mId);
        return !m || !m.state.alive;
      });

      if (allDead && room.monsterIds.length > 0) {
        room.cleared = true;
        this.io.to(this.roomCode).emit('game:room_cleared', { roomId: room.id });

        // Check if boss room cleared
        if (room.isBossRoom) {
          if (this.currentFloor >= this.maxFloors) {
            // Final floor boss defeated — victory!
            this.setPhase('victory');
            this.io.to(this.roomCode).emit('game:victory');
            this.stopGameLoop();
            return;
          } else {
            // Mid-boss defeated — auto-advance to next floor
            this.io.to(this.roomCode).emit('game:stairs_used');
            this.advanceToNextFloor();
            return;
          }
        }
      }
    }

    // Kat ilerlemesi artık merdiven etkileşimiyle tetikleniyor (gameTick içinde)
  }

  private advanceToNextFloor(): void {
    if (this.floorAdvancedThisTick) return;
    this.floorAdvancedThisTick = true;

    this.currentFloor += 1;

    // Notify clients about floor completion
    this.io.to(this.roomCode).emit('game:floor_complete', { floor: this.currentFloor - 1 });

    // Heal players between floors — recovery scales with difficulty (fewer players = more recovery)
    const recoveryByPlayers: Record<number, number> = { 1: 0.25, 2: 0.2, 3: 0.15, 4: 0.1 };
    const clampedPlayers = Math.max(1, Math.min(4, this.playerCount));
    const recoveryRate = recoveryByPlayers[clampedPlayers] ?? 0.2;
    for (const player of this.players.values()) {
      if (player.state.alive) {
        player.state.hp = Math.min(player.state.maxHp, player.state.hp + Math.floor(player.state.maxHp * recoveryRate));
        player.state.mana = Math.min(player.state.maxMana, player.state.mana + Math.floor(player.state.maxMana * recoveryRate));
      }
    }

    // Dükkan fazı aç (final boss katı hariç)
    if (this.currentFloor <= this.maxFloors) {
      this.startShoppingPhase();
    }
  }

  private generateNextFloor(): void {
    // Floor modifier ata (kat 4+)
    this.currentFloorModifiers = [];
    if (this.currentFloor >= 4) {
      const allModIds = Object.keys(FLOOR_MODIFIERS) as Array<keyof typeof FLOOR_MODIFIERS>;
      // Fisher-Yates shuffle
      for (let i = allModIds.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = allModIds[i]; allModIds[i] = allModIds[j]; allModIds[j] = tmp;
      }
      const count = this.currentFloor >= 7 ? 2 : 1;
      for (let i = 0; i < count && i < allModIds.length; i++) {
        this.currentFloorModifiers.push(FLOOR_MODIFIERS[allModIds[i]]);
      }
      this.io.to(this.roomCode).emit('game:floor_modifier', { modifiers: this.currentFloorModifiers });
    }

    // Generate new floor
    this.generateFloor(this.currentFloor);
    this.setPhase('playing');

    // Broadcast updated state
    this.broadcastState();
  }

  private checkGameEnd(): void {
    if (this.isSolo) {
      // Solo defeat: player has died 3 times total
      const soloPlayer = this.players.values().next().value ?? null;
      if (soloPlayer && soloPlayer.getSoloDeathsRemaining() <= 0 && !soloPlayer.state.alive) {
        this.setPhase('defeat');
        this.io.to(this.roomCode).emit('game:defeat');
        this.stopGameLoop();
        return;
      }
    } else {
      // Co-op defeat: all players dead simultaneously
      let anyAlive = false;
      for (const p of this.players.values()) {
        if (p.state.alive) { anyAlive = true; break; }
      }
      if (!anyAlive && this.players.size > 0) {
        this.setPhase('defeat');
        this.io.to(this.roomCode).emit('game:defeat');
        this.stopGameLoop();
        return;
      }
    }

    // Check if players entered boss room
    if (this.phase === 'playing') {
      const bossRoom = this.rooms.find((r) => r.isBossRoom);
      if (bossRoom) {
        for (const player of this.players.values()) {
          if (!player.state.alive) continue;
          const roomId = this.getRoomAtPosition(player.state.position);
          if (roomId === bossRoom.id) {
            this.setPhase('boss');
            break;
          }
        }
      }
    }
  }

  /** Build spatial lookup grid — called once per floor generation */
  private buildTileRoomGrid(width: number, height: number): void {
    this.tileRoomGrid = new Array(height);
    for (let y = 0; y < height; y++) {
      this.tileRoomGrid[y] = new Int16Array(width).fill(-1);
    }
    for (const room of this.rooms) {
      for (let ry = room.y; ry < room.y + room.height && ry < height; ry++) {
        for (let rx = room.x; rx < room.x + room.width && rx < width; rx++) {
          this.tileRoomGrid[ry][rx] = room.id;
        }
      }
    }
  }

  /** O(1) room lookup via pre-built grid */
  private getRoomAtPosition(pos: Vec2): number | null {
    const tx = Math.floor(pos.x);
    const ty = Math.floor(pos.y);
    if (ty < 0 || ty >= this.tileRoomGrid.length) return null;
    const row = this.tileRoomGrid[ty];
    if (!row || tx < 0 || tx >= row.length) return null;
    const rid = row[tx];
    return rid === -1 ? null : rid;
  }

  /** Queue damage event for batch emit at end of tick */
  private queueDamage(targetId: string, damage: number, sourceId: string): void {
    this._damageBatch.push({ targetId, damage, sourceId });
  }

  /** Flush accumulated damage events as a single batch emit */
  private flushDamageBatch(): void {
    if (this._damageBatch.length === 0) return;
    this.io.to(this.roomCode).emit('game:damage_batch', this._damageBatch);
    this._damageBatch.length = 0;
  }

  private setPhase(phase: GamePhase): void {
    this.phase = phase;
    this.io.to(this.roomCode).emit('game:phase_change', { phase });
  }

  private getPlayersRecord(): Record<string, PlayerState> {
    const record: Record<string, PlayerState> = {};
    for (const [id, player] of this.players) {
      record[id] = player.getState();
    }
    return record;
  }

  private getMonstersRecord(): Record<string, import('../shared/types').MonsterState> {
    const record: Record<string, import('../shared/types').MonsterState> = {};
    for (const [id, monster] of this.monsters) {
      if (monster.state.alive) {
        record[id] = monster.getState();
      }
    }
    return record;
  }

  private getProjectilesRecord(): Record<string, import('../shared/types').ProjectileState> {
    const record: Record<string, import('../shared/types').ProjectileState> = {};
    for (const [id, projectile] of this.projectiles) {
      record[id] = projectile.getState();
    }
    return record;
  }

  private getLootRecord(): Record<string, LootState> {
    const record: Record<string, LootState> = {};
    for (const [id, lootItem] of this.loot) {
      record[id] = lootItem;
    }
    return record;
  }

  // Cached dungeon object — only rebuilt on floor change (tiles are large & static)
  private _cachedDungeon: GameState['dungeon'] | null = null;
  private _cachedDungeonFloor = -1;

  private broadcastState(): void {
    // Calculate solo deaths remaining
    let soloDeathsRemaining = 0;
    if (this.isSolo) {
      // Avoid Array.from() — just get first value from iterator
      const first = this.players.values().next();
      if (!first.done) {
        soloDeathsRemaining = first.value.getSoloDeathsRemaining();
      }
    }

    // Cache dungeon dimensions — tiles are large & only change on floor transitions
    // Note: rooms are mutable (cleared flag changes) so we always reference this.rooms
    if (this._cachedDungeonFloor !== this.currentFloor || !this._cachedDungeon) {
      this._cachedDungeon = {
        tiles: this.tiles,
        rooms: this.rooms,
        width: this.tiles[0]?.length ?? 0,
        height: this.tiles.length,
        currentFloor: this.currentFloor,
      };
      this._cachedDungeonFloor = this.currentFloor;
    }

    const state: GameState = {
      roomCode: this.roomCode,
      phase: this.phase,
      tick: this.tick,
      players: this.getPlayersRecord(),
      monsters: this.getMonstersRecord(),
      projectiles: this.getProjectilesRecord(),
      loot: this.getLootRecord(),
      dungeon: this._cachedDungeon,
      currentRoomId: this.currentRoomId,
      isSolo: this.isSolo,
      soloDeathsRemaining,
      currentFloorModifiers: this.currentFloorModifiers,
    };

    this.io.to(this.roomCode).emit('game:state', state);
  }

  handleChat(socketId: string, text: string): void {
    const player = this.players.get(socketId);
    if (!player) return;

    const sanitized = text.slice(0, MAX_CHAT_LENGTH).trim();
    if (sanitized.length === 0) return;

    this.io.to(this.roomCode).emit('chat:message', {
      playerId: socketId,
      name: player.state.name,
      text: sanitized,
    });
  }

  destroy(): void {
    this.stopGameLoop();
    for (const [, dc] of this.disconnectedPlayers) {
      clearTimeout(dc.timeout);
    }
    this.disconnectedPlayers.clear();
  }
}

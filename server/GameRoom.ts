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
  TICK_MS,
  TICK_RATE,
  MAX_PLAYERS,
  MONSTER_STATS,
  LOOT_TABLE,
} from '../shared/types';
import { Player } from './entities/Player';
import { Monster } from './entities/Monster';
import { Projectile } from './entities/Projectile';
import { DungeonGenerator } from './dungeon/DungeonGenerator';

type ReadyState = {
  classSelected: boolean;
  ready: boolean;
};

const MONSTER_TYPES_NORMAL: MonsterType[] = ['slime', 'skeleton', 'bat', 'goblin'];

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
  private readonly maxFloors: number;
  private floorHpMultiplier: number;
  private floorAttackMultiplier: number;

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
    this.maxFloors = 5;
    this.floorHpMultiplier = 1.0;
    this.floorAttackMultiplier = 1.0;
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
      }, 30000);

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
    const allReady = Array.from(this.readyStates.values()).every(
      (rs) => rs.classSelected && rs.ready,
    );

    if (allReady && this.players.size >= 1) {
      this.startGame();
    }
  }

  handleInput(socketId: string, input: PlayerInput): void {
    this.playerInputs.set(socketId, input);
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

  private startGame(): void {
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

    // Generate dungeon for current floor
    const generator = new DungeonGenerator();
    const dungeon = generator.generate(floor);
    this.tiles = dungeon.tiles;
    this.rooms = dungeon.rooms;
    this.floorHpMultiplier = dungeon.floorDifficulty.hpMultiplier;
    this.floorAttackMultiplier = dungeon.floorDifficulty.attackMultiplier;

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
    for (const room of this.rooms) {
      if (room.isStartRoom) continue;

      if (room.isBossRoom) {
        // Boss room: 1 boss_demon + 2 skeletons
        const boss = new Monster('boss_demon', { x: room.centerX, y: room.centerY }, room.id);
        boss.scaleForFloor(this.floorHpMultiplier, this.floorAttackMultiplier);
        if (this.isSolo) boss.scaleForSolo();
        this.monsters.set(boss.state.id, boss);
        room.monsterIds.push(boss.state.id);

        const skel1 = new Monster('skeleton', { x: room.centerX - 2, y: room.centerY - 1 }, room.id);
        const skel2 = new Monster('skeleton', { x: room.centerX + 2, y: room.centerY + 1 }, room.id);
        skel1.scaleForFloor(this.floorHpMultiplier, this.floorAttackMultiplier);
        skel2.scaleForFloor(this.floorHpMultiplier, this.floorAttackMultiplier);
        if (this.isSolo) {
          skel1.scaleForSolo();
          skel2.scaleForSolo();
        }
        this.monsters.set(skel1.state.id, skel1);
        this.monsters.set(skel2.state.id, skel2);
        room.monsterIds.push(skel1.state.id, skel2.state.id);
      } else {
        // Normal room: 3-6 monsters based on room size
        const area = room.width * room.height;
        const monsterCount = Math.min(6, Math.max(3, Math.floor(area / 20)));

        for (let i = 0; i < monsterCount; i++) {
          const type = MONSTER_TYPES_NORMAL[Math.floor(Math.random() * MONSTER_TYPES_NORMAL.length)];
          const mx = room.x + 1 + Math.floor(Math.random() * (room.width - 2));
          const my = room.y + 1 + Math.floor(Math.random() * (room.height - 2));

          const monster = new Monster(type, { x: mx + 0.5, y: my + 0.5 }, room.id);
          monster.scaleForFloor(this.floorHpMultiplier, this.floorAttackMultiplier);
          if (this.isSolo) monster.scaleForSolo();
          this.monsters.set(monster.state.id, monster);
          room.monsterIds.push(monster.state.id);
        }
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

  private gameTick(): void {
    if (this.phase !== 'playing' && this.phase !== 'boss') return;

    this.tick += 1;

    // Determine which rooms have players in them
    const activeRoomIds = new Set<number>();
    for (const player of this.players.values()) {
      if (!player.state.alive) continue;
      const roomId = this.getRoomAtPosition(player.state.position);
      if (roomId !== null) {
        activeRoomIds.add(roomId);
      }
    }

    // Update current room id to the room most players are in
    if (activeRoomIds.size > 0) {
      const roomCounts = new Map<number, number>();
      for (const player of this.players.values()) {
        if (!player.state.alive) continue;
        const rid = this.getRoomAtPosition(player.state.position);
        if (rid !== null) {
          roomCounts.set(rid, (roomCounts.get(rid) ?? 0) + 1);
        }
      }
      let maxCount = 0;
      for (const [rid, count] of roomCounts) {
        if (count > maxCount) {
          maxCount = count;
          this.currentRoomId = rid;
        }
      }
    }

    // Process player inputs
    for (const [socketId, player] of this.players) {
      const input = this.playerInputs.get(socketId);
      if (!input) continue;

      const projectile = player.processInput(input, this.tiles, this.tick);
      if (projectile) {
        this.projectiles.set(projectile.state.id, projectile);
      }

      // Process ability
      if (input.ability) {
        const abilityResult = player.useAbility();
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
                  monster.applySlow(0.5, 60); // %50 yavaşlama, 3 saniye
                  this.io.to(this.roomCode).emit('game:damage', {
                    targetId: monsterId,
                    damage: actualDamage,
                    sourceId: player.state.id,
                  });
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
          }
        }
      }

      // Reset attack flag after processing
      input.attack = false;
      input.ability = false;
    }

    // Update monsters (only in active rooms)
    const alivePlayers = Array.from(this.players.values())
      .filter((p) => p.state.alive)
      .map((p) => ({ id: p.state.id, position: p.state.position, alive: p.state.alive }));

    for (const [monsterId, monster] of this.monsters) {
      if (!monster.state.alive) continue;
      if (!activeRoomIds.has(monster.roomId)) continue;

      const attackResult = monster.update(alivePlayers, this.tiles);

      if (attackResult) {
        const targetPlayer = this.players.get(attackResult.targetId);
        if (targetPlayer) {
          const actualDamage = targetPlayer.takeDamage(attackResult.damage);
          this.io.to(this.roomCode).emit('game:damage', {
            targetId: attackResult.targetId,
            damage: actualDamage,
            sourceId: monsterId,
          });

          if (!targetPlayer.state.alive) {
            this.io.to(this.roomCode).emit('game:player_died', {
              playerId: attackResult.targetId,
            });
          }
        }
      }

      // Boss summon minions
      if (monster.shouldSummon && monster.state.type === 'boss_demon') {
        const room = this.rooms.find((r) => r.id === monster.roomId);
        if (room) {
          const skel = new Monster('skeleton', {
            x: monster.state.position.x + (Math.random() - 0.5) * 3,
            y: monster.state.position.y + (Math.random() - 0.5) * 3,
          }, monster.roomId);
          this.monsters.set(skel.state.id, skel);
          room.monsterIds.push(skel.state.id);
        }
      }
    }

    // Update projectiles
    const projectilesToRemove: string[] = [];

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
            const actualDamage = monster.takeDamage(projectile.state.damage);
            if (owner) owner.state.totalDamageDealt += actualDamage;
            this.io.to(this.roomCode).emit('game:damage', {
              targetId: monsterId,
              damage: actualDamage,
              sourceId: projectile.state.ownerId,
            });

            if (!monster.state.alive) {
              this.handleMonsterKilled(monster, projectile.state.ownerId);
            }

            hitSomething = true;

            // AoE: damage nearby monsters too
            if (projectile.getIsAoe()) {
              for (const [otherId, otherMonster] of this.monsters) {
                if (!otherMonster.state.alive || otherId === monsterId) continue;
                if (projectile.getAoeTargetsInRange(otherMonster.state.position, otherMonster.getRadius())) {
                  const aoeDamage = otherMonster.takeDamage(Math.floor(projectile.state.damage * 0.6));
                  if (owner) owner.state.totalDamageDealt += aoeDamage;
                  this.io.to(this.roomCode).emit('game:damage', {
                    targetId: otherId,
                    damage: aoeDamage,
                    sourceId: projectile.state.ownerId,
                  });
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
            const actualDamage = player.takeDamage(projectile.state.damage);
            this.io.to(this.roomCode).emit('game:damage', {
              targetId: player.state.id,
              damage: actualDamage,
              sourceId: projectile.state.ownerId,
            });

            if (!player.state.alive) {
              this.io.to(this.roomCode).emit('game:player_died', {
                playerId: player.state.id,
              });
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
    const lootToRemove: string[] = [];
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

    // Sandık ve merdiven etkileşimi
    for (const player of this.players.values()) {
      if (!player.state.alive) continue;
      const tileX = Math.floor(player.state.position.x);
      const tileY = Math.floor(player.state.position.y);

      if (tileY >= 0 && tileY < this.tiles.length && tileX >= 0 && tileX < this.tiles[0].length) {
        // Sandık etkileşimi
        if (this.tiles[tileY][tileX] === 'chest' && !this.openedChests.has(this.posKey(tileX, tileY))) {
          this.openedChests.add(this.posKey(tileX, tileY));
          this.tiles[tileY][tileX] = 'floor';

          this.io.to(this.roomCode).emit('game:chest_opened', { x: tileX, y: tileY });

          // 2-4 loot düşür
          const lootCount = 2 + Math.floor(Math.random() * 3);
          for (let i = 0; i < lootCount; i++) {
            this.dropLoot({ x: tileX + 0.5, y: tileY + 0.5 });
          }
        }

        // Merdiven etkileşimi
        if (this.tiles[tileY][tileX] === 'stairs') {
          const allRoomsCleared = this.rooms.every(r => r.cleared || r.isStartRoom);
          if (allRoomsCleared && this.currentFloor < this.maxFloors) {
            this.io.to(this.roomCode).emit('game:stairs_used');
            this.advanceToNextFloor();
            break;
          }
        }
      }
    }

    // Check room clearing
    this.checkRoomClearing();

    // Check victory/defeat
    this.checkGameEnd();

    // Broadcast state
    this.broadcastState();
  }

  private handleMonsterKilled(monster: Monster, killerId: string): void {
    const stats = MONSTER_STATS[monster.state.type];

    this.io.to(this.roomCode).emit('game:monster_killed', {
      monsterId: monster.state.id,
      killerId,
      xp: stats.xp,
    });

    // Grant XP to killer
    const killer = this.players.get(killerId);
    if (killer) {
      killer.addXp(stats.xp);
      killer.state.score += stats.xp;
    }

    // Drop loot
    this.dropLoot(monster.state.position);
  }

  private dropLoot(position: Vec2): void {
    const lootTypes: LootType[] = ['health_potion', 'mana_potion', 'damage_boost', 'speed_boost', 'gold'];
    // Solo mode: 50% increased loot drop rates
    const dropMultiplier = this.isSolo ? 1.5 : 1.0;

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
          value: lootInfo.value,
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

        // Check if boss room cleared (only on final floor)
        if (room.isBossRoom && this.currentFloor >= this.maxFloors) {
          this.setPhase('victory');
          this.io.to(this.roomCode).emit('game:victory');
          this.stopGameLoop();
          return;
        }
      }
    }

    // Kat ilerlemesi artık merdiven etkileşimiyle tetikleniyor (gameTick içinde)
  }

  private advanceToNextFloor(): void {
    this.currentFloor += 1;

    // Notify clients about floor completion
    this.io.to(this.roomCode).emit('game:floor_complete', { floor: this.currentFloor - 1 });

    // Heal players slightly between floors
    for (const player of this.players.values()) {
      if (player.state.alive) {
        player.state.hp = Math.min(player.state.maxHp, player.state.hp + Math.floor(player.state.maxHp * 0.3));
        player.state.mana = Math.min(player.state.maxMana, player.state.mana + Math.floor(player.state.maxMana * 0.3));
      }
    }

    // Generate new floor
    this.generateFloor(this.currentFloor);

    // Broadcast updated state
    this.broadcastState();

    // Floor advanced
  }

  private checkGameEnd(): void {
    if (this.isSolo) {
      // Solo defeat: player has died 3 times total
      const soloPlayer = Array.from(this.players.values())[0];
      if (soloPlayer && soloPlayer.getSoloDeathsRemaining() <= 0 && !soloPlayer.state.alive) {
        this.setPhase('defeat');
        this.io.to(this.roomCode).emit('game:defeat');
        this.stopGameLoop();
        return;
      }
    } else {
      // Co-op defeat: all players dead simultaneously
      const anyAlive = Array.from(this.players.values()).some((p) => p.state.alive);
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

  private getRoomAtPosition(pos: Vec2): number | null {
    for (const room of this.rooms) {
      if (
        pos.x >= room.x &&
        pos.x < room.x + room.width &&
        pos.y >= room.y &&
        pos.y < room.y + room.height
      ) {
        return room.id;
      }
    }
    return null;
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

  private broadcastState(): void {
    // Calculate solo deaths remaining
    let soloDeathsRemaining = 0;
    if (this.isSolo) {
      const soloPlayer = Array.from(this.players.values())[0];
      if (soloPlayer) {
        soloDeathsRemaining = soloPlayer.getSoloDeathsRemaining();
      }
    }

    const state: GameState = {
      roomCode: this.roomCode,
      phase: this.phase,
      tick: this.tick,
      players: this.getPlayersRecord(),
      monsters: this.getMonstersRecord(),
      projectiles: this.getProjectilesRecord(),
      loot: this.getLootRecord(),
      dungeon: {
        tiles: this.tiles,
        rooms: this.rooms,
        width: this.tiles[0]?.length ?? 0,
        height: this.tiles.length,
        currentFloor: this.currentFloor,
      },
      currentRoomId: this.currentRoomId,
      isSolo: this.isSolo,
      soloDeathsRemaining,
    };

    this.io.to(this.roomCode).emit('game:state', state);
  }

  handleChat(socketId: string, text: string): void {
    const player = this.players.get(socketId);
    if (!player) return;

    const sanitized = text.slice(0, 100).trim();
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

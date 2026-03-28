import {
  TileType,
  DungeonRoom,
  DUNGEON_WIDTH,
  DUNGEON_HEIGHT,
  ROOM_MIN_SIZE,
  ROOM_MAX_SIZE,
} from '../../shared/types';

type BSPNode = {
  x: number;
  y: number;
  width: number;
  height: number;
  left: BSPNode | null;
  right: BSPNode | null;
  room: { x: number; y: number; width: number; height: number } | null;
};

type FloorDifficulty = {
  hpMultiplier: number;
  attackMultiplier: number;
  hasBoss: boolean;
  floor: number;
};

type DungeonResult = {
  tiles: TileType[][];
  rooms: DungeonRoom[];
  floorDifficulty: FloorDifficulty;
};

const MIN_BSP_SIZE = ROOM_MAX_SIZE + 4;

const FLOOR_CONFIG: Record<number, { roomCountMin: number; roomCountMax: number; hpMultiplier: number; attackMultiplier: number; hasBoss: boolean }> = {
  1: { roomCountMin: 6, roomCountMax: 8, hpMultiplier: 1.0, attackMultiplier: 1.0, hasBoss: false },
  2: { roomCountMin: 7, roomCountMax: 9, hpMultiplier: 1.2, attackMultiplier: 1.1, hasBoss: false },
  3: { roomCountMin: 8, roomCountMax: 10, hpMultiplier: 1.4, attackMultiplier: 1.2, hasBoss: false },
  4: { roomCountMin: 9, roomCountMax: 11, hpMultiplier: 1.6, attackMultiplier: 1.3, hasBoss: false },
  5: { roomCountMin: 10, roomCountMax: 12, hpMultiplier: 1.8, attackMultiplier: 1.4, hasBoss: true },
} as const;

const DEFAULT_ROOM_COUNT_MIN = 6;
const DEFAULT_ROOM_COUNT_MAX = 10;

export class DungeonGenerator {
  private tiles: TileType[][] = [];
  private rooms: DungeonRoom[] = [];
  private nextRoomId = 0;

  generate(floor: number = 1): DungeonResult {
    this.tiles = [];
    this.rooms = [];
    this.nextRoomId = 0;

    const config = FLOOR_CONFIG[floor] ?? FLOOR_CONFIG[1];
    const targetMin = config.roomCountMin;
    const targetMax = config.roomCountMax;

    // Init all tiles as void
    for (let y = 0; y < DUNGEON_HEIGHT; y++) {
      const row: TileType[] = [];
      for (let x = 0; x < DUNGEON_WIDTH; x++) {
        row.push('void');
      }
      this.tiles.push(row);
    }

    // BSP partition
    const root: BSPNode = {
      x: 1,
      y: 1,
      width: DUNGEON_WIDTH - 2,
      height: DUNGEON_HEIGHT - 2,
      left: null,
      right: null,
      room: null,
    };

    this.splitNode(root, 0);
    this.createRooms(root);

    // If we didn't get enough rooms, add more by re-splitting
    if (this.rooms.length < targetMin) {
      // Force create rooms in leaf nodes that don't have one
      this.forceCreateRooms(root);
    }

    // Trim to max
    if (this.rooms.length > targetMax) {
      this.rooms = this.rooms.slice(0, targetMax);
    }

    // Ensure at least minimum rooms
    if (this.rooms.length < targetMin) {
      this.addExtraRooms(targetMin - this.rooms.length);
    }

    // Connect rooms with corridors
    this.connectRooms();

    // Designate start and boss rooms (boss only on floor 5)
    this.designateSpecialRooms(config.hasBoss);

    // Place walls around floors
    this.placeWalls();

    // Place doors, chests, stairs
    this.placeDoors();
    this.placeChests();
    this.placeStairs(config.hasBoss);

    const floorDifficulty: FloorDifficulty = {
      hpMultiplier: config.hpMultiplier,
      attackMultiplier: config.attackMultiplier,
      hasBoss: config.hasBoss,
      floor,
    };

    return {
      tiles: this.tiles,
      rooms: this.rooms,
      floorDifficulty,
    };
  }

  private splitNode(node: BSPNode, depth: number): void {
    if (depth > 5) return;

    const canSplitH = node.height >= MIN_BSP_SIZE * 2;
    const canSplitV = node.width >= MIN_BSP_SIZE * 2;

    if (!canSplitH && !canSplitV) return;

    // Decide split direction
    let splitHorizontally: boolean;
    if (canSplitH && canSplitV) {
      splitHorizontally = node.height > node.width ? true : node.width > node.height ? false : Math.random() > 0.5;
    } else {
      splitHorizontally = canSplitH;
    }

    if (splitHorizontally) {
      const minSplit = MIN_BSP_SIZE;
      const maxSplit = node.height - MIN_BSP_SIZE;
      if (minSplit > maxSplit) return;

      const split = minSplit + Math.floor(Math.random() * (maxSplit - minSplit + 1));

      node.left = {
        x: node.x,
        y: node.y,
        width: node.width,
        height: split,
        left: null,
        right: null,
        room: null,
      };
      node.right = {
        x: node.x,
        y: node.y + split,
        width: node.width,
        height: node.height - split,
        left: null,
        right: null,
        room: null,
      };
    } else {
      const minSplit = MIN_BSP_SIZE;
      const maxSplit = node.width - MIN_BSP_SIZE;
      if (minSplit > maxSplit) return;

      const split = minSplit + Math.floor(Math.random() * (maxSplit - minSplit + 1));

      node.left = {
        x: node.x,
        y: node.y,
        width: split,
        height: node.height,
        left: null,
        right: null,
        room: null,
      };
      node.right = {
        x: node.x + split,
        y: node.y,
        width: node.width - split,
        height: node.height,
        left: null,
        right: null,
        room: null,
      };
    }

    this.splitNode(node.left, depth + 1);
    this.splitNode(node.right, depth + 1);
  }

  private createRooms(node: BSPNode): void {
    if (node.left !== null && node.right !== null) {
      this.createRooms(node.left);
      this.createRooms(node.right);
      return;
    }

    // Leaf node — create a room
    const roomWidth = ROOM_MIN_SIZE + Math.floor(Math.random() * (Math.min(ROOM_MAX_SIZE, node.width - 2) - ROOM_MIN_SIZE + 1));
    const roomHeight = ROOM_MIN_SIZE + Math.floor(Math.random() * (Math.min(ROOM_MAX_SIZE, node.height - 2) - ROOM_MIN_SIZE + 1));

    if (roomWidth < ROOM_MIN_SIZE || roomHeight < ROOM_MIN_SIZE) return;

    const roomX = node.x + 1 + Math.floor(Math.random() * Math.max(1, node.width - roomWidth - 2));
    const roomY = node.y + 1 + Math.floor(Math.random() * Math.max(1, node.height - roomHeight - 2));

    node.room = { x: roomX, y: roomY, width: roomWidth, height: roomHeight };

    this.carveRoom(roomX, roomY, roomWidth, roomHeight);
  }

  private forceCreateRooms(node: BSPNode): void {
    if (node.left !== null && node.right !== null) {
      this.forceCreateRooms(node.left);
      this.forceCreateRooms(node.right);
      return;
    }

    if (node.room !== null) return;

    const roomWidth = Math.min(ROOM_MIN_SIZE, node.width - 2);
    const roomHeight = Math.min(ROOM_MIN_SIZE, node.height - 2);

    if (roomWidth < 5 || roomHeight < 5) return;

    const roomX = node.x + 1;
    const roomY = node.y + 1;

    node.room = { x: roomX, y: roomY, width: roomWidth, height: roomHeight };
    this.carveRoom(roomX, roomY, roomWidth, roomHeight);
  }

  private addExtraRooms(count: number): void {
    for (let i = 0; i < count; i++) {
      const roomWidth = ROOM_MIN_SIZE + Math.floor(Math.random() * 3);
      const roomHeight = ROOM_MIN_SIZE + Math.floor(Math.random() * 3);
      const roomX = 3 + Math.floor(Math.random() * (DUNGEON_WIDTH - roomWidth - 6));
      const roomY = 3 + Math.floor(Math.random() * (DUNGEON_HEIGHT - roomHeight - 6));

      // Check no overlap with existing rooms
      let overlaps = false;
      for (const room of this.rooms) {
        if (
          roomX < room.x + room.width + 2 &&
          roomX + roomWidth + 2 > room.x &&
          roomY < room.y + room.height + 2 &&
          roomY + roomHeight + 2 > room.y
        ) {
          overlaps = true;
          break;
        }
      }

      if (!overlaps) {
        this.carveRoom(roomX, roomY, roomWidth, roomHeight);
      }
    }
  }

  private carveRoom(x: number, y: number, width: number, height: number): void {
    const id = this.nextRoomId++;

    for (let ry = y; ry < y + height; ry++) {
      for (let rx = x; rx < x + width; rx++) {
        if (ry >= 0 && ry < DUNGEON_HEIGHT && rx >= 0 && rx < DUNGEON_WIDTH) {
          this.tiles[ry][rx] = 'floor';
        }
      }
    }

    this.rooms.push({
      id,
      x,
      y,
      width,
      height,
      centerX: Math.floor(x + width / 2),
      centerY: Math.floor(y + height / 2),
      isBossRoom: false,
      isStartRoom: false,
      cleared: false,
      monsterIds: [],
    });
  }

  private connectRooms(): void {
    // Connect each room to the next one in the list
    for (let i = 0; i < this.rooms.length - 1; i++) {
      const a = this.rooms[i];
      const b = this.rooms[i + 1];
      this.carveCorridor(a.centerX, a.centerY, b.centerX, b.centerY);
    }
  }

  private carveCorridor(x1: number, y1: number, x2: number, y2: number): void {
    // L-shaped corridor: go horizontal first, then vertical (or vice versa randomly)
    const goHorizontalFirst = Math.random() > 0.5;

    if (goHorizontalFirst) {
      this.carveHorizontalTunnel(x1, x2, y1);
      this.carveVerticalTunnel(y1, y2, x2);
    } else {
      this.carveVerticalTunnel(y1, y2, x1);
      this.carveHorizontalTunnel(x1, x2, y2);
    }
  }

  private carveHorizontalTunnel(x1: number, x2: number, y: number): void {
    const startX = Math.min(x1, x2);
    const endX = Math.max(x1, x2);

    for (let x = startX; x <= endX; x++) {
      if (y >= 0 && y < DUNGEON_HEIGHT && x >= 0 && x < DUNGEON_WIDTH) {
        this.tiles[y][x] = 'floor';
      }
      // Make corridor 2 tiles wide for playability
      if (y + 1 >= 0 && y + 1 < DUNGEON_HEIGHT && x >= 0 && x < DUNGEON_WIDTH) {
        this.tiles[y + 1][x] = 'floor';
      }
    }
  }

  private carveVerticalTunnel(y1: number, y2: number, x: number): void {
    const startY = Math.min(y1, y2);
    const endY = Math.max(y1, y2);

    for (let y = startY; y <= endY; y++) {
      if (y >= 0 && y < DUNGEON_HEIGHT && x >= 0 && x < DUNGEON_WIDTH) {
        this.tiles[y][x] = 'floor';
      }
      if (y >= 0 && y < DUNGEON_HEIGHT && x + 1 >= 0 && x + 1 < DUNGEON_WIDTH) {
        this.tiles[y][x + 1] = 'floor';
      }
    }
  }

  private designateSpecialRooms(hasBoss: boolean = true): void {
    if (this.rooms.length === 0) return;

    // First room is start room
    this.rooms[0].isStartRoom = true;
    this.rooms[0].cleared = true;

    // Find farthest room from start for boss room
    const startRoom = this.rooms[0];
    let maxDist = 0;
    let bossRoomIndex = this.rooms.length - 1;

    for (let i = 1; i < this.rooms.length; i++) {
      const room = this.rooms[i];
      const dx = room.centerX - startRoom.centerX;
      const dy = room.centerY - startRoom.centerY;
      const dist = dx * dx + dy * dy;

      if (dist > maxDist) {
        maxDist = dist;
        bossRoomIndex = i;
      }
    }

    if (hasBoss) {
      this.rooms[bossRoomIndex].isBossRoom = true;
    }

    // Place doors at room edges where corridors connect
    this.placeDoors();
  }

  private placeDoors(): void {
    for (const room of this.rooms) {
      // Top edge (y = room.y)
      for (let x = room.x; x < room.x + room.width; x++) {
        const insideY = room.y;
        const outsideY = room.y - 1;
        if (outsideY >= 0 && this.tiles[outsideY][x] === 'floor' && this.tiles[insideY][x] === 'floor') {
          this.tiles[insideY][x] = 'door';
        }
      }
      // Bottom edge
      for (let x = room.x; x < room.x + room.width; x++) {
        const insideY = room.y + room.height - 1;
        const outsideY = room.y + room.height;
        if (outsideY < DUNGEON_HEIGHT && this.tiles[outsideY][x] === 'floor' && this.tiles[insideY][x] === 'floor') {
          this.tiles[insideY][x] = 'door';
        }
      }
      // Left edge
      for (let y = room.y; y < room.y + room.height; y++) {
        const insideX = room.x;
        const outsideX = room.x - 1;
        if (outsideX >= 0 && this.tiles[y][outsideX] === 'floor' && this.tiles[y][insideX] === 'floor') {
          this.tiles[y][insideX] = 'door';
        }
      }
      // Right edge
      for (let y = room.y; y < room.y + room.height; y++) {
        const insideX = room.x + room.width - 1;
        const outsideX = room.x + room.width;
        if (outsideX < DUNGEON_WIDTH && this.tiles[y][outsideX] === 'floor' && this.tiles[y][insideX] === 'floor') {
          this.tiles[y][insideX] = 'door';
        }
      }
    }
  }

  private placeChests(): void {
    for (const room of this.rooms) {
      if (room.isStartRoom || room.isBossRoom) continue;

      const chestCount = 1 + (Math.random() > 0.6 ? 1 : 0); // 1-2 sandık
      for (let i = 0; i < chestCount; i++) {
        // Odanın köşe bölgelerine yerleştir
        const corners = [
          { x: room.x + 1, y: room.y + 1 },
          { x: room.x + room.width - 2, y: room.y + 1 },
          { x: room.x + 1, y: room.y + room.height - 2 },
          { x: room.x + room.width - 2, y: room.y + room.height - 2 },
        ];
        const corner = corners[Math.floor(Math.random() * corners.length)];
        if (
          corner.y >= 0 && corner.y < DUNGEON_HEIGHT &&
          corner.x >= 0 && corner.x < DUNGEON_WIDTH &&
          this.tiles[corner.y][corner.x] === 'floor'
        ) {
          this.tiles[corner.y][corner.x] = 'chest';
        }
      }
    }
  }

  private placeStairs(hasBoss: boolean): void {
    if (hasBoss) return; // Kat 5 — merdiven gerekmez, boss öldürünce zafer

    // Başlangıç odasından en uzak odayı bul (çıkış odası)
    const startRoom = this.rooms.find(r => r.isStartRoom);
    if (!startRoom) return;

    let maxDist = 0;
    let exitRoom = this.rooms[this.rooms.length - 1];
    for (const room of this.rooms) {
      if (room.isStartRoom) continue;
      const dx = room.centerX - startRoom.centerX;
      const dy = room.centerY - startRoom.centerY;
      const dist = dx * dx + dy * dy;
      if (dist > maxDist) {
        maxDist = dist;
        exitRoom = room;
      }
    }

    // Çıkış odasının merkezine merdiven yerleştir
    this.tiles[exitRoom.centerY][exitRoom.centerX] = 'stairs';
  }

  private placeWalls(): void {
    // For every floor tile, ensure surrounding void tiles become walls
    const wallPositions: Array<{ x: number; y: number }> = [];

    for (let y = 0; y < DUNGEON_HEIGHT; y++) {
      for (let x = 0; x < DUNGEON_WIDTH; x++) {
        if (this.tiles[y][x] === 'floor') {
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const ny = y + dy;
              const nx = x + dx;
              if (
                ny >= 0 && ny < DUNGEON_HEIGHT &&
                nx >= 0 && nx < DUNGEON_WIDTH &&
                this.tiles[ny][nx] === 'void'
              ) {
                wallPositions.push({ x: nx, y: ny });
              }
            }
          }
        }
      }
    }

    for (const pos of wallPositions) {
      this.tiles[pos.y][pos.x] = 'wall';
    }
  }
}

import { createServer } from 'http';
import { Server } from 'socket.io';
import type { ClientEvents, ServerEvents } from '../shared/types';
import { ROOM_CODE_LENGTH } from '../shared/types';
import { GameRoom } from './GameRoom';

const PORT = Number(process.env.PORT) || 3001;

const httpServer = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Dungeon Mates Server');
});

const io = new Server<ClientEvents, ServerEvents>(httpServer, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') ?? '*',
    methods: ['GET', 'POST'],
  },
  transports: ['polling', 'websocket'],
  allowUpgrades: true,
  pingInterval: 10000,
  pingTimeout: 20000,
});

const rooms = new Map<string, GameRoom>();

// --- Input Validation ---
const MAX_PLAYER_NAME_LENGTH = 20;
const MIN_PLAYER_NAME_LENGTH = 1;
const PLAYER_NAME_REGEX = /^[a-zA-Z0-9\u00C0-\u024F\u0400-\u04FF\u4e00-\u9fff\p{L}\s_-]+$/u;

function sanitizePlayerName(name: unknown): string | null {
  if (typeof name !== 'string') return null;
  const trimmed = name.trim().slice(0, MAX_PLAYER_NAME_LENGTH);
  if (trimmed.length < MIN_PLAYER_NAME_LENGTH) return null;
  if (!PLAYER_NAME_REGEX.test(trimmed)) return null;
  return trimmed;
}

function isValidRoomCode(code: unknown): code is string {
  return typeof code === 'string' && code.length === ROOM_CODE_LENGTH && /^[A-Z0-9]+$/.test(code.toUpperCase());
}

// --- Rate Limiting ---
const RATE_LIMIT_WINDOW_MS = 1000;
const RATE_LIMIT_MAX_EVENTS = 30; // max events per second per socket
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(socketId: string): boolean {
  const now = Date.now();
  let entry = rateLimitMap.get(socketId);
  if (!entry || now > entry.resetTime) {
    entry = { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS };
    rateLimitMap.set(socketId, entry);
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT_MAX_EVENTS;
}

// Cleanup stale rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of rateLimitMap) {
    if (now > entry.resetTime) rateLimitMap.delete(id);
  }
}, 10000);

const generateRoomCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code: string;
  do {
    code = '';
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
  } while (rooms.has(code));
  return code;
};

const handleRoomCleanup = (roomCode: string): void => {
  const room = rooms.get(roomCode);
  if (room) {
    room.destroy();
    rooms.delete(roomCode);
    console.log(`[Room] ${roomCode} destroyed (empty)`);
  }
};

io.on('connection', (socket) => {
  console.log(`[Socket] Connected: ${socket.id}`);

  let currentRoomCode: string | null = null;

  socket.on('room:create', ({ playerName }) => {
    if (!checkRateLimit(socket.id)) return;
    const name = sanitizePlayerName(playerName);
    if (!name) {
      socket.emit('room:error', { message: 'Geçersiz oyuncu adı' });
      return;
    }
    if (currentRoomCode) {
      socket.emit('room:error', { message: 'Zaten bir odasın' });
      return;
    }

    const roomCode = generateRoomCode();
    const room = new GameRoom(io, roomCode, handleRoomCleanup);
    room.isSolo = false;
    rooms.set(roomCode, room);

    const playerId = room.addPlayer(socket, name);
    if (!playerId) return;

    currentRoomCode = roomCode;

    socket.emit('room:created', { roomCode, playerId });
    socket.emit('room:joined', {
      playerId,
      players: room.getAllPlayers(),
    });
    console.log(`[Room] ${roomCode} created by ${name}`);
  });

  socket.on('room:create_solo', ({ playerName }) => {
    if (!checkRateLimit(socket.id)) return;
    const name = sanitizePlayerName(playerName);
    if (!name) {
      socket.emit('room:error', { message: 'Geçersiz oyuncu adı' });
      return;
    }
    if (currentRoomCode) {
      socket.emit('room:error', { message: 'Zaten bir odasın' });
      return;
    }

    const roomCode = generateRoomCode();
    const room = new GameRoom(io, roomCode, handleRoomCleanup);
    room.isSolo = true;
    rooms.set(roomCode, room);

    const playerId = room.addPlayer(socket, name);
    if (!playerId) return;

    currentRoomCode = roomCode;

    socket.emit('room:created', { roomCode, playerId });
    socket.emit('room:joined', {
      playerId,
      players: room.getAllPlayers(),
    });

    // Solo: immediately transition to class_select (skip lobby waiting)
    room.skipToClassSelect();
    socket.emit('game:phase_change', { phase: 'class_select' });

    console.log(`[Room] ${roomCode} created as SOLO by ${name}`);
  });

  socket.on('room:join', ({ roomCode, playerName }) => {
    if (!checkRateLimit(socket.id)) return;
    const name = sanitizePlayerName(playerName);
    if (!name) {
      socket.emit('room:error', { message: 'Geçersiz oyuncu adı' });
      return;
    }
    if (currentRoomCode) {
      socket.emit('room:error', { message: 'Zaten bir odasın' });
      return;
    }
    if (!isValidRoomCode(roomCode)) {
      socket.emit('room:error', { message: 'Geçersiz oda kodu' });
      return;
    }

    const code = roomCode.toUpperCase();
    const room = rooms.get(code);

    if (!room) {
      socket.emit('room:error', { message: 'Oda bulunamadı' });
      return;
    }

    const playerId = room.addPlayer(socket, name);
    if (!playerId) return;

    currentRoomCode = code;

    const allPlayers = room.getAllPlayers();
    socket.emit('room:joined', {
      playerId,
      players: allPlayers,
    });

    const joinedPlayer = allPlayers[playerId];
    if (joinedPlayer) {
      socket.to(code).emit('room:player_joined', { player: joinedPlayer });
    }

    console.log(`[Room] ${name} joined ${code}`);
  });

  socket.on('player:class_select', ({ playerClass }) => {
    if (!checkRateLimit(socket.id)) return;
    if (!currentRoomCode) return;
    const validClasses = ['warrior', 'mage', 'archer', 'healer'];
    if (!validClasses.includes(playerClass)) return;
    const room = rooms.get(currentRoomCode);
    if (!room) return;
    room.handleClassSelect(socket.id, playerClass);
  });

  socket.on('player:ready', () => {
    if (!currentRoomCode) return;
    const room = rooms.get(currentRoomCode);
    if (!room) return;
    room.handleReady(socket.id);
  });

  socket.on('player:input', (data) => {
    if (!currentRoomCode) return;
    const room = rooms.get(currentRoomCode);
    if (!room) return;
    room.handleInput(socket.id, data);
  });

  socket.on('player:attack', () => {
    if (!currentRoomCode) return;
    const room = rooms.get(currentRoomCode);
    if (!room) return;
    room.handleAttack(socket.id);
  });

  socket.on('player:use_ability', () => {
    if (!currentRoomCode) return;
    const room = rooms.get(currentRoomCode);
    if (!room) return;
    room.handleAbility(socket.id);
  });

  socket.on('player:interact', () => {
    if (!currentRoomCode) return;
    const room = rooms.get(currentRoomCode);
    if (!room) return;
    room.handleInteract(socket.id);
  });

  socket.on('player:select_talent', ({ talentId }) => {
    if (!checkRateLimit(socket.id)) return;
    if (!currentRoomCode) return;
    if (typeof talentId !== 'string' || talentId.length > 10) return;
    const room = rooms.get(currentRoomCode);
    if (!room) return;
    room.handleSelectTalent(socket.id, talentId);
  });

  socket.on('player:buy_item', ({ itemId }) => {
    if (!checkRateLimit(socket.id)) return;
    if (!currentRoomCode) return;
    if (typeof itemId !== 'string' || itemId.length > 30) return;
    const room = rooms.get(currentRoomCode);
    if (!room) return;
    room.handleBuyItem(socket.id, itemId);
  });

  socket.on('player:shop_done', () => {
    if (!currentRoomCode) return;
    const room = rooms.get(currentRoomCode);
    if (!room) return;
    room.handleShopDone(socket.id);
  });

  // Chat — rate limited more strictly
  socket.on('chat:send', (data) => {
    if (!checkRateLimit(socket.id)) return;
    if (!currentRoomCode) return;
    if (typeof data?.text !== 'string') return;
    const room = rooms.get(currentRoomCode);
    if (!room) return;
    room.handleChat(socket.id, data.text);
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Disconnected: ${socket.id}`);

    if (currentRoomCode) {
      const room = rooms.get(currentRoomCode);
      if (room) {
        room.removePlayer(socket.id);
      }
      currentRoomCode = null;
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`[Server] Dungeon Mates server running on port ${PORT}`);
});

// --- Graceful Shutdown ---
const shutdown = (signal: string) => {
  console.log(`[Server] ${signal} received, shutting down gracefully...`);
  for (const [code, room] of rooms) {
    room.destroy();
    rooms.delete(code);
  }
  io.close(() => {
    httpServer.close(() => {
      console.log('[Server] Shutdown complete');
      process.exit(0);
    });
  });
  // Force exit after 5s if graceful shutdown hangs
  setTimeout(() => process.exit(1), 5000);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

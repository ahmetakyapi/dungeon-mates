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
    if (currentRoomCode) {
      socket.emit('room:error', { message: 'Zaten bir odasın' });
      return;
    }

    const roomCode = generateRoomCode();
    const room = new GameRoom(io, roomCode, handleRoomCleanup);
    room.isSolo = false;
    rooms.set(roomCode, room);

    const playerId = room.addPlayer(socket, playerName);
    if (!playerId) return;

    currentRoomCode = roomCode;

    socket.emit('room:created', { roomCode, playerId });
    socket.emit('room:joined', {
      playerId,
      players: room.getAllPlayers(),
    });
    console.log(`[Room] ${roomCode} created by ${playerName}`);
  });

  socket.on('room:create_solo', ({ playerName }) => {
    if (currentRoomCode) {
      socket.emit('room:error', { message: 'Zaten bir odasın' });
      return;
    }

    const roomCode = generateRoomCode();
    const room = new GameRoom(io, roomCode, handleRoomCleanup);
    room.isSolo = true;
    rooms.set(roomCode, room);

    const playerId = room.addPlayer(socket, playerName);
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

    console.log(`[Room] ${roomCode} created as SOLO by ${playerName}`);
  });

  socket.on('room:join', ({ roomCode, playerName }) => {
    if (currentRoomCode) {
      socket.emit('room:error', { message: 'Zaten bir odasın' });
      return;
    }

    const code = roomCode.toUpperCase();
    const room = rooms.get(code);

    if (!room) {
      socket.emit('room:error', { message: 'Oda bulunamadı' });
      return;
    }

    const playerId = room.addPlayer(socket, playerName);
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

    console.log(`[Room] ${playerName} joined ${code}`);
  });

  socket.on('player:class_select', ({ playerClass }) => {
    if (!currentRoomCode) return;
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
    if (!currentRoomCode) return;
    const room = rooms.get(currentRoomCode);
    if (!room) return;
    room.handleSelectTalent(socket.id, talentId);
  });

  socket.on('player:buy_item', ({ itemId }) => {
    if (!currentRoomCode) return;
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

  // Chat
  socket.on('chat:send', (data) => {
    if (!currentRoomCode) return;
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

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import type {
  ClientEvents,
  ServerEvents,
  GameState,
  GamePhase,
  PlayerClass,
  PlayerInput,
  PlayerState,
} from '../../shared/types';
import type { ChatMessage } from '@/components/game/ChatBox';

type ConnectionState = 'disconnected' | 'connecting' | 'connected';

type DamageEvent = {
  targetId: string;
  value: number;
  type: 'damage' | 'heal' | 'gold';
  x?: number;
  y?: number;
};

type UseGameSocketReturn = {
  connectionState: ConnectionState;
  roomCode: string;
  playerId: string;
  players: Record<string, PlayerState>;
  phase: GamePhase;
  gameState: GameState | null;
  error: string;
  damageEvents: DamageEvent[];
  chatMessages: ChatMessage[];
  isSolo: boolean;
  soloDeathsRemaining: number;
  monsterKillEvents: Array<{ monsterId: string; killerId: string; xp: number }>;
  roomClearedEvents: number[];
  playerDiedEvents: string[];
  floorCompleteEvent: number | null;
  lootPickupEvents: Array<{ playerId: string; lootType: string; value: number }>;
  chestOpenedEvents: Array<{ x: number; y: number }>;
  stairsUsedEvents: number[];
  reconnectAttempt: number;
  createRoom: (playerName: string) => void;
  createSoloRoom: (playerName: string) => void;
  joinRoom: (roomCode: string, playerName: string) => void;
  selectClass: (playerClass: PlayerClass) => void;
  ready: () => void;
  sendInput: (input: PlayerInput) => void;
  sendChat: (text: string) => void;
  retryConnection: () => void;
};

export function useGameSocket(): UseGameSocketReturn {
  const socketRef = useRef<Socket<ServerEvents, ClientEvents> | null>(null);

  const [connectionState, setConnectionState] =
    useState<ConnectionState>('disconnected');
  const [roomCode, setRoomCode] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [players, setPlayers] = useState<Record<string, PlayerState>>({});
  const [phase, setPhase] = useState<GamePhase>('lobby');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [error, setError] = useState('');
  const [damageEvents, setDamageEvents] = useState<DamageEvent[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isSolo, setIsSolo] = useState(false);
  const [soloDeathsRemaining, setSoloDeathsRemaining] = useState(3);
  const [monsterKillEvents, setMonsterKillEvents] = useState<Array<{
    monsterId: string;
    killerId: string;
    xp: number;
  }>>([]);
  const [roomClearedEvents, setRoomClearedEvents] = useState<number[]>([]);
  const [playerDiedEvents, setPlayerDiedEvents] = useState<string[]>([]);
  const [floorCompleteEvent, setFloorCompleteEvent] = useState<number | null>(null);
  const [lootPickupEvents, setLootPickupEvents] = useState<Array<{ playerId: string; lootType: string; value: number }>>([]);
  const [chestOpenedEvents, setChestOpenedEvents] = useState<Array<{ x: number; y: number }>>([]);
  const [stairsUsedEvents, setStairsUsedEvents] = useState<number[]>([]);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);

  // Room intent tracking for reconnection
  const roomIntentRef = useRef<{
    type: 'create' | 'join' | 'solo';
    playerName: string;
    roomCode?: string;
  } | null>(null);
  const roomJoinedRef = useRef(false);
  const roomCodeRef = useRef('');
  const pendingEmitRef = useRef(false);

  // Helper: execute room intent on a connected socket
  const executeRoomIntent = useCallback((socket: Socket<ServerEvents, ClientEvents>) => {
    const intent = roomIntentRef.current;
    if (!intent || roomJoinedRef.current || pendingEmitRef.current) return;
    pendingEmitRef.current = true;

    // If we have a known roomCode (from previous create/join), try rejoining first
    if (roomCodeRef.current) {
      socket.emit('room:join', { roomCode: roomCodeRef.current, playerName: intent.playerName });
    } else if (intent.type === 'create') {
      socket.emit('room:create', { playerName: intent.playerName });
    } else if (intent.type === 'solo') {
      socket.emit('room:create_solo', { playerName: intent.playerName });
    } else if (intent.type === 'join' && intent.roomCode) {
      socket.emit('room:join', { roomCode: intent.roomCode, playerName: intent.playerName });
    }
  }, []);

  // Connect socket on mount
  useEffect(() => {
    const serverUrl =
      process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3001';

    setConnectionState('connecting');

    const socket: Socket<ServerEvents, ClientEvents> = io(serverUrl, {
      transports: ['polling', 'websocket'],
      upgrade: true,
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
      timeout: 15000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnectionState('connected');
      setError('');
      setReconnectAttempt(0);

      // Replay room intent if we haven't joined a room yet
      executeRoomIntent(socket);
    });

    socket.on('disconnect', (reason) => {
      // Mark room as not joined so reconnection handler replays intent
      roomJoinedRef.current = false;
      pendingEmitRef.current = false;

      if (reason === 'io server disconnect') {
        // Server deliberately closed — reconnect manually
        socket.connect();
      }
      // Socket.IO auto-reconnect is active, stay in 'connecting' not 'disconnected'
      setConnectionState('connecting');
    });

    socket.on('connect_error', (err) => {
      // Don't set 'disconnected' — Socket.IO reconnection loop is still active
      // Only show the error message, connectionState stays 'connecting'
      setError(err.message === 'timeout' ? 'Sunucu yanıt vermiyor' : 'Sunucuya ulaşılamıyor');
    });

    socket.io.on('reconnect_attempt', (attempt) => {
      setConnectionState('connecting');
      setReconnectAttempt(attempt);
    });

    socket.io.on('reconnect', () => {
      setReconnectAttempt(0);
      setError('');
    });

    socket.io.on('reconnect_failed', () => {
      // All reconnection attempts exhausted — NOW set disconnected
      setConnectionState('disconnected');
      setError('Sunucuya bağlanılamadı. Lütfen tekrar deneyin.');
    });

    // Room events
    socket.on('room:created', (data) => {
      setRoomCode(data.roomCode);
      roomCodeRef.current = data.roomCode;
      setPlayerId(data.playerId);
      roomJoinedRef.current = true;
      pendingEmitRef.current = false;
    });

    socket.on('room:joined', (data) => {
      setPlayerId(data.playerId);
      setPlayers(data.players);
      roomJoinedRef.current = true;
      pendingEmitRef.current = false;
    });

    socket.on('room:player_joined', (data) => {
      setPlayers((prev) => ({
        ...prev,
        [data.player.id]: data.player,
      }));
    });

    socket.on('room:player_left', (data) => {
      setPlayers((prev) => {
        const next = { ...prev };
        delete next[data.playerId];
        return next;
      });
    });

    socket.on('room:error', (data) => {
      pendingEmitRef.current = false;
      const intent = roomIntentRef.current;

      // If rejoin failed after reconnect (room destroyed/game over), create a new room
      if (!roomJoinedRef.current && intent && roomCodeRef.current) {
        if (data.message === 'Oda bulunamadı' || data.message === 'Oyun devam ediyor') {
          roomCodeRef.current = '';
          if (intent.type === 'solo') {
            pendingEmitRef.current = true;
            socket.emit('room:create_solo', { playerName: intent.playerName });
            return;
          }
          if (intent.type === 'create') {
            pendingEmitRef.current = true;
            socket.emit('room:create', { playerName: intent.playerName });
            return;
          }
        }
      }
      setError(data.message);
    });

    // Game events
    socket.on('game:phase_change', (data) => {
      setPhase(data.phase);
    });

    socket.on('game:state', (data) => {
      setGameState(data);
      setPlayers(data.players);
      if (data.isSolo) {
        setIsSolo(true);
        setSoloDeathsRemaining(data.soloDeathsRemaining ?? 0);
      }
    });

    socket.on('game:damage', (data) => {
      setDamageEvents((prev) => [
        ...prev.slice(-19),
        {
          targetId: data.targetId,
          value: data.damage,
          type: 'damage',
        },
      ]);
      // Clear after a tick
      setTimeout(() => {
        setDamageEvents((prev) =>
          prev.filter((e) => e.targetId !== data.targetId),
        );
      }, 100);
    });

    socket.on('game:loot_pickup', (data) => {
      setDamageEvents((prev) => [
        ...prev,
        {
          targetId: data.playerId,
          value: data.loot.value,
          type: 'gold',
        },
      ]);
      setLootPickupEvents((prev) => [...prev.slice(-9), {
        playerId: data.playerId,
        lootType: data.loot.type,
        value: data.loot.value,
      }]);
    });

    socket.on('chat:message', (data) => {
      setChatMessages((prev) => {
        const next = [
          ...prev,
          {
            id: `${data.playerId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            playerId: data.playerId,
            name: data.name,
            text: data.text,
            timestamp: Date.now(),
          },
        ];
        // Keep max 50 messages
        return next.length > 50 ? next.slice(-50) : next;
      });
    });

    socket.on('game:monster_killed', (data) => {
      setMonsterKillEvents((prev) => [...prev.slice(-9), data]);
    });

    socket.on('game:room_cleared', (data) => {
      setRoomClearedEvents((prev) => [...prev.slice(-19), data.roomId]);
    });

    socket.on('game:player_died', (data) => {
      setPlayerDiedEvents((prev) => [...prev.slice(-19), data.playerId]);
    });

    socket.on('game:floor_complete', (data) => {
      setFloorCompleteEvent(data.floor);
    });

    socket.on('game:chest_opened', (data) => {
      setChestOpenedEvents((prev) => [...prev.slice(-9), data]);
    });

    socket.on('game:stairs_used', () => {
      setStairsUsedEvents((prev) => [...prev.slice(-9), Date.now()]);
    });

    socket.on('game:victory', () => {
      setPhase('victory');
    });

    socket.on('game:defeat', () => {
      setPhase('defeat');
    });

    // Handle mobile background/foreground — reconnect when page becomes visible
    const handleVisibility = () => {
      if (!document.hidden && socket && !socket.connected) {
        setConnectionState('connecting');
        socket.connect();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      socket.io.off('reconnect_attempt');
      socket.io.off('reconnect');
      socket.io.off('reconnect_failed');
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const createRoom = useCallback((playerName: string) => {
    roomIntentRef.current = { type: 'create', playerName };
    roomJoinedRef.current = false;
    pendingEmitRef.current = false;
    roomCodeRef.current = '';
    const socket = socketRef.current;
    if (socket?.connected) {
      executeRoomIntent(socket);
    }
    // If not connected, the 'connect' handler will pick up the intent
  }, [executeRoomIntent]);

  const createSoloRoom = useCallback((playerName: string) => {
    setIsSolo(true);
    roomIntentRef.current = { type: 'solo', playerName };
    roomJoinedRef.current = false;
    pendingEmitRef.current = false;
    roomCodeRef.current = '';
    const socket = socketRef.current;
    if (socket?.connected) {
      executeRoomIntent(socket);
    }
  }, [executeRoomIntent]);

  const joinRoom = useCallback(
    (code: string, playerName: string) => {
      setRoomCode(code);
      roomCodeRef.current = code;
      roomIntentRef.current = { type: 'join', playerName, roomCode: code };
      roomJoinedRef.current = false;
      pendingEmitRef.current = false;
      const socket = socketRef.current;
      if (socket?.connected) {
        executeRoomIntent(socket);
      }
    },
    [executeRoomIntent],
  );

  const selectClass = useCallback((playerClass: PlayerClass) => {
    socketRef.current?.emit('player:class_select', { playerClass });
  }, []);

  const ready = useCallback(() => {
    socketRef.current?.emit('player:ready');
  }, []);

  // Throttle input to server tick rate (20fps = 50ms)
  const lastInputTimeRef = useRef(0);
  const pendingAttackRef = useRef(false);
  const pendingAbilityRef = useRef(false);
  const pendingInteractRef = useRef(false);

  const sendInput = useCallback((input: PlayerInput) => {
    const socket = socketRef.current;
    if (!socket) return;

    // Buffer one-shot actions so they're never lost
    if (input.attack) pendingAttackRef.current = true;
    if (input.ability) pendingAbilityRef.current = true;
    if (input.interact) pendingInteractRef.current = true;

    // Throttle: only send at ~20fps (matching server tick rate)
    const now = performance.now();
    if (now - lastInputTimeRef.current < 45) return; // ~22fps
    lastInputTimeRef.current = now;

    // Send movement/sprint as continuous input
    socket.emit('player:input', input);

    // Send buffered one-shot actions as separate events
    if (pendingAttackRef.current) {
      socket.emit('player:attack');
      pendingAttackRef.current = false;
    }
    if (pendingAbilityRef.current) {
      socket.emit('player:use_ability');
      pendingAbilityRef.current = false;
    }
    if (pendingInteractRef.current) {
      socket.emit('player:interact');
      pendingInteractRef.current = false;
    }
  }, []);

  const sendChat = useCallback((text: string) => {
    const socket = socketRef.current;
    if (!socket) return;
    socket.emit('chat:send', { text });
  }, []);

  const retryConnection = useCallback(() => {
    const socket = socketRef.current;
    if (!socket) return;
    setError('');
    setReconnectAttempt(0);
    setConnectionState('connecting');
    // Reset so connect handler replays room intent
    roomJoinedRef.current = false;
    pendingEmitRef.current = false;
    if (socket.connected) {
      // Already connected but not in a room — replay intent
      executeRoomIntent(socket);
      return;
    }
    socket.connect();
  }, [executeRoomIntent]);

  return {
    connectionState,
    roomCode,
    playerId,
    players,
    phase,
    gameState,
    error,
    damageEvents,
    chatMessages,
    isSolo,
    soloDeathsRemaining,
    monsterKillEvents,
    roomClearedEvents,
    playerDiedEvents,
    floorCompleteEvent,
    lootPickupEvents,
    chestOpenedEvents,
    stairsUsedEvents,
    reconnectAttempt,
    createRoom,
    createSoloRoom,
    joinRoom,
    selectClass,
    ready,
    sendInput,
    sendChat,
    retryConnection,
  };
}

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

  // Connect socket on mount
  useEffect(() => {
    const serverUrl =
      process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3001';

    setConnectionState('connecting');

    const socket: Socket<ServerEvents, ClientEvents> = io(serverUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      timeout: 60000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnectionState('connected');
    });

    socket.on('disconnect', () => {
      setConnectionState('disconnected');
    });

    socket.io.on('reconnect_attempt', (attempt) => {
      setReconnectAttempt(attempt);
    });

    socket.io.on('reconnect', () => {
      setReconnectAttempt(0);
    });

    // Room events
    socket.on('room:created', (data) => {
      setRoomCode(data.roomCode);
      setPlayerId(data.playerId);
      // Check if solo based on how room was created (flag set before emit)
    });

    socket.on('room:joined', (data) => {
      setPlayerId(data.playerId);
      setPlayers(data.players);
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
        ...prev,
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
      setRoomClearedEvents((prev) => [...prev, data.roomId]);
    });

    socket.on('game:player_died', (data) => {
      setPlayerDiedEvents((prev) => [...prev, data.playerId]);
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

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const createRoom = useCallback((playerName: string) => {
    socketRef.current?.emit('room:create', { playerName });
  }, []);

  const createSoloRoom = useCallback((playerName: string) => {
    setIsSolo(true);
    socketRef.current?.emit('room:create_solo', { playerName });
  }, []);

  const joinRoom = useCallback(
    (code: string, playerName: string) => {
      setRoomCode(code);
      socketRef.current?.emit('room:join', {
        roomCode: code,
        playerName,
      });
    },
    [],
  );

  const selectClass = useCallback((playerClass: PlayerClass) => {
    socketRef.current?.emit('player:class_select', { playerClass });
  }, []);

  const ready = useCallback(() => {
    socketRef.current?.emit('player:ready');
  }, []);

  const sendInput = useCallback((input: PlayerInput) => {
    const socket = socketRef.current;
    if (!socket) return;

    // Send movement/sprint as continuous input
    socket.emit('player:input', input);

    // Send one-shot actions as separate events (won't get overwritten)
    if (input.attack) {
      socket.emit('player:attack');
    }
    if (input.ability) {
      socket.emit('player:use_ability');
    }
    if (input.interact) {
      socket.emit('player:interact');
    }
  }, []);

  const sendChat = useCallback((text: string) => {
    const socket = socketRef.current;
    if (!socket) return;
    socket.emit('chat:send', { text });
  }, []);

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
  };
}

'use client';

import { Suspense, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameSocket } from '@/hooks/useGameSocket';
import { useGameLoop } from '@/hooks/useGameLoop';
import { useSound } from '@/hooks/useSound';
import { HUD } from '@/components/game/HUD';
import { VirtualJoystick } from '@/components/game/VirtualJoystick';
import { GameOverScreen } from '@/components/game/GameOverScreen';
import { ClassSelect } from '@/components/game/ClassSelect';
import { TutorialOverlay } from '@/components/game/TutorialOverlay';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { WaitingScreen } from '@/components/game/WaitingScreen';
import { PauseMenu } from '@/components/game/PauseMenu';
import { DisconnectOverlay } from '@/components/game/DisconnectOverlay';
import { FloorTransition } from '@/components/game/FloorTransition';
import { ChatBox } from '@/components/game/ChatBox';
import { PixelButton } from '@/components/ui/PixelButton';
import { PixelHero } from '@/components/game/PixelHero';
import type { PlayerInput, GamePhase } from '../../../shared/types';
import { CLASS_STATS } from '../../../shared/types';

const EASE = [0.22, 1, 0.36, 1] as const;

const DIFFICULTY_INFO: Record<number, { label: string; color: string }> = {
  1: { label: 'Kolay', color: '#4ade80' },
  2: { label: 'Normal Zorluk', color: '#facc15' },
  3: { label: 'Zor', color: '#f97316' },
  4: { label: 'Çok Zor', color: '#ef4444' },
} as const;

// Floating particles for lobby background
function LobbyParticles() {
  const PARTICLE_COUNT = 20;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: PARTICLE_COUNT }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute h-1 w-1 rounded-full"
          style={{
            backgroundColor: i % 3 === 0 ? '#8b5cf6' : i % 3 === 1 ? '#f59e0b' : '#3b82f6',
            left: `${(i * 17 + 5) % 100}%`,
            top: `${(i * 23 + 10) % 100}%`,
            opacity: 0.15 + (i % 4) * 0.05,
          }}
          animate={{
            y: [0, -30 - (i % 3) * 20, 0],
            x: [0, (i % 2 === 0 ? 15 : -15), 0],
            opacity: [0.1, 0.3, 0.1],
          }}
          transition={{
            duration: 4 + (i % 3) * 2,
            repeat: Infinity,
            delay: (i * 0.3) % 4,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

export default function GamePageWrapper() {
  return (
    <Suspense fallback={<div className="flex h-dvh items-center justify-center bg-dm-bg font-pixel text-dm-accent">Yükleniyor...</div>}>
      <GamePage />
    </Suspense>
  );
}

function GamePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const roomParam = searchParams.get('room');
  const nameParam = searchParams.get('name');
  const modeParam = searchParams.get('mode');

  const {
    connectionState,
    gameState,
    playerId,
    players,
    phase,
    createRoom,
    createSoloRoom,
    joinRoom,
    selectClass,
    ready,
    sendInput,
    roomCode,
    error,
    isSolo,
    soloDeathsRemaining,
    monsterKillEvents,
    roomClearedEvents,
    playerDiedEvents,
    floorCompleteEvent,
    lootPickupEvents,
    chatMessages,
    sendChat,
    chestOpenedEvents,
    stairsUsedEvents,
    reconnectAttempt,
  } = useGameSocket();

  const [gameOverStats, setGameOverStats] = useState<{
    phase: 'victory' | 'defeat';
    kills: number;
    damage: number;
    gold: number;
    floors: number;
    time: number;
    level: number;
    deaths: number;
    isMVP: boolean;
    partyStats: Array<{ name: string; playerClass: string; kills: number; damage: number; gold: number }>;
    defeatCause: string | undefined;
  } | null>(null);

  const sound = useSound();

  const [showTutorial, setShowTutorial] = useState(false);
  const [showLoading, setShowLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Zindan hazırlanıyor');
  const [showPauseMenu, setShowPauseMenu] = useState(false);
  const [showFloorTransition, setShowFloorTransition] = useState(false);
  const [floorTransitionData, setFloorTransitionData] = useState({ completed: 1, next: 2, kills: 0, time: 0 });
  const [copied, setCopied] = useState(false);
  const [roomEntryFlash, setRoomEntryFlash] = useState<{ roomId: number; roomNum: number } | null>(null);
  const [showRoomCleared, setShowRoomCleared] = useState(false);
  const previousPhaseRef = useRef<GamePhase | null>(null);
  const previousFloorRef = useRef(1);
  const gameStartTime = useRef(Date.now());
  const floorStartTime = useRef(Date.now());
  const floorKillsRef = useRef(0);
  const prevMonsterCountRef = useRef(0);
  const prevRoomIdRef = useRef<number | null>(null);
  const prevHpRef = useRef<number | null>(null);
  const prevLevelRef = useRef<number | null>(null);
  const prevAttackingRef = useRef(false);

  const handleInput = useCallback(
    (input: PlayerInput) => {
      if ((phase === 'playing' || phase === 'boss') && !showPauseMenu) {
        sendInput(input);
      }
    },
    [phase, sendInput, showPauseMenu],
  );

  const { fps, isTouchDevice } = useGameLoop({
    canvasRef,
    gameState,
    localPlayerId: playerId,
    onInput: handleInput,
  });

  // Auto-join or create room on mount
  useEffect(() => {
    // Solo mode
    if (modeParam === 'solo') {
      const soloName = nameParam ?? 'Kahraman';
      createSoloRoom(soloName);
      return;
    }

    if (!nameParam) {
      router.push('/');
      return;
    }

    if (roomParam === 'new') {
      createRoom(nameParam);
    } else if (roomParam) {
      joinRoom(roomParam, nameParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle phase transitions
  useEffect(() => {
    const prevPhase = previousPhaseRef.current;
    previousPhaseRef.current = phase;

    if (!prevPhase || prevPhase === phase) return;

    // Show tutorial when transitioning from class_select to playing (first time only)
    if (prevPhase === 'class_select' && phase === 'playing') {
      const tutorialSeen = localStorage.getItem('dungeon-mates-tutorial-seen');
      if (!tutorialSeen) {
        setShowTutorial(true);
        return;
      }
    }

    // Show loading screen for phase transitions
    const LOADING_MESSAGES: Partial<Record<GamePhase, string>> = {
      playing: 'Zindan hazırlanıyor',
      boss: 'Boss odası açılıyor',
    } as const;

    const msg = LOADING_MESSAGES[phase];
    if (msg) {
      setLoadingMessage(msg);
      setShowLoading(true);
      const timer = setTimeout(() => setShowLoading(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  // Track monster kills per floor
  useEffect(() => {
    if (!gameState) return;
    const currentMonsterCount = Object.values(gameState.monsters).filter(m => m.alive).length;
    if (prevMonsterCountRef.current > 0 && currentMonsterCount < prevMonsterCountRef.current) {
      floorKillsRef.current += prevMonsterCountRef.current - currentMonsterCount;
    }
    prevMonsterCountRef.current = currentMonsterCount;
  }, [gameState?.monsters]);

  // Floor transition from server event
  useEffect(() => {
    if (floorCompleteEvent !== null && floorCompleteEvent > previousFloorRef.current) {
      const floorTime = Math.floor((Date.now() - floorStartTime.current) / 1000);
      setFloorTransitionData({
        completed: previousFloorRef.current,
        next: floorCompleteEvent + 1,
        kills: floorKillsRef.current,
        time: floorTime,
      });
      setShowFloorTransition(true);
      floorKillsRef.current = 0;
      floorStartTime.current = Date.now();
      previousFloorRef.current = floorCompleteEvent;
    }
  }, [floorCompleteEvent]);

  // Floor transition detection
  useEffect(() => {
    if (!gameState) return;
    const currentFloor = gameState.dungeon.currentFloor;
    if (currentFloor > previousFloorRef.current) {
      const floorTime = Math.floor((Date.now() - floorStartTime.current) / 1000);
      setFloorTransitionData({
        completed: previousFloorRef.current,
        next: currentFloor,
        kills: floorKillsRef.current,
        time: floorTime,
      });
      setShowFloorTransition(true);
      floorKillsRef.current = 0;
      floorStartTime.current = Date.now();
    }
    previousFloorRef.current = currentFloor;
  }, [gameState?.dungeon.currentFloor, gameState]);

  const localPlayer = gameState?.players[playerId];

  const ABILITY_MAX_COOLDOWNS = { warrior: 240, mage: 300, archer: 200 } as const;

  const abilityCooldownPct = useMemo(() => {
    if (!localPlayer || localPlayer.abilityCooldownTicks <= 0) return 0;
    const maxCd = ABILITY_MAX_COOLDOWNS[localPlayer.class];
    return Math.min(localPlayer.abilityCooldownTicks / maxCd, 1);
  }, [localPlayer?.abilityCooldownTicks, localPlayer?.class]);

  // === Sound Effects ===

  // Attack sound
  useEffect(() => {
    if (!localPlayer) return;
    const wasAttacking = prevAttackingRef.current;
    prevAttackingRef.current = localPlayer.attacking;

    // Only play on transition from false -> true
    if (localPlayer.attacking && !wasAttacking) {
      switch (localPlayer.class) {
        case 'warrior': sound.playSwordSlash(); break;
        case 'archer': sound.playArrowShoot(); break;
        case 'mage': sound.playFireball(); break;
      }
    }
  }, [localPlayer?.attacking, localPlayer?.class, sound]);

  // Phase change sounds
  useEffect(() => {
    if (phase === 'playing') sound.playDungeonMusic();
    if (phase === 'boss') {
      sound.stopMusic();
      sound.playBossAppear();
      const timer = setTimeout(() => sound.playBossMusic(), 1500);
      return () => clearTimeout(timer);
    }
    if (phase === 'victory') { sound.stopMusic(); sound.playVictory(); }
    if (phase === 'defeat') { sound.stopMusic(); sound.playDefeat(); }
  }, [phase, sound]);

  // Monster kill sounds
  useEffect(() => {
    if (monsterKillEvents.length > 0) sound.playMonsterHurt();
  }, [monsterKillEvents.length, sound]);

  // Loot pickup sounds
  useEffect(() => {
    if (lootPickupEvents.length > 0) {
      const latest = lootPickupEvents[lootPickupEvents.length - 1];
      if (latest.lootType === 'gold') sound.playGoldPickup();
      else if (latest.lootType === 'health_potion') sound.playHealthPotion();
      else sound.playLootPickup();
    }
  }, [lootPickupEvents.length, sound]);

  // Player damage sound
  useEffect(() => {
    if (!localPlayer) return;
    if (prevHpRef.current !== null && localPlayer.hp < prevHpRef.current) {
      sound.playPlayerHurt();
    }
    prevHpRef.current = localPlayer.hp;
  }, [localPlayer?.hp, sound]);

  // Floor complete sound
  useEffect(() => {
    if (showFloorTransition) sound.playFloorComplete();
  }, [showFloorTransition, sound]);

  // Room cleared sound + banner
  useEffect(() => {
    if (roomClearedEvents.length > 0) {
      sound.playRoomCleared();
      setShowRoomCleared(true);
      const timer = setTimeout(() => setShowRoomCleared(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [roomClearedEvents.length, sound]);

  // Room entry flash
  useEffect(() => {
    if (!gameState) return;
    const currentRoomId = gameState.currentRoomId;
    if (prevRoomIdRef.current !== null && currentRoomId !== prevRoomIdRef.current) {
      const roomIndex = gameState.dungeon.rooms.findIndex((r) => r.id === currentRoomId);
      setRoomEntryFlash({ roomId: currentRoomId, roomNum: roomIndex + 1 });
      const timer = setTimeout(() => setRoomEntryFlash(null), 1500);
      prevRoomIdRef.current = currentRoomId;
      return () => clearTimeout(timer);
    }
    prevRoomIdRef.current = currentRoomId;
  }, [gameState?.currentRoomId, gameState]);

  // Level up sound
  useEffect(() => {
    if (!localPlayer) return;
    if (prevLevelRef.current !== null && localPlayer.level > prevLevelRef.current) {
      sound.playLevelUp();
    }
    prevLevelRef.current = localPlayer.level;
  }, [localPlayer?.level, sound]);

  // Chest opened sound
  useEffect(() => {
    if (chestOpenedEvents.length > 0) sound.playChestOpen();
  }, [chestOpenedEvents.length, sound]);

  // Stairs used sound
  useEffect(() => {
    if (stairsUsedEvents.length > 0) sound.playStairsDescend();
  }, [stairsUsedEvents.length, sound]);

  // Pause menu sound
  useEffect(() => {
    if (showPauseMenu) sound.playMenuOpen();
  }, [showPauseMenu, sound]);

  // Stop music on unmount
  useEffect(() => {
    return () => { sound.stopMusic(); };
  }, [sound]);

  const handleFloorTransitionContinue = useCallback(() => {
    setShowFloorTransition(false);
  }, []);

  const handleTutorialComplete = useCallback(() => {
    setShowTutorial(false);
    localStorage.setItem('dungeon-mates-tutorial-seen', '1');
  }, []);

  // Pause menu via Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (phase === 'playing' || phase === 'boss')) {
        e.preventDefault();
        setShowPauseMenu((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [phase]);

  // Handle game over
  useEffect(() => {
    if (phase === 'victory' || phase === 'defeat') {
      const localPlayer = gameState?.players[playerId];
      const allPlayers = gameState ? Object.values(gameState.players) : [];
      const maxScore = allPlayers.length > 0
        ? Math.max(...allPlayers.map((p) => p.score))
        : 0;
      const playerIsMVP = allPlayers.length > 1 && (localPlayer?.score ?? 0) >= maxScore;

      // Build party stats
      const partyStats = allPlayers.map((p) => ({
        name: p.name,
        playerClass: p.class,
        kills: p.score,
        damage: p.totalDamageDealt,
        gold: p.goldCollected,
      }));

      // Defeat cause
      let defeatCause: string | undefined;
      if (phase === 'defeat') {
        const bossAlive = gameState
          ? Object.values(gameState.monsters).find((m) => m.type === 'boss_demon' && m.alive)
          : null;
        defeatCause = bossAlive
          ? 'İblis Lordu tarafından yenildiniz'
          : `Kat ${gameState?.dungeon.currentFloor ?? 1} zindan canavarları tarafından yenildiniz`;
      }

      setGameOverStats({
        phase,
        kills: localPlayer?.score ?? 0,
        damage: localPlayer?.totalDamageDealt ?? 0,
        gold: localPlayer?.goldCollected ?? 0,
        floors: gameState?.dungeon.currentFloor ?? 1,
        time: Math.floor((Date.now() - gameStartTime.current) / 1000),
        level: localPlayer?.level ?? 1,
        deaths: localPlayer?.alive === false ? 1 : 0,
        isMVP: playerIsMVP,
        partyStats,
        defeatCause,
      });
    }
  }, [phase, gameState, playerId]);

  const handlePlayAgain = useCallback(() => {
    if (isSolo) {
      // Restart solo
      window.location.href = '/game?mode=solo&name=Kahraman';
    } else {
      router.push('/');
    }
  }, [router, isSolo]);

  const handleMainMenu = useCallback(() => {
    router.push('/');
  }, [router]);

  const handleCopyCode = useCallback(async () => {
    if (!roomCode) return;
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  }, [roomCode]);

  const handleShareLink = useCallback(async () => {
    if (!roomCode) return;
    const url = `${window.location.origin}/game?room=${roomCode}&name=`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  }, [roomCode]);

  const handlePauseResume = useCallback(() => {
    setShowPauseMenu(false);
  }, []);

  const handlePauseRestart = useCallback(() => {
    window.location.href = '/game?mode=solo&name=Kahraman';
  }, []);

  const handlePauseLeave = useCallback(() => {
    router.push('/');
  }, [router]);

  const playerList = useMemo(() => Object.values(players), [players]);

  // ====== CONNECTING / COLD START ======
  if (connectionState === 'connecting' || connectionState === 'disconnected') {
    return <WaitingScreen connectionState={connectionState} reconnectAttempt={reconnectAttempt} />;
  }

  // ====== LOBBY PHASE ======
  if (phase === 'lobby') {
    const difficultyInfo = DIFFICULTY_INFO[Math.min(playerList.length, 4)] ?? DIFFICULTY_INFO[1];

    return (
      <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-dm-bg px-4">
        {/* Background effects */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-dm-accent/5 blur-3xl" />
        <LobbyParticles />

        <motion.div
          className="z-10 flex w-full max-w-lg flex-col items-center gap-6 lg:max-w-xl lg:gap-8 2xl:max-w-2xl 2xl:gap-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          {/* Title */}
          <motion.h1
            className="glow-purple font-pixel text-lg text-dm-accent sm:text-2xl lg:text-3xl 2xl:text-4xl"
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            {isSolo ? 'Hazırlanıyor...' : 'Bekleme Odası'}
          </motion.h1>

          {/* Error */}
          {error && (
            <motion.p
              className="pixel-border rounded bg-red-900/40 px-4 py-2 font-pixel text-[10px] text-dm-health lg:text-sm xl:text-sm 2xl:text-base"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              {error}
            </motion.p>
          )}

          {/* Room code (multiplayer only) */}
          {roomCode && !isSolo && (
            <motion.div
              className="flex flex-col items-center gap-3"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, ease: EASE }}
            >
              <p className="font-pixel text-[10px] text-zinc-400 lg:text-sm xl:text-sm 2xl:text-base">Oda Kodu</p>
              <motion.button
                className="pixel-border cursor-pointer rounded bg-dm-surface px-10 py-5 font-pixel text-4xl tracking-[0.3em] text-dm-gold sm:text-5xl lg:text-6xl 2xl:text-7xl"
                onClick={handleCopyCode}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {roomCode}
              </motion.button>
              <AnimatePresence mode="wait">
                <motion.p
                  key={copied ? 'copied' : 'default'}
                  className="font-pixel text-[10px] lg:text-sm xl:text-sm 2xl:text-base"
                  style={{ color: copied ? '#10b981' : '#8b5cf6' }}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.2 }}
                >
                  {copied ? 'Kopyalandı!' : 'Kodu paylaş! (Tıkla kopyala)'}
                </motion.p>
              </AnimatePresence>

              {/* Share link */}
              <motion.button
                className="flex items-center gap-2 rounded border border-dm-border bg-dm-surface/60 px-4 py-2 font-pixel text-[9px] text-zinc-400 transition-colors hover:border-dm-accent/40 hover:text-dm-accent lg:text-[11px] xl:text-[12px] 2xl:text-[14px]"
                onClick={handleShareLink}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <span>🔗</span> Link Paylaş
              </motion.button>
            </motion.div>
          )}

          {/* Player slots */}
          {!isSolo && (
            <div className="mt-2 w-full">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-pixel text-[10px] text-zinc-400 lg:text-sm xl:text-sm 2xl:text-base">
                  Oyuncular ({playerList.length}/4)
                </p>
                {playerList.length >= 2 && (
                  <motion.span
                    className="rounded border px-2 py-0.5 font-pixel text-[8px] lg:text-[10px] xl:text-[11px] 2xl:text-[13px]"
                    style={{
                      color: difficultyInfo.color,
                      borderColor: `${difficultyInfo.color}40`,
                      backgroundColor: `${difficultyInfo.color}10`,
                    }}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ ease: EASE }}
                  >
                    {playerList.length} Oyuncu — {difficultyInfo.label}
                  </motion.span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {/* Filled slots */}
                {playerList.map((player, i) => (
                  <motion.div
                    key={player.id}
                    className="pixel-border flex flex-col items-center gap-2 rounded-lg bg-dm-surface p-4"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: i * 0.1, ease: EASE }}
                  >
                    <PixelHero
                      playerClass={player.class ?? 'warrior'}
                      size="sm"
                      animate
                      glow={player.id === playerId}
                    />
                    <div className="flex items-center gap-1">
                      {player.class && (
                        <span className="text-[10px] lg:text-xs 2xl:text-sm">{CLASS_STATS[player.class].emoji}</span>
                      )}
                      <span className="max-w-full truncate font-pixel text-[9px] text-white lg:text-[11px] xl:text-[12px] 2xl:text-[14px]">
                        {player.name}
                      </span>
                    </div>
                    {player.id === playerId && (
                      <span className="font-pixel text-[7px] text-dm-accent lg:text-[9px] xl:text-[10px] 2xl:text-[12px]">
                        (Sen)
                      </span>
                    )}
                  </motion.div>
                ))}

                {/* Empty slots */}
                {Array.from({ length: 4 - playerList.length }).map((_, i) => (
                  <motion.div
                    key={`empty-${i}`}
                    className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-dm-border p-4"
                    animate={{
                      opacity: [0.3, 0.5, 0.3],
                      borderColor: [
                        'rgba(31, 41, 55, 0.5)',
                        'rgba(139, 92, 246, 0.2)',
                        'rgba(31, 41, 55, 0.5)',
                      ],
                    }}
                    transition={{ duration: 2, repeat: Infinity, delay: i * 0.4 }}
                  >
                    <div className="h-8 w-8 rounded-full bg-zinc-800" />
                    <span className="font-pixel text-[8px] text-zinc-600 lg:text-[10px] xl:text-[11px] 2xl:text-[13px]">
                      Boş
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Waiting message */}
          {!isSolo && playerList.length < 2 && (
            <motion.p
              className="mt-2 text-center font-pixel text-[10px] text-zinc-500 lg:text-sm xl:text-sm 2xl:text-base"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              Oyuncu bekleniyor
              <motion.span
                animate={{ opacity: [0, 1, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                ...
              </motion.span>
            </motion.p>
          )}

          {/* Back button */}
          <PixelButton variant="secondary" onClick={() => router.push('/')}>
            Ana Menü
          </PixelButton>
        </motion.div>
      </main>
    );
  }

  // ====== CLASS SELECT PHASE ======
  if (phase === 'class_select') {
    return (
      <motion.div
        className="relative"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, ease: EASE }}
      >
        <ClassSelect
          players={players}
          localPlayerId={playerId}
          onSelectClass={selectClass}
          onReady={ready}
          isSolo={isSolo}
        />
      </motion.div>
    );
  }

  // ====== MAIN GAME VIEW (playing/boss) ======
  return (
    <main className="relative h-dvh w-dvw overflow-hidden bg-dm-bg">
      {/* Canvas — full screen */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        style={{ imageRendering: 'pixelated' }}
      />

      {/* HUD overlay */}
      {localPlayer && gameState && (
        <HUD
          player={localPlayer}
          gameState={gameState}
          fps={fps}
          abilityCooldownPct={abilityCooldownPct}
          abilityActive={localPlayer.abilityActive}
          playerClass={localPlayer.class}
          monsterKillEvents={monsterKillEvents}
          lootPickupEvents={lootPickupEvents}
        />
      )}

      {/* Solo lives indicator removed — lives shown in HUD */}

      {/* Virtual joystick (mobile) */}
      <VirtualJoystick
        playerHp={localPlayer?.hp}
        playerMaxHp={localPlayer?.maxHp}
        currentFloor={gameState?.dungeon?.currentFloor}
        skillCooldown={abilityCooldownPct}
      />

      {/* Chat box */}
      {!isSolo && (phase === 'playing' || phase === 'boss') && (
        <ChatBox messages={chatMessages} onSend={sendChat} compact />
      )}

      {/* Pause button (gear icon) */}
      {(phase === 'playing' || phase === 'boss') && (
        <motion.button
          className="pointer-events-auto absolute right-2 top-14 z-30 flex h-10 w-10 items-center justify-center rounded-lg border border-dm-border bg-dm-bg/70 text-lg backdrop-blur-sm transition-colors hover:border-dm-accent/40 sm:right-4 sm:top-16"
          onClick={() => setShowPauseMenu(true)}
          whileTap={{ scale: 0.9 }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.3, ease: EASE }}
        >
          ⚙️
        </motion.button>
      )}

      {/* Room entry flash */}
      <AnimatePresence>
        {roomEntryFlash && (
          <motion.div
            key={roomEntryFlash.roomId}
            className="pointer-events-none absolute left-1/2 top-1/3 z-30 -translate-x-1/2"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, ease: EASE }}
          >
            <span className="font-pixel text-base text-dm-gold sm:text-lg lg:text-xl 2xl:text-2xl" style={{ textShadow: '0 0 12px rgba(245, 158, 11, 0.4)' }}>
              Oda {roomEntryFlash.roomNum}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Room cleared banner */}
      <AnimatePresence>
        {showRoomCleared && (
          <motion.div
            className="pointer-events-none absolute left-1/2 top-1/3 z-30 -translate-x-1/2"
            initial={{ opacity: 0, scale: 0.5, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.2, y: -20 }}
            transition={{ duration: 0.4, ease: EASE }}
          >
            <div className="flex items-center gap-2 rounded border border-emerald-500/30 bg-emerald-950/60 px-4 py-2 backdrop-blur-sm">
              <span className="text-sm sm:text-base">✅</span>
              <span className="font-pixel text-sm text-emerald-400 sm:text-base lg:text-lg 2xl:text-xl" style={{ textShadow: '0 0 10px rgba(16, 185, 129, 0.4)' }}>
                Oda Temizlendi!
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game Over overlay */}
      <AnimatePresence>
        {gameOverStats && (
          <GameOverScreen
            result={gameOverStats.phase}
            stats={{
              monstersKilled: gameOverStats.kills,
              damageDealt: gameOverStats.damage,
              goldCollected: gameOverStats.gold,
              floorsCleared: gameOverStats.floors,
              timePlayed: gameOverStats.time,
              level: gameOverStats.level,
              deaths: gameOverStats.deaths,
              isMVP: gameOverStats.isMVP,
              partyStats: gameOverStats.partyStats,
              defeatCause: gameOverStats.defeatCause,
            }}
            isSolo={isSolo}
            soloDeathsRemaining={soloDeathsRemaining}
            onPlayAgain={handlePlayAgain}
            onMainMenu={handleMainMenu}
          />
        )}
      </AnimatePresence>

      {/* Disconnect overlay */}
      <DisconnectOverlay
        isDisconnected={connectionState !== 'connected' && (phase as string) !== 'lobby'}
        onLeave={handleMainMenu}
      />

      {/* Pause menu */}
      <PauseMenu
        isOpen={showPauseMenu}
        isSolo={isSolo}
        onResume={handlePauseResume}
        onRestart={isSolo ? handlePauseRestart : undefined}
        onLeave={handlePauseLeave}
      />

      {/* Floor transition */}
      <FloorTransition
        isVisible={showFloorTransition}
        completedFloor={floorTransitionData.completed}
        nextFloor={floorTransitionData.next}
        monstersKilled={floorTransitionData.kills}
        timeSpent={floorTransitionData.time}
        onContinue={handleFloorTransitionContinue}
      />

      {/* Tutorial */}
      <AnimatePresence>
        {showTutorial && <TutorialOverlay onComplete={handleTutorialComplete} />}
      </AnimatePresence>

      {/* Loading screen */}
      <AnimatePresence>
        {showLoading && (
          <LoadingScreen
            message={loadingMessage}
            floor={gameState?.dungeon.currentFloor}
          />
        )}
      </AnimatePresence>
    </main>
  );
}

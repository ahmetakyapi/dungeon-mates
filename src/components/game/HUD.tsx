'use client';

import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { PlayerState, GameState, DungeonRoom, PlayerClass, MonsterState } from '../../../shared/types';
import { CLASS_STATS } from '../../../shared/types';
import { SoloLives } from './SoloLives';
import { KillFeed, createKillFeedEntry } from './KillFeed';
import type { KillFeedEntry } from './KillFeed';
import { PlayerHoverCard } from './PlayerHoverCard';

const EASE = [0.22, 1, 0.36, 1] as const;
const TOAST_DURATION = 3000;
const MAX_TOASTS = 4;

// --- Toast system ---

type ToastType = 'info' | 'success' | 'warning' | 'danger';

type Toast = {
  id: string;
  text: string;
  icon: string;
  type: ToastType;
};

const TOAST_COLORS: Record<ToastType, string> = {
  info: '#3b82f6',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
} as const;

const TOAST_BG: Record<ToastType, string> = {
  info: 'border-blue-500/30 bg-blue-950/60',
  success: 'border-emerald-500/30 bg-emerald-950/60',
  warning: 'border-amber-500/30 bg-amber-950/60',
  danger: 'border-red-500/30 bg-red-950/60',
} as const;

let toastIdCounter = 0;
function createToastId(): string {
  toastIdCounter += 1;
  return `toast_${toastIdCounter}_${Date.now()}`;
}

export type HUDEvent =
  | { type: 'room_cleared'; roomId: number }
  | { type: 'level_up'; level: number }
  | { type: 'loot_pickup'; lootType: string; value: number }
  | { type: 'monster_killed'; playerName: string; playerClass: string; monsterName: string; xp: number }
  | { type: 'ping' };

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const addToast = useCallback((text: string, icon: string, type: ToastType) => {
    const id = createToastId();
    setToasts((prev) => [...prev.slice(-(MAX_TOASTS - 1)), { id, text, icon, type }]);

    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      timersRef.current.delete(id);
    }, TOAST_DURATION);

    timersRef.current.set(id, timer);
  }, []);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
    };
  }, []);

  return { toasts, addToast };
}

// --- Sub-components ---

function PixelFrame({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`pointer-events-auto rounded-lg border border-white/[0.06] bg-dm-bg/80 backdrop-blur-md ${className}`}
      style={{
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.03), 0 4px 24px rgba(2,6,23,0.4)',
      }}
    >
      {children}
    </div>
  );
}

function HPBar({
  value,
  max,
  showNumbers,
  isFlashing,
}: {
  value: number;
  max: number;
  showNumbers?: boolean;
  isFlashing?: boolean;
}) {
  const percentage = Math.max(0, Math.min((value / max) * 100, 100));
  const isLow = percentage < 25;

  // Gradient: green -> yellow -> red based on percentage
  const gradientColor = useMemo(() => {
    if (percentage > 60) return 'linear-gradient(90deg, #22c55e, #4ade80)';
    if (percentage > 30) return 'linear-gradient(90deg, #eab308, #facc15)';
    return 'linear-gradient(90deg, #dc2626, #ef4444)';
  }, [percentage]);

  return (
    <div className={`relative ${isLow ? 'low-hp-pulse' : ''}`}>
      <div
        className={`relative h-3.5 overflow-hidden rounded-sm border border-zinc-700/80 bg-zinc-900 sm:h-4 ${
          isFlashing ? 'hp-flash' : ''
        }`}
      >
        <motion.div
          className="absolute inset-y-0 left-0 rounded-sm"
          style={{ background: gradientColor }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.3, ease: EASE }}
        />
        {/* Shine overlay */}
        <div className="absolute inset-0 rounded-sm bg-gradient-to-b from-white/10 to-transparent" style={{ height: '50%' }} />
        {showNumbers && (
          <span className="absolute inset-0 flex items-center justify-center font-pixel text-[6px] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] sm:text-[7px]">
            {Math.ceil(value)}/{max} HP
          </span>
        )}
      </div>
    </div>
  );
}

function ManaBar({
  value,
  max,
  showNumbers,
}: {
  value: number;
  max: number;
  showNumbers?: boolean;
}) {
  const percentage = Math.max(0, Math.min((value / max) * 100, 100));

  return (
    <div className="relative h-3 overflow-hidden rounded-sm border border-zinc-700/80 bg-zinc-900 sm:h-3.5">
      <motion.div
        className="absolute inset-y-0 left-0 rounded-sm"
        style={{ background: 'linear-gradient(90deg, #2563eb, #3b82f6, #60a5fa)' }}
        animate={{ width: `${percentage}%` }}
        transition={{ duration: 0.3, ease: EASE }}
      />
      <div className="absolute inset-0 rounded-sm bg-gradient-to-b from-white/10 to-transparent" style={{ height: '50%' }} />
      {showNumbers && (
        <span className="absolute inset-0 flex items-center justify-center font-pixel text-[5px] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] sm:text-[6px]">
          {Math.ceil(value)}/{max} MP
        </span>
      )}
    </div>
  );
}

function XPBar({
  xp,
  xpToNext,
  level,
}: {
  xp: number;
  xpToNext: number;
  level: number;
}) {
  const currentXP = xp % xpToNext;
  const percentage = Math.max(0, Math.min((currentXP / xpToNext) * 100, 100));

  return (
    <div>
      <div className="relative h-2 overflow-hidden rounded-sm border border-zinc-700/60 bg-zinc-900 sm:h-2.5">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-sm"
          style={{ background: 'linear-gradient(90deg, #d97706, #f59e0b, #fbbf24)' }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.3, ease: EASE }}
        />
      </div>
      <p className="mt-0.5 font-pixel text-[5px] text-dm-gold/70 sm:text-[6px]">
        Seviye {level} — {currentXP}/{xpToNext} XP
      </p>
    </div>
  );
}

function ToastList({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="pointer-events-none absolute right-2 top-12 z-30 flex flex-col items-end gap-2 sm:right-4 sm:top-16">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            layout
            className={`pointer-events-none flex items-center gap-2 rounded-lg border px-3 py-1.5 backdrop-blur-md sm:px-4 sm:py-2 ${TOAST_BG[toast.type]}`}
            initial={{ x: 80, opacity: 0, scale: 0.85 }}
            animate={{ x: 0, opacity: 1, scale: 1 }}
            exit={{ x: 80, opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3, ease: EASE }}
          >
            <span className="text-xs sm:text-sm">{toast.icon}</span>
            <span
              className="font-pixel text-[7px] sm:text-[8px]"
              style={{ color: TOAST_COLORS[toast.type] }}
            >
              {toast.text}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function BossHPBar({ gameState }: { gameState: GameState }) {
  const boss = useMemo(() => {
    const entries = Object.values(gameState.monsters);
    return entries.find((m) => m.type === 'boss_demon' && m.alive) ?? null;
  }, [gameState.monsters]);

  const prevHpRef = useRef<number | null>(null);
  const [delayedPct, setDelayedPct] = useState(100);

  const percentage = boss
    ? Math.max(0, Math.min((boss.hp / boss.maxHp) * 100, 100))
    : 0;

  // Dark Souls-style delayed damage bar
  useEffect(() => {
    if (!boss) return;
    if (prevHpRef.current !== null && boss.hp < prevHpRef.current) {
      // Delay the background bar
      const timer = setTimeout(() => {
        setDelayedPct(percentage);
      }, 600);
      prevHpRef.current = boss.hp;
      return () => clearTimeout(timer);
    }
    prevHpRef.current = boss.hp;
    setDelayedPct(percentage);
  }, [boss, percentage]);

  if (!boss) return null;

  return (
    <motion.div
      className="pointer-events-none absolute left-1/2 top-2 z-30 w-[80%] max-w-lg -translate-x-1/2 sm:top-4 sm:w-[60%]"
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: EASE }}
    >
      <PixelFrame className="p-2 sm:p-3">
        {/* Boss name with skulls */}
        <div className="mb-1.5 flex items-center justify-center gap-2">
          <span className="text-xs sm:text-sm">💀</span>
          <span className="boss-pulse font-pixel text-[9px] text-dm-health sm:text-[11px]">
            İblis Lordu
          </span>
          <span className="text-xs sm:text-sm">💀</span>
        </div>

        {/* HP Bar */}
        <div className="relative h-5 overflow-hidden rounded-sm border border-red-900/60 bg-zinc-900 sm:h-6">
          {/* Delayed damage bar (yellow/orange) */}
          <motion.div
            className="absolute inset-y-0 left-0 rounded-sm bg-amber-600/60"
            animate={{ width: `${delayedPct}%` }}
            transition={{ duration: 0.8, ease: EASE }}
          />
          {/* Actual HP bar */}
          <motion.div
            className="absolute inset-y-0 left-0 rounded-sm"
            style={{
              background: 'linear-gradient(90deg, #7f1d1d, #dc2626, #ef4444)',
            }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.3 }}
          />
          {/* Shine */}
          <div className="absolute inset-0 rounded-sm bg-gradient-to-b from-white/8 to-transparent" style={{ height: '40%' }} />
          {/* Low HP danger flash */}
          {percentage < 30 && (
            <motion.div
              className="absolute inset-0 rounded-sm bg-red-500/20"
              animate={{ opacity: [0, 0.5, 0] }}
              transition={{ duration: 0.8, repeat: Infinity }}
            />
          )}
          {/* HP text */}
          <div className="absolute inset-0 flex items-center justify-center gap-2">
            <span className="font-pixel text-[7px] text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] sm:text-[8px]">
              {Math.ceil(boss.hp)}/{boss.maxHp}
            </span>
            <span className="font-pixel text-[6px] text-red-300/60 sm:text-[7px]">
              ({Math.round(percentage)}%)
            </span>
          </div>
        </div>
      </PixelFrame>
    </motion.div>
  );
}

// --- Minimap ---

function Minimap({
  rooms,
  currentRoomId,
  players,
  monsters,
  localPlayerId,
}: {
  rooms: DungeonRoom[];
  currentRoomId: number;
  players: Record<string, PlayerState>;
  monsters: Record<string, MonsterState>;
  localPlayerId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const size = expanded ? 200 : 120;
  const mobileSize = expanded ? 160 : 80;

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const toggleExpand = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  // Calculate bounds for proper scaling
  const bounds = useMemo(() => {
    if (rooms.length === 0) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const room of rooms) {
      minX = Math.min(minX, room.x);
      minY = Math.min(minY, room.y);
      maxX = Math.max(maxX, room.x + room.width);
      maxY = Math.max(maxY, room.y + room.height);
    }
    return { minX, minY, maxX, maxY };
  }, [rooms]);

  const rangeX = bounds.maxX - bounds.minX || 1;
  const rangeY = bounds.maxY - bounds.minY || 1;

  // Adjacency: connect rooms that have overlapping corridor potential
  const connections = useMemo(() => {
    const conns: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
    for (let i = 0; i < rooms.length; i++) {
      for (let j = i + 1; j < rooms.length; j++) {
        const a = rooms[i];
        const b = rooms[j];
        const dist = Math.sqrt(
          Math.pow(a.centerX - b.centerX, 2) + Math.pow(a.centerY - b.centerY, 2),
        );
        // Heuristic: rooms within reasonable distance are connected
        if (dist < 25) {
          conns.push({
            x1: a.centerX,
            y1: a.centerY,
            x2: b.centerX,
            y2: b.centerY,
          });
        }
      }
    }
    return conns;
  }, [rooms]);

  return (
    <PixelFrame className="cursor-pointer p-1.5 sm:p-2" >
      <div className="mb-1 flex items-center justify-between" onClick={toggleExpand}>
        <span className="font-pixel text-[6px] text-zinc-500 sm:text-[7px]">Harita</span>
        <span className="font-pixel text-[5px] text-zinc-600">
          {expanded ? '−' : '+'}
        </span>
      </div>
      <motion.div
        className="relative overflow-hidden rounded border border-zinc-800/60 bg-zinc-950"
        animate={{
          width: isMobile ? mobileSize : size,
          height: isMobile ? mobileSize : size,
        }}
        transition={{ duration: 0.3, ease: EASE }}
        onClick={toggleExpand}
      >
        <svg
          viewBox={`0 0 ${rangeX} ${rangeY}`}
          className="h-full w-full"
          style={{ imageRendering: 'pixelated' }}
        >
          {/* Corridor connections */}
          {connections.map((c, i) => (
            <line
              key={`conn_${i}`}
              x1={c.x1 - bounds.minX}
              y1={c.y1 - bounds.minY}
              x2={c.x2 - bounds.minX}
              y2={c.y2 - bounds.minY}
              stroke="#374151"
              strokeWidth={0.8}
            />
          ))}

          {/* Room rectangles */}
          {rooms.map((room) => {
            const isCurrent = room.id === currentRoomId;
            const fill = isCurrent
              ? '#f59e0b'
              : room.cleared
                ? '#22c55e'
                : room.isBossRoom
                  ? '#dc2626'
                  : '#374151';
            const opacity = isCurrent ? 1 : room.cleared ? 0.6 : room.isBossRoom ? 0.7 : 0.35;

            return (
              <g key={room.id}>
                <rect
                  x={room.x - bounds.minX}
                  y={room.y - bounds.minY}
                  width={room.width}
                  height={room.height}
                  fill={fill}
                  opacity={opacity}
                  rx={0.5}
                />
                {/* Boss room skull marker */}
                {room.isBossRoom && (
                  <text
                    x={room.centerX - bounds.minX}
                    y={room.centerY - bounds.minY + 1.5}
                    textAnchor="middle"
                    fontSize={4}
                    fill="#ffffff"
                    opacity={0.9}
                  >
                    ☠
                  </text>
                )}
                {/* Current room player dot (fallback if no precise position) */}
                {isCurrent && !players[localPlayerId] && (
                  <circle
                    cx={room.centerX - bounds.minX}
                    cy={room.centerY - bounds.minY}
                    r={1.2}
                    fill="#ffffff"
                    className="minimap-blink"
                  />
                )}
              </g>
            );
          })}

          {/* Alive monsters — red pulsing dots */}
          {Object.values(monsters).filter((m) => m.alive).map((monster) => (
            <circle
              key={`mm_${monster.id}`}
              cx={monster.position.x - bounds.minX}
              cy={monster.position.y - bounds.minY}
              r={0.7}
              fill="#ef4444"
              opacity={0.85}
              className="minimap-enemy-pulse"
            />
          ))}

          {/* Teammate dots — green */}
          {Object.values(players).filter((p) => p.id !== localPlayerId && p.alive).map((mate) => (
            <circle
              key={`mt_${mate.id}`}
              cx={mate.position.x - bounds.minX}
              cy={mate.position.y - bounds.minY}
              r={1.0}
              fill="#4ade80"
              opacity={0.9}
            />
          ))}

          {/* Local player dot — white blinking */}
          {players[localPlayerId]?.alive && (
            <circle
              cx={players[localPlayerId].position.x - bounds.minX}
              cy={players[localPlayerId].position.y - bounds.minY}
              r={1.2}
              fill="#ffffff"
              className="minimap-blink"
            />
          )}
        </svg>
      </motion.div>
    </PixelFrame>
  );
}

// --- Sprint Indicator (desktop only) ---

function SprintIndicator() {
  const [isSprinting, setIsSprinting] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(
        window.innerWidth < 640 ||
          ('ontouchstart' in window && navigator.maxTouchPoints > 0),
      );
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (isMobile) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        setIsSprinting(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        setIsSprinting(false);
      }
    };
    const handleBlur = () => setIsSprinting(false);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [isMobile]);

  if (isMobile) return null;

  return (
    <PixelFrame className="flex items-center gap-1.5 px-2 py-1.5 sm:px-3 sm:py-2">
      <motion.div
        className="h-2.5 w-2.5 rounded-full sm:h-3 sm:w-3"
        animate={{
          backgroundColor: isSprinting ? '#f59e0b' : '#3f3f46',
          boxShadow: isSprinting
            ? '0 0 8px rgba(245, 158, 11, 0.6)'
            : '0 0 0px transparent',
        }}
        transition={{ duration: 0.15 }}
      />
      <div className="flex flex-col">
        <span
          className="font-pixel text-[6px] sm:text-[7px]"
          style={{ color: isSprinting ? '#f59e0b' : '#71717a' }}
        >
          {isSprinting ? 'Sprint' : 'Yuru'}
        </span>
        <span className="font-pixel text-[5px] text-zinc-600">Shift</span>
      </div>
    </PixelFrame>
  );
}

// --- Action Info ---

function ActionInfo({
  attackCooldownPct,
}: {
  attackCooldownPct: number;
}) {
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - attackCooldownPct);

  return (
    <PixelFrame className="flex flex-col items-center gap-1.5 p-2 sm:p-3">
      {/* Circular cooldown */}
      <div className="relative flex items-center justify-center">
        <svg width={40} height={40} className="rotate-[-90deg]">
          <circle cx={20} cy={20} r={radius} fill="none" stroke="#1f2937" strokeWidth={3} />
          <circle
            cx={20}
            cy={20}
            r={radius}
            fill="none"
            stroke="#8b5cf6"
            strokeWidth={3}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.1s linear' }}
          />
        </svg>
        <span className="absolute font-pixel text-[6px] text-zinc-300">⚔</span>
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <span className="font-pixel text-[5px] text-zinc-500 sm:text-[6px]">Saldırı</span>
        <span className="hidden font-pixel text-[5px] text-zinc-600 sm:block">Space</span>
      </div>
    </PixelFrame>
  );
}

// --- Ability Info ---

const ABILITY_META: Record<PlayerClass, { icon: string; label: string }> = {
  warrior: { icon: '🛡', label: 'Kalkan' },
  mage: { icon: '❄', label: 'Buz' },
  archer: { icon: '🏹', label: 'Oklar' },
} as const;

function AbilityInfo({
  abilityCooldownPct,
  abilityActive,
  playerClass,
}: {
  abilityCooldownPct: number;
  abilityActive: boolean;
  playerClass: PlayerClass;
}) {
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - abilityCooldownPct);
  const meta = ABILITY_META[playerClass];
  const isReady = abilityCooldownPct === 0 && !abilityActive;

  return (
    <PixelFrame className="flex flex-col items-center gap-1.5 p-2 sm:p-3">
      {/* Circular cooldown */}
      <div className="relative flex items-center justify-center">
        <svg width={40} height={40} className="rotate-[-90deg]">
          <circle cx={20} cy={20} r={radius} fill="none" stroke="#1f2937" strokeWidth={3} />
          <circle
            cx={20}
            cy={20}
            r={radius}
            fill="none"
            stroke={isReady ? '#10b981' : '#f59e0b'}
            strokeWidth={3}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.1s linear' }}
          />
        </svg>
        <span className="absolute font-pixel text-[6px] text-zinc-300">{meta.icon}</span>
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <span className="font-pixel text-[5px] text-zinc-500 sm:text-[6px]">{meta.label}</span>
        <span className="hidden font-pixel text-[5px] text-zinc-600 sm:block">E</span>
      </div>
    </PixelFrame>
  );
}

// --- Floor Info (Top Center) ---

function FloorInfo({
  floor,
  currentRoom,
  totalRooms,
  isBossPhase,
}: {
  floor: number;
  currentRoom: number;
  totalRooms: number;
  isBossPhase: boolean;
}) {
  return (
    <PixelFrame className="flex items-center gap-2 px-3 py-1.5 sm:gap-3 sm:px-4 sm:py-2">
      <span className="text-xs sm:text-sm">🏰</span>
      <div className="flex flex-col items-center">
        <span className="font-pixel text-[8px] text-dm-gold sm:text-[9px]">
          Kat {floor}
        </span>
        <span className="font-pixel text-[6px] text-zinc-400 sm:text-[7px]">
          Oda {currentRoom + 1}/{totalRooms}
        </span>
      </div>
      {isBossPhase && (
        <motion.span
          className="boss-pulse rounded border border-red-500/30 bg-red-950/40 px-1.5 py-0.5 font-pixel text-[7px] text-dm-health sm:text-[8px]"
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 1.2, repeat: Infinity }}
        >
          BOSS
        </motion.span>
      )}
    </PixelFrame>
  );
}

// --- Main HUD ---

type HUDProps = {
  player: PlayerState;
  gameState: GameState;
  fps: number;
  onPing?: () => void;
  attackCooldownPct?: number;
  abilityCooldownPct?: number;
  abilityActive?: boolean;
  playerClass?: PlayerClass;
  monsterKillEvents?: Array<{ monsterId: string; killerId: string; xp: number }>;
  lootPickupEvents?: Array<{ playerId: string; lootType: string; value: number }>;
};

export function HUD({ player, gameState, fps, onPing, attackCooldownPct = 1, abilityCooldownPct = 0, abilityActive = false, playerClass, monsterKillEvents, lootPickupEvents }: HUDProps) {
  const { toasts, addToast } = useToasts();
  const [killFeedEntries, setKillFeedEntries] = useState<KillFeedEntry[]>([]);
  const [hpFlash, setHpFlash] = useState(false);
  const [hoveredTeammate, setHoveredTeammate] = useState<string | null>(null);

  // Track previous values for toast triggers
  const prevLevelRef = useRef(player.level);
  const prevClearedRoomsRef = useRef(0);
  const prevHpRef = useRef(player.hp);

  const classInfo = CLASS_STATS[player.class];

  const teammates = useMemo(
    () =>
      Object.values(gameState.players).filter(
        (p) => p.id !== player.id && p.alive,
      ),
    [gameState.players, player.id],
  );

  const clearedRooms = useMemo(
    () => gameState.dungeon.rooms.filter((r) => r.cleared).length,
    [gameState.dungeon.rooms],
  );

  const xpToNextLevel = 50;
  const isBossPhase = gameState.phase === 'boss';

  // Toast: level up
  useEffect(() => {
    if (player.level > prevLevelRef.current) {
      addToast(`Seviye atladın! (Seviye ${player.level})`, '⬆️', 'success');
    }
    prevLevelRef.current = player.level;
  }, [player.level, addToast]);

  // Toast: room cleared
  useEffect(() => {
    if (clearedRooms > prevClearedRoomsRef.current && prevClearedRoomsRef.current > 0) {
      addToast('Oda temizlendi!', '✅', 'info');
    }
    prevClearedRoomsRef.current = clearedRooms;
  }, [clearedRooms, addToast]);

  // Toast + HP flash: damage taken / heal
  useEffect(() => {
    const hpDiff = player.hp - prevHpRef.current;
    if (hpDiff > 5 && prevHpRef.current > 0) {
      addToast(`Can iksiri toplandı +${Math.round(hpDiff)} HP`, '❤️', 'danger');
    }
    if (hpDiff < -1 && prevHpRef.current > 0) {
      setHpFlash(true);
      const timer = setTimeout(() => setHpFlash(false), 250);
      prevHpRef.current = player.hp;
      return () => clearTimeout(timer);
    }
    prevHpRef.current = player.hp;
  }, [player.hp, addToast]);

  const handlePing = useCallback(() => {
    addToast('Ping gönderildi!', '📍', 'warning');
    onPing?.();
  }, [addToast, onPing]);

  const handleKillFeedExpire = useCallback((id: string) => {
    setKillFeedEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  // Public method to add kill feed entries (can be called via ref or event)
  const addKillFeedEntry = useCallback(
    (playerName: string, playerClass: string, monsterName: string, xp: number) => {
      const entry = createKillFeedEntry(
        playerName,
        playerClass as 'warrior' | 'mage' | 'archer',
        monsterName,
        xp,
      );
      setKillFeedEntries((prev) => [...prev.slice(-2), entry]);
    },
    [],
  );

  // Wire monster kill events to kill feed
  const prevKillEventsLenRef = useRef(0);

  useEffect(() => {
    if (!monsterKillEvents || monsterKillEvents.length <= prevKillEventsLenRef.current) return;

    const newEvents = monsterKillEvents.slice(prevKillEventsLenRef.current);
    prevKillEventsLenRef.current = monsterKillEvents.length;

    const XP_TO_NAME: Record<number, string> = {
      5: 'Balçık',
      7: 'Yarasa',
      10: 'İskelet',
      15: 'Goblin',
      100: 'İblis Lordu',
    };

    for (const event of newEvents) {
      const killerPlayer = gameState.players[event.killerId];
      if (killerPlayer) {
        const monsterName = XP_TO_NAME[event.xp] ?? 'Canavar';
        addKillFeedEntry(
          killerPlayer.name,
          killerPlayer.class,
          monsterName,
          event.xp,
        );
      }
    }
  }, [monsterKillEvents, gameState.players, addKillFeedEntry]);

  // Wire loot pickup events to toasts
  const prevLootEventsLenRef = useRef(0);

  useEffect(() => {
    if (!lootPickupEvents || lootPickupEvents.length <= prevLootEventsLenRef.current) return;

    const newEvents = lootPickupEvents.slice(prevLootEventsLenRef.current);
    prevLootEventsLenRef.current = lootPickupEvents.length;

    for (const event of newEvents) {
      if (event.playerId !== player.id) continue;

      const lootMessages: Record<string, { text: string; icon: string; type: ToastType }> = {
        health_potion: { text: `Can İksiri +${event.value} HP`, icon: '❤️', type: 'success' },
        mana_potion: { text: `Mana İksiri +${event.value} MP`, icon: '💧', type: 'info' },
        damage_boost: { text: `Güç Artışı +${event.value} ATK`, icon: '⚔️', type: 'warning' },
        speed_boost: { text: 'Hız Artışı', icon: '💨', type: 'info' },
        gold: { text: `+${event.value} Altın`, icon: '🪙', type: 'warning' },
      };

      const msg = lootMessages[event.lootType];
      if (msg) {
        addToast(msg.text, msg.icon, msg.type);
      }
    }
  }, [lootPickupEvents, player.id, addToast]);

  return (
    <div className="pointer-events-none absolute inset-0 z-20 hud-compact game-safe-area safe-area-padding p-2 sm:p-4">
      {/* Toasts — top-right */}
      <ToastList toasts={toasts} />

      {/* Boss HP bar — center top */}
      {isBossPhase && <BossHPBar gameState={gameState} />}

      {/* Top-Center: Floor & Room Info */}
      {!isBossPhase && (
        <div className="pointer-events-none absolute left-1/2 top-2 z-30 -translate-x-1/2 sm:top-4">
          <FloorInfo
            floor={gameState.dungeon.currentFloor}
            currentRoom={gameState.currentRoomId}
            totalRooms={gameState.dungeon.rooms.length}
            isBossPhase={isBossPhase}
          />
        </div>
      )}

      {/* Top-Left: Player Stats */}
      <div className="absolute left-2 top-2 sm:left-4 sm:top-4">
        <PixelFrame className="w-44 p-2 sm:w-56 sm:p-3">
          {/* Player header */}
          <div className="mb-1.5 flex items-center gap-1.5">
            <span className="text-sm">{classInfo.emoji}</span>
            <span className="font-pixel text-[8px] text-white sm:text-[9px]">
              {player.name}
            </span>
            <span
              className="rounded px-1 py-0.5 font-pixel text-[6px] sm:text-[7px]"
              style={{
                backgroundColor: `${classInfo.color}20`,
                color: classInfo.color,
                border: `1px solid ${classInfo.color}40`,
              }}
            >
              Lv.{player.level}
            </span>
          </div>

          {/* HP Bar */}
          <div className="flex flex-col gap-1">
            <HPBar
              value={player.hp}
              max={player.maxHp}
              showNumbers={true}
              isFlashing={hpFlash}
            />
            <ManaBar
              value={player.mana}
              max={player.maxMana}
              showNumbers={true}
            />
            <XPBar
              xp={player.xp}
              xpToNext={xpToNextLevel}
              level={player.level}
            />
          </div>

          {/* Teammates */}
          {teammates.length > 0 && (
            <div className="mt-2 flex flex-col gap-1.5 border-t border-dm-border/50 pt-1.5">
              {teammates.map((mate) => {
                const mateClass = CLASS_STATS[mate.class];
                return (
                  <div
                    key={mate.id}
                    className="relative"
                    onMouseEnter={() => setHoveredTeammate(mate.id)}
                    onMouseLeave={() => setHoveredTeammate(null)}
                  >
                    <div className="mb-0.5 flex items-center gap-1">
                      <span className="text-[8px]">{mateClass.emoji}</span>
                      <span
                        className="font-pixel text-[6px]"
                        style={{ color: mateClass.color }}
                      >
                        {mate.name}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-sm border border-zinc-700/60 bg-zinc-900">
                      <motion.div
                        className="h-full rounded-sm"
                        style={{
                          background:
                            (mate.hp / mate.maxHp) > 0.3
                              ? 'linear-gradient(90deg, #22c55e, #4ade80)'
                              : 'linear-gradient(90deg, #dc2626, #ef4444)',
                        }}
                        animate={{
                          width: `${Math.max(0, Math.min((mate.hp / mate.maxHp) * 100, 100))}%`,
                        }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                    {/* Hover card */}
                    {hoveredTeammate === mate.id && (
                      <PlayerHoverCard player={mate} isVisible={true} />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Ping button */}
          {teammates.length > 0 && (
            <motion.button
              className="pointer-events-auto mt-2 w-full rounded border border-dm-border/50 bg-dm-surface/50 py-1 font-pixel text-[6px] text-dm-gold transition-colors hover:bg-dm-accent/20 sm:text-[7px]"
              onClick={handlePing}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.1 }}
            >
              📍 Ping
            </motion.button>
          )}
        </PixelFrame>
      </div>

      {/* Top-Right: Solo Lives OR Gold/Score */}
      <div className="absolute right-2 top-2 sm:right-4 sm:top-4">
        {gameState.isSolo ? (
          <PixelFrame className="flex items-center gap-2 px-3 py-2">
            <SoloLives livesRemaining={gameState.soloDeathsRemaining} />
          </PixelFrame>
        ) : (
          <PixelFrame className="p-2 sm:p-3">
            <div className="flex items-center gap-2">
              <span className="text-xs">🪙</span>
              <span className="font-pixel text-[8px] text-dm-gold sm:text-[9px]">
                {player.score * 10}
              </span>
              <span className="text-xs">💀</span>
              <span className="font-pixel text-[8px] text-white sm:text-[9px]">
                {player.score}
              </span>
            </div>
          </PixelFrame>
        )}
      </div>

      {/* Bottom-Left: Minimap */}
      <div className="absolute bottom-2 left-2 sm:bottom-4 sm:left-4">
        <Minimap
          rooms={gameState.dungeon.rooms}
          currentRoomId={gameState.currentRoomId}
          players={gameState.players}
          monsters={gameState.monsters}
          localPlayerId={player.id}
        />
      </div>

      {/* Bottom-Right: Sprint + Action Info + Ability Info */}
      <div className="absolute bottom-2 right-2 flex items-end gap-2 sm:bottom-4 sm:right-4">
        <SprintIndicator />
        {playerClass && (
          <AbilityInfo
            abilityCooldownPct={abilityCooldownPct}
            abilityActive={abilityActive}
            playerClass={playerClass}
          />
        )}
        <ActionInfo attackCooldownPct={attackCooldownPct} />
      </div>

      {/* Kill Feed — bottom center (hidden on mobile) */}
      <KillFeed entries={killFeedEntries} onExpire={handleKillFeedExpire} />

      {/* FPS counter (debug) */}
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2">
        <span className="font-pixel text-[5px] text-zinc-700">
          {fps} FPS
        </span>
      </div>

      {/* Respawn overlay */}
      {!player.alive && (
        <motion.div
          className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="rounded-lg border border-dm-health/30 bg-black/60 px-8 py-4 backdrop-blur-sm">
            <p className="text-center font-pixel text-sm text-dm-health">
              Yenildin!
            </p>
            <motion.p
              className="mt-2 text-center font-pixel text-[10px] text-zinc-400"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              Yeniden doğuluyor...
            </motion.p>
          </div>
        </motion.div>
      )}
    </div>
  );
}

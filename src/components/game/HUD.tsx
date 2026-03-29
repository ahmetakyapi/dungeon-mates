'use client';

import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { PlayerState, GameState, DungeonRoom, PlayerClass, MonsterState, TileType } from '../../../shared/types';
import { CLASS_STATS } from '../../../shared/types';
import { KillFeed, createKillFeedEntry } from './KillFeed';
import type { KillFeedEntry } from './KillFeed';
import { PlayerHoverCard } from './PlayerHoverCard';

const EASE = [0.22, 1, 0.36, 1] as const;
const TOAST_DURATION = 3000;
const MAX_TOASTS = 4;
const COMBO_WINDOW_MS = 3000;

const DIFFICULTY_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'Kolay', color: '#4ade80' },
  2: { label: 'Normal', color: '#facc15' },
  3: { label: 'Zor', color: '#f97316' },
  4: { label: 'Çok Zor', color: '#ef4444' },
} as const;

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
        className={`relative h-3.5 overflow-hidden rounded-sm border border-zinc-700/80 bg-zinc-900 sm:h-4 lg:h-4 2xl:h-5 ${
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
          <span className="absolute inset-0 flex items-center justify-center font-pixel text-[6px] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] sm:text-[7px] lg:text-[8px] xl:text-[9px] 2xl:text-[11px]">
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
  abilityReady,
}: {
  value: number;
  max: number;
  showNumbers?: boolean;
  abilityReady?: boolean;
}) {
  const percentage = Math.max(0, Math.min((value / max) * 100, 100));

  return (
    <div className="relative h-3 overflow-hidden rounded-sm border border-zinc-700/80 bg-zinc-900 sm:h-3.5 lg:h-4 2xl:h-5">
      <motion.div
        className="absolute inset-y-0 left-0 rounded-sm"
        style={{ background: 'linear-gradient(90deg, #2563eb, #3b82f6, #60a5fa)' }}
        animate={{ width: `${percentage}%` }}
        transition={{ duration: 0.3, ease: EASE }}
      />
      <div className="absolute inset-0 rounded-sm bg-gradient-to-b from-white/10 to-transparent" style={{ height: '50%' }} />
      {/* Pulse overlay when ability is ready */}
      {abilityReady && (
        <motion.div
          className="absolute inset-0 rounded-sm bg-blue-400/20"
          animate={{ opacity: [0, 0.4, 0] }}
          transition={{ duration: 1.2, repeat: Infinity }}
        />
      )}
      {showNumbers && (
        <span className="absolute inset-0 flex items-center justify-center font-pixel text-[5px] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] sm:text-[6px] lg:text-[7px] xl:text-[8px] 2xl:text-[10px]">
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
  const prevXpRef = useRef(xp);
  const [xpGain, setXpGain] = useState<{ amount: number; id: number } | null>(null);

  useEffect(() => {
    if (xp > prevXpRef.current) {
      const gained = xp - prevXpRef.current;
      setXpGain({ amount: gained, id: Date.now() });
      const timer = setTimeout(() => setXpGain(null), 1200);
      prevXpRef.current = xp;
      return () => clearTimeout(timer);
    }
    prevXpRef.current = xp;
  }, [xp]);

  return (
    <div className="relative">
      <div className="relative h-2 overflow-hidden rounded-sm border border-zinc-700/60 bg-zinc-900 sm:h-2.5 lg:h-3 2xl:h-3.5">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-sm"
          style={{ background: 'linear-gradient(90deg, #d97706, #f59e0b, #fbbf24)' }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.3, ease: EASE }}
        />
      </div>
      <p className="mt-0.5 font-pixel text-[5px] text-dm-gold/70 sm:text-[6px] lg:text-[7px] xl:text-[8px] 2xl:text-[10px]">
        Seviye {level} — {currentXP}/{xpToNext} XP
      </p>
      {/* Floating +XP text */}
      <AnimatePresence>
        {xpGain && (
          <motion.span
            key={xpGain.id}
            className="absolute -right-1 -top-1 font-pixel text-[8px] text-dm-gold sm:text-[9px] lg:text-[10px] 2xl:text-[12px]"
            initial={{ opacity: 1, y: 0 }}
            animate={{ opacity: 0, y: -16 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1, ease: EASE }}
          >
            +{xpGain.amount} XP
          </motion.span>
        )}
      </AnimatePresence>
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
              className="font-pixel text-[7px] sm:text-[8px] lg:text-[9px] xl:text-[10px] 2xl:text-[12px]"
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
          <span className="boss-pulse font-pixel text-[9px] text-dm-health sm:text-[11px] lg:text-[12px] xl:text-[13px] 2xl:text-[15px]">
            Yozlaşmış Kral Mor'Khan
          </span>
          <span className="text-xs sm:text-sm">💀</span>
        </div>

        {/* HP Bar */}
        <div className="relative h-5 overflow-hidden rounded-sm border border-red-900/60 bg-zinc-900 sm:h-6 lg:h-7 2xl:h-8">
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
            <span className="font-pixel text-[7px] text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] sm:text-[8px] lg:text-[9px] xl:text-[10px] 2xl:text-[12px]">
              {Math.ceil(boss.hp)}/{boss.maxHp}
            </span>
            <span className="font-pixel text-[6px] text-red-300/60 sm:text-[7px] lg:text-[8px] xl:text-[9px] 2xl:text-[11px]">
              ({Math.round(percentage)}%)
            </span>
          </div>
        </div>
      </PixelFrame>
    </motion.div>
  );
}

// --- Minimap ---

/** Per-room monster count from live monster data */
function useRoomMonsterCounts(rooms: DungeonRoom[], monsters: Record<string, MonsterState>) {
  return useMemo(() => {
    const counts = new Map<number, number>();
    for (const room of rooms) {
      let alive = 0;
      for (const mId of room.monsterIds) {
        if (monsters[mId]?.alive) alive++;
      }
      counts.set(room.id, alive);
    }
    return counts;
  }, [rooms, monsters]);
}

/** Find loot positions grouped by room bounds */
function useRoomHasLoot(rooms: DungeonRoom[], loot: Record<string, { position: { x: number; y: number } }>) {
  return useMemo(() => {
    const set = new Set<number>();
    const lootArr = Object.values(loot);
    for (const room of rooms) {
      for (const l of lootArr) {
        if (
          l.position.x >= room.x && l.position.x < room.x + room.width &&
          l.position.y >= room.y && l.position.y < room.y + room.height
        ) {
          set.add(room.id);
          break;
        }
      }
    }
    return set;
  }, [rooms, loot]);
}

function MinimapRoom({
  room,
  isCurrent,
  monsterCount,
  hasLoot,
  bx,
  by,
  expanded,
}: {
  room: DungeonRoom;
  isCurrent: boolean;
  monsterCount: number;
  hasLoot: boolean;
  bx: number;
  by: number;
  expanded: boolean;
}) {
  const rx = room.x - bx;
  const ry = room.y - by;
  const cx = room.centerX - bx;
  const cy = room.centerY - by;

  // Room fill & style
  let fill: string;
  let opacity: number;
  let cssClass = '';

  if (isCurrent) {
    fill = '#f59e0b';
    opacity = 0.85;
  } else if (room.cleared) {
    fill = '#22c55e';
    opacity = 0.5;
  } else if (room.isBossRoom) {
    fill = '#dc2626';
    opacity = 0.7;
    cssClass = 'minimap-boss-glow';
  } else {
    fill = '#b91c1c';
    opacity = 0.5;
    cssClass = 'minimap-danger-pulse';
  }

  return (
    <g>
      {/* Room background */}
      <rect
        x={rx}
        y={ry}
        width={room.width}
        height={room.height}
        fill={fill}
        opacity={opacity}
        rx={1}
        className={cssClass}
      />

      {/* Current room golden border */}
      {isCurrent && (
        <rect
          x={rx - 0.3}
          y={ry - 0.3}
          width={room.width + 0.6}
          height={room.height + 0.6}
          fill="none"
          stroke="#fbbf24"
          strokeWidth={0.8}
          rx={1.2}
          className="minimap-current-border"
        />
      )}

      {/* Boss room: skull + outer glow ring */}
      {room.isBossRoom && (
        <>
          <circle cx={cx} cy={cy} r={Math.min(room.width, room.height) * 0.35} fill="none" stroke="#ef4444" strokeWidth={0.4} opacity={0.5} className="minimap-boss-glow" />
          <text x={cx} y={cy + 1.5} textAnchor="middle" fontSize={4} fill="#ffffff" opacity={0.95}>☠</text>
        </>
      )}

      {/* Cleared room: checkmark */}
      {room.cleared && !room.isBossRoom && (
        <text x={cx} y={cy + 1.2} textAnchor="middle" fontSize={expanded ? 3.5 : 3} fill="#ffffff" opacity={0.85}>✓</text>
      )}

      {/* Uncleared non-current: monster count or "!" */}
      {!room.cleared && !room.isBossRoom && !isCurrent && (
        <text x={cx} y={cy + 1.2} textAnchor="middle" fontSize={expanded ? 3.5 : 2.8} fill="#fbbf24" opacity={0.9} fontWeight="bold">
          {monsterCount > 0 ? monsterCount : '!'}
        </text>
      )}

      {/* Current room: show monster count if enemies remain */}
      {isCurrent && !room.isBossRoom && monsterCount > 0 && (
        <text x={cx} y={cy + 1.2} textAnchor="middle" fontSize={expanded ? 3.5 : 2.8} fill="#ffffff" opacity={0.9} fontWeight="bold">
          {monsterCount}
        </text>
      )}

      {/* Loot indicator: small gold dot */}
      {hasLoot && !room.isBossRoom && (
        <circle cx={rx + room.width - 1.5} cy={ry + 1.5} r={0.8} fill="#eab308" opacity={0.85} />
      )}
    </g>
  );
}

function MinimapStairs({ sx, sy, bx, by }: { sx: number; sy: number; bx: number; by: number }) {
  const x = sx - bx;
  const y = sy - by;
  return (
    <g>
      {/* Beacon ring (expanding pulse) */}
      <circle cx={x} cy={y} r={2} fill="none" stroke="#3b82f6" strokeWidth={0.5} className="minimap-stairs-beacon" />
      {/* Solid center dot */}
      <circle cx={x} cy={y} r={1.5} fill="#3b82f6" opacity={0.95} className="minimap-blink" />
      {/* Down arrow label */}
      <text x={x} y={y - 2.8} textAnchor="middle" fontSize={3} fill="#93c5fd" opacity={0.95}>⬇</text>
    </g>
  );
}

function MinimapLegend({ expanded, allCleared, currentFloor, maxFloors }: { expanded: boolean; allCleared: boolean; currentFloor: number; maxFloors: number }) {
  if (!expanded) return null;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
      <span className="font-pixel text-[5px] text-zinc-400 sm:text-[6px] lg:text-[7px]">
        Kat {currentFloor}/{maxFloors}
      </span>
      <span className="flex items-center gap-0.5">
        <span className="inline-block h-1.5 w-1.5 rounded-sm bg-amber-500" />
        <span className="font-pixel text-[5px] text-zinc-500 sm:text-[6px]">Aktif</span>
      </span>
      <span className="flex items-center gap-0.5">
        <span className="inline-block h-1.5 w-1.5 rounded-sm bg-green-500" />
        <span className="font-pixel text-[5px] text-zinc-500 sm:text-[6px]">Temiz</span>
      </span>
      <span className="flex items-center gap-0.5">
        <span className="inline-block h-1.5 w-1.5 rounded-sm bg-red-700" />
        <span className="font-pixel text-[5px] text-zinc-500 sm:text-[6px]">Düşman</span>
      </span>
      {allCleared && (
        <span className="flex items-center gap-0.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500" />
          <span className="font-pixel text-[5px] text-zinc-500 sm:text-[6px]">Merdiven</span>
        </span>
      )}
    </div>
  );
}

function Minimap({
  rooms,
  currentRoomId,
  players,
  monsters,
  loot,
  localPlayerId,
  tiles,
  currentFloor,
  maxFloors,
}: {
  rooms: DungeonRoom[];
  currentRoomId: number;
  players: Record<string, PlayerState>;
  monsters: Record<string, MonsterState>;
  loot: Record<string, { position: { x: number; y: number } }>;
  localPlayerId: string;
  tiles?: TileType[][];
  currentFloor: number;
  maxFloors: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [screenTier, setScreenTier] = useState(0);

  useEffect(() => {
    const check = () => {
      const w = window.innerWidth;
      if (w >= 1536) setScreenTier(4);
      else if (w >= 1280) setScreenTier(3);
      else if (w >= 1024) setScreenTier(2);
      else if (w >= 640) setScreenTier(1);
      else setScreenTier(0);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const sizeByTier = [120, 130, 150, 170, 190] as const;
  const expandedSizeByTier = [180, 220, 250, 280, 310] as const;
  const size = expanded ? expandedSizeByTier[screenTier] : sizeByTier[screenTier];
  const mobileSize = expanded ? 180 : 90;

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const toggleExpand = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  const roomMonsterCounts = useRoomMonsterCounts(rooms, monsters);
  const roomHasLoot = useRoomHasLoot(rooms, loot);

  // Calculate bounds with padding
  const bounds = useMemo(() => {
    if (rooms.length === 0) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const room of rooms) {
      minX = Math.min(minX, room.x);
      minY = Math.min(minY, room.y);
      maxX = Math.max(maxX, room.x + room.width);
      maxY = Math.max(maxY, room.y + room.height);
    }
    const pad = 2;
    return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
  }, [rooms]);

  const rangeX = bounds.maxX - bounds.minX || 1;
  const rangeY = bounds.maxY - bounds.minY || 1;

  // Corridor connections
  const connections = useMemo(() => {
    const conns: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
    for (let i = 0; i < rooms.length; i++) {
      for (let j = i + 1; j < rooms.length; j++) {
        const a = rooms[i];
        const b = rooms[j];
        const dist = Math.sqrt(
          Math.pow(a.centerX - b.centerX, 2) + Math.pow(a.centerY - b.centerY, 2),
        );
        if (dist < 25) {
          conns.push({ x1: a.centerX, y1: a.centerY, x2: b.centerX, y2: b.centerY });
        }
      }
    }
    return conns;
  }, [rooms]);

  // Check if all non-boss, non-start rooms are cleared
  const allCleared = useMemo(() => {
    const normalRooms = rooms.filter((r) => !r.isBossRoom && !r.isStartRoom);
    return normalRooms.length > 0 && normalRooms.every((r) => r.cleared);
  }, [rooms]);

  // Find stairs position when all rooms cleared
  const stairsPosition = useMemo(() => {
    if (!allCleared || !tiles || tiles.length === 0) return null;
    for (let y = 0; y < tiles.length; y++) {
      for (let x = 0; x < tiles[y].length; x++) {
        if (tiles[y][x] === 'stairs') return { x, y };
      }
    }
    return null;
  }, [allCleared, tiles]);

  // Local player class for dot color
  const localPlayer = players[localPlayerId];

  return (
    <PixelFrame className="cursor-pointer p-1.5 sm:p-2">
      <div className="mb-1 flex items-center justify-between" onClick={toggleExpand}>
        <span className="font-pixel text-[6px] text-zinc-500 sm:text-[7px] lg:text-[8px] xl:text-[9px] 2xl:text-[11px]">
          Harita {expanded ? '' : `(${currentFloor}/${maxFloors})`}
        </span>
        <span className="font-pixel text-[5px] text-zinc-600 sm:text-[6px] lg:text-[7px] xl:text-[8px] 2xl:text-[10px]">
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
          {/* SVG defs for glow filters */}
          <defs>
            <filter id="mm-glow-gold" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="1" result="blur" />
              <feFlood floodColor="#fbbf24" floodOpacity="0.4" result="color" />
              <feComposite in="color" in2="blur" operator="in" />
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="mm-glow-blue" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="1.2" result="blur" />
              <feFlood floodColor="#3b82f6" floodOpacity="0.5" result="color" />
              <feComposite in="color" in2="blur" operator="in" />
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="mm-glow-red" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="1" result="blur" />
              <feFlood floodColor="#ef4444" floodOpacity="0.4" result="color" />
              <feComposite in="color" in2="blur" operator="in" />
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Corridor connections — gradient lines */}
          {connections.map((c, i) => (
            <line
              key={`conn_${i}`}
              x1={c.x1 - bounds.minX}
              y1={c.y1 - bounds.minY}
              x2={c.x2 - bounds.minX}
              y2={c.y2 - bounds.minY}
              stroke="#4b5563"
              strokeWidth={0.6}
              strokeDasharray="1 0.5"
              opacity={0.6}
            />
          ))}

          {/* Room rectangles */}
          {rooms.map((room) => (
            <MinimapRoom
              key={room.id}
              room={room}
              isCurrent={room.id === currentRoomId}
              monsterCount={roomMonsterCounts.get(room.id) ?? 0}
              hasLoot={roomHasLoot.has(room.id)}
              bx={bounds.minX}
              by={bounds.minY}
              expanded={expanded}
            />
          ))}

          {/* Stairs beacon when all cleared */}
          {stairsPosition && (
            <g filter="url(#mm-glow-blue)">
              <MinimapStairs sx={stairsPosition.x} sy={stairsPosition.y} bx={bounds.minX} by={bounds.minY} />
            </g>
          )}

          {/* Alive monsters — small red dots */}
          {Object.values(monsters).filter((m) => m.alive).map((monster) => (
            <circle
              key={`mm_${monster.id}`}
              cx={monster.position.x - bounds.minX}
              cy={monster.position.y - bounds.minY}
              r={0.6}
              fill="#ef4444"
              opacity={0.8}
              className="minimap-enemy-pulse"
            />
          ))}

          {/* Teammate dots — class-colored */}
          {Object.values(players).filter((p) => p.id !== localPlayerId && p.alive).map((mate) => {
            const mateColor = CLASS_STATS[mate.class]?.color ?? '#4ade80';
            return (
              <circle
                key={`mt_${mate.id}`}
                cx={mate.position.x - bounds.minX}
                cy={mate.position.y - bounds.minY}
                r={1.0}
                fill={mateColor}
                opacity={0.9}
              />
            );
          })}

          {/* Local player dot — class-colored with white ring, blinking */}
          {localPlayer?.alive && (
            <g filter="url(#mm-glow-gold)">
              <circle
                cx={localPlayer.position.x - bounds.minX}
                cy={localPlayer.position.y - bounds.minY}
                r={1.4}
                fill="none"
                stroke="#ffffff"
                strokeWidth={0.4}
                opacity={0.6}
              />
              <circle
                cx={localPlayer.position.x - bounds.minX}
                cy={localPlayer.position.y - bounds.minY}
                r={1.0}
                fill={CLASS_STATS[localPlayer.class]?.color ?? '#ffffff'}
                className="minimap-blink"
              />
            </g>
          )}
        </svg>
      </motion.div>
      <MinimapLegend expanded={expanded} allCleared={allCleared} currentFloor={currentFloor} maxFloors={maxFloors} />
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
        className="h-2.5 w-2.5 rounded-full sm:h-3 sm:w-3 lg:h-3.5 lg:w-3.5 2xl:h-4 2xl:w-4"
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
          className="font-pixel text-[6px] sm:text-[7px] lg:text-[8px] xl:text-[9px] 2xl:text-[11px]"
          style={{ color: isSprinting ? '#f59e0b' : '#71717a' }}
        >
          {isSprinting ? 'Sprint' : 'Yürü'}
        </span>
        <span className="font-pixel text-[5px] text-zinc-600 sm:text-[6px] lg:text-[7px] xl:text-[8px] 2xl:text-[10px]">Shift</span>
      </div>
    </PixelFrame>
  );
}

// --- Action Info ---

const ACTION_ICONS: Record<PlayerClass, string> = {
  warrior: '⚔',
  mage: '🔮',
  archer: '🏹',
} as const;

function ActionInfo({
  attackCooldownPct,
  playerClass,
}: {
  attackCooldownPct: number;
  playerClass?: PlayerClass;
}) {
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - attackCooldownPct);

  return (
    <PixelFrame className="flex flex-col items-center gap-1.5 p-2 sm:p-3">
      {/* Circular cooldown */}
      <div className="relative flex items-center justify-center">
        <svg viewBox="0 0 40 40" className="h-10 w-10 rotate-[-90deg] lg:h-12 lg:w-12 2xl:h-14 2xl:w-14">
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
        <span className="absolute font-pixel text-[6px] text-zinc-300 lg:text-[7px] 2xl:text-[9px]">{ACTION_ICONS[playerClass ?? 'warrior']}</span>
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <span className="font-pixel text-[5px] text-zinc-500 sm:text-[6px] lg:text-[7px] xl:text-[8px] 2xl:text-[10px]">Saldırı</span>
        <span className="hidden font-pixel text-[5px] text-zinc-600 sm:block sm:text-[6px] lg:text-[7px] xl:text-[8px] 2xl:text-[10px]">Space</span>
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
    <motion.div
      animate={isReady ? { scale: [1, 1.08, 1] } : { scale: 1 }}
      transition={isReady ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' } : {}}
    >
      <PixelFrame className="flex flex-col items-center gap-1.5 p-2 sm:p-3">
        {/* Circular cooldown */}
        <div className="relative flex items-center justify-center">
          <svg viewBox="0 0 40 40" className="h-10 w-10 rotate-[-90deg] lg:h-12 lg:w-12 2xl:h-14 2xl:w-14">
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
          <span className="absolute font-pixel text-[6px] text-zinc-300 lg:text-[7px] 2xl:text-[9px]">{meta.icon}</span>
          {/* Ready glow */}
          {isReady && (
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{ boxShadow: '0 0 12px rgba(16, 185, 129, 0.5)' }}
              animate={{ opacity: [0.4, 0.8, 0.4] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            />
          )}
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <span
            className="font-pixel text-[5px] sm:text-[6px] lg:text-[7px] xl:text-[8px] 2xl:text-[10px]"
            style={{ color: isReady ? '#10b981' : '#71717a' }}
          >
            {isReady ? 'Hazir!' : meta.label}
          </span>
          <span className="hidden font-pixel text-[5px] text-zinc-600 sm:block sm:text-[6px] lg:text-[7px] xl:text-[8px] 2xl:text-[10px]">E</span>
        </div>
      </PixelFrame>
    </motion.div>
  );
}

// --- Floor Info (Top Center) ---

function FloorInfo({
  floor,
  currentRoom,
  totalRooms,
  isBossPhase,
  monstersInRoom,
  playerCount,
}: {
  floor: number;
  currentRoom: number;
  totalRooms: number;
  isBossPhase: boolean;
  monstersInRoom: number;
  playerCount: number;
}) {
  const difficulty = DIFFICULTY_LABELS[Math.min(playerCount, 4)] ?? DIFFICULTY_LABELS[1];

  return (
    <PixelFrame className="flex flex-col items-center gap-1 px-3 py-1.5 sm:gap-1.5 sm:px-4 sm:py-2">
      {/* Floor progress bar */}
      <div className="flex w-full items-center gap-2">
        <span className="text-xs sm:text-sm">🏰</span>
        <div className="flex flex-1 flex-col items-center">
          <span className="font-pixel text-[9px] text-dm-gold sm:text-[10px] lg:text-[11px] xl:text-[12px] 2xl:text-[14px]">
            Kat {floor}/5
          </span>
          {/* Floor dots */}
          <div className="mt-0.5 flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <motion.div
                key={i}
                className="h-1.5 w-1.5 rounded-full sm:h-2 sm:w-2"
                style={{
                  backgroundColor: i < floor ? '#f59e0b' : i === floor - 1 ? '#f59e0b' : '#3f3f46',
                }}
                animate={i === floor - 1 ? { scale: [1, 1.3, 1] } : {}}
                transition={i === floor - 1 ? { duration: 1.5, repeat: Infinity } : {}}
              />
            ))}
          </div>
        </div>
        {isBossPhase && (
          <motion.span
            className="boss-pulse rounded border border-red-500/30 bg-red-950/40 px-1.5 py-0.5 font-pixel text-[7px] text-dm-health sm:text-[8px] lg:text-[9px] xl:text-[10px] 2xl:text-[12px]"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          >
            BOSS
          </motion.span>
        )}
      </div>
      {/* Room + monsters info */}
      <div className="flex items-center gap-2">
        <span className="font-pixel text-[6px] text-zinc-400 sm:text-[7px] lg:text-[8px] xl:text-[9px] 2xl:text-[11px]">
          Oda {currentRoom + 1}/{totalRooms}
        </span>
        {monstersInRoom > 0 && (
          <span className="font-pixel text-[6px] text-dm-health sm:text-[7px] lg:text-[8px] xl:text-[9px] 2xl:text-[11px]">
            — {monstersInRoom} canavar kaldi
          </span>
        )}
        {monstersInRoom === 0 && !isBossPhase && (
          <span className="font-pixel text-[6px] text-emerald-400 sm:text-[7px] lg:text-[8px] xl:text-[9px] 2xl:text-[11px]">
            — Temiz
          </span>
        )}
      </div>
      {/* Player count + difficulty */}
      {playerCount > 1 && (
        <div className="flex items-center gap-1.5">
          <span className="font-pixel text-[5px] sm:text-[6px] lg:text-[7px] xl:text-[8px] 2xl:text-[10px]" style={{ color: difficulty.color }}>
            {playerCount} Oyuncu — {difficulty.label}
          </span>
        </div>
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
  const [comboCount, setComboCount] = useState(0);
  const comboTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showLevelUpOverlay, setShowLevelUpOverlay] = useState(false);
  const [lastKillerMonster, setLastKillerMonster] = useState<string | null>(null);
  const [respawnCountdown, setRespawnCountdown] = useState(0);
  const wasAliveRef = useRef(player.alive);

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

  const isAbilityReady = abilityCooldownPct === 0 && !abilityActive;

  // Combo counter from kill events
  useEffect(() => {
    if (!monsterKillEvents || monsterKillEvents.length === 0) return;
    // On new kill event, increment combo and reset timer
    setComboCount((prev) => prev + 1);
    if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
    comboTimerRef.current = setTimeout(() => setComboCount(0), COMBO_WINDOW_MS);
  }, [monsterKillEvents?.length]);

  // Clear combo timer on unmount
  useEffect(() => {
    return () => {
      if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
    };
  }, []);

  // Level up celebration overlay
  useEffect(() => {
    if (player.level > prevLevelRef.current && prevLevelRef.current > 0) {
      setShowLevelUpOverlay(true);
      const timer = setTimeout(() => setShowLevelUpOverlay(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [player.level]);

  // Death tracking — figure out what killed the player
  useEffect(() => {
    if (!player.alive && wasAliveRef.current) {
      // Player just died, try to find nearest monster
      const aliveMonsters = Object.values(gameState.monsters).filter((m) => m.alive);
      if (aliveMonsters.length > 0) {
        const nearest = aliveMonsters.reduce((closest, m) => {
          const dist = Math.sqrt(
            Math.pow(m.position.x - player.position.x, 2) +
            Math.pow(m.position.y - player.position.y, 2),
          );
          const closestDist = Math.sqrt(
            Math.pow(closest.position.x - player.position.x, 2) +
            Math.pow(closest.position.y - player.position.y, 2),
          );
          return dist < closestDist ? m : closest;
        });
        const XP_TO_NAME: Record<number, string> = {
          5: 'Balçık', 7: 'Yarasa', 10: 'İskelet', 15: 'Goblin', 18: 'Lav Balçığı', 20: 'Gargoil', 25: 'Fantom', 30: 'Kara Şövalye', 80: 'Örümcek Kraliçe', 100: 'Mor\'Khan',
        };
        const monsterXp = nearest.maxHp <= 20 ? 5 : nearest.maxHp <= 30 ? 7 : nearest.maxHp <= 50 ? 10 : nearest.maxHp <= 60 ? 15 : 100;
        setLastKillerMonster(XP_TO_NAME[monsterXp] ?? 'Canavar');
      }
      setRespawnCountdown(5);
    }
    wasAliveRef.current = player.alive;
  }, [player.alive, gameState.monsters, player.position.x, player.position.y]);

  // Respawn countdown timer
  useEffect(() => {
    if (respawnCountdown <= 0) return;
    const timer = setTimeout(() => setRespawnCountdown((prev) => Math.max(0, prev - 1)), 1000);
    return () => clearTimeout(timer);
  }, [respawnCountdown]);

  // Monsters in current room
  const monstersInCurrentRoom = useMemo(() => {
    const currentRoom = gameState.dungeon.rooms.find((r) => r.id === gameState.currentRoomId);
    if (!currentRoom) return 0;
    return currentRoom.monsterIds.filter((id) => gameState.monsters[id]?.alive).length;
  }, [gameState.dungeon.rooms, gameState.currentRoomId, gameState.monsters]);

  const playerCount = useMemo(() => Object.keys(gameState.players).length, [gameState.players]);

  // Toast: level up
  useEffect(() => {
    if (player.level > prevLevelRef.current) {
      addToast(`Seviye atladin! (Seviye ${player.level})`, '⬆️', 'success');
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
      18: 'Lav Balçığı',
      20: 'Gargoil',
      25: 'Fantom',
      30: 'Kara Şövalye',
      80: 'Örümcek Kraliçe',
      100: 'Mor\'Khan',
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
            monstersInRoom={monstersInCurrentRoom}
            playerCount={playerCount}
          />
        </div>
      )}

      {/* Top-Left: Player Stats */}
      <div className="absolute left-2 top-2 sm:left-4 sm:top-4">
        <PixelFrame className="w-44 p-2 sm:w-56 sm:p-3 lg:w-60 xl:w-64 2xl:w-72 2xl:p-4">
          {/* Player header */}
          <div className="mb-1.5 flex items-center gap-1.5">
            <span className="text-sm">{classInfo.emoji}</span>
            <span className="font-pixel text-[8px] text-white sm:text-[9px] lg:text-[10px] xl:text-[11px] 2xl:text-[13px]">
              {player.name}
            </span>
            <span
              className="rounded px-1 py-0.5 font-pixel text-[6px] sm:text-[7px] lg:text-[8px] xl:text-[9px] 2xl:text-[11px]"
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
              abilityReady={isAbilityReady}
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
                      <span className="text-[8px] lg:text-[9px] 2xl:text-[11px]">{mateClass.emoji}</span>
                      <span
                        className="font-pixel text-[6px] sm:text-[7px] lg:text-[8px] xl:text-[9px] 2xl:text-[11px]"
                        style={{ color: mateClass.color }}
                      >
                        {mate.name}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-sm border border-zinc-700/60 bg-zinc-900 sm:h-2.5 lg:h-3 2xl:h-3.5">
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
              className="pointer-events-auto mt-2 w-full rounded border border-dm-border/50 bg-dm-surface/50 py-1 font-pixel text-[6px] text-dm-gold transition-colors hover:bg-dm-accent/20 sm:text-[7px] lg:text-[8px] xl:text-[9px] 2xl:text-[11px]"
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
            <span className="font-pixel text-[8px] text-zinc-400 sm:text-[9px] lg:text-[10px]">Can:</span>
            <span className="font-pixel text-[9px] text-dm-health sm:text-[10px] lg:text-[11px]">
              {gameState.soloDeathsRemaining}/3
            </span>
            <span className="mx-1 text-[6px] text-zinc-600">|</span>
            <span className="text-xs">🪙</span>
            <span className="font-pixel text-[8px] text-dm-gold sm:text-[9px] lg:text-[10px]">
              {player.score * 10}
            </span>
          </PixelFrame>
        ) : (
          <PixelFrame className="p-2 sm:p-3">
            <div className="flex items-center gap-2">
              <span className="text-xs">🪙</span>
              <span className="font-pixel text-[8px] text-dm-gold sm:text-[9px] lg:text-[10px] xl:text-[11px] 2xl:text-[13px]">
                {player.score * 10}
              </span>
              <span className="text-xs">💀</span>
              <span className="font-pixel text-[8px] text-white sm:text-[9px] lg:text-[10px] xl:text-[11px] 2xl:text-[13px]">
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
          loot={gameState.loot}
          localPlayerId={player.id}
          tiles={gameState.dungeon.tiles}
          currentFloor={gameState.dungeon.currentFloor}
          maxFloors={5}
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
        <ActionInfo attackCooldownPct={attackCooldownPct} playerClass={playerClass} />
      </div>

      {/* Kill Feed — bottom center (hidden on mobile) */}
      <KillFeed entries={killFeedEntries} onExpire={handleKillFeedExpire} />

      {/* FPS counter (debug) */}
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2">
        <span className="font-pixel text-[5px] text-zinc-700 sm:text-[6px] lg:text-[7px] xl:text-[8px] 2xl:text-[10px]">
          {fps} FPS
        </span>
      </div>

      {/* Combo counter */}
      <AnimatePresence>
        {comboCount >= 2 && (
          <motion.div
            className="pointer-events-none absolute right-16 top-1/3 z-30 sm:right-24"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.5, opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
          >
            <motion.div
              className="flex flex-col items-center"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 0.4, repeat: Infinity }}
            >
              <span className="font-pixel text-xl text-dm-gold sm:text-2xl lg:text-3xl 2xl:text-4xl" style={{ textShadow: '0 0 12px rgba(245, 158, 11, 0.6)' }}>
                {comboCount}x
              </span>
              <span className="font-pixel text-[8px] text-dm-gold/80 sm:text-[9px] lg:text-[10px] 2xl:text-[12px]">
                KOMBO!
              </span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Level up celebration overlay */}
      <AnimatePresence>
        {showLevelUpOverlay && (
          <motion.div
            className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              className="flex flex-col items-center gap-2 rounded-lg border border-dm-gold/40 bg-black/50 px-8 py-4 backdrop-blur-sm"
              initial={{ scale: 0.5, y: 20 }}
              animate={{ scale: [0.5, 1.1, 1], y: [20, -10, 0] }}
              exit={{ scale: 0.8, y: -30, opacity: 0 }}
              transition={{ duration: 0.5, ease: EASE }}
            >
              <motion.span
                className="text-3xl sm:text-4xl"
                animate={{ rotate: [0, -15, 15, 0], scale: [1, 1.2, 1] }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                ⬆️
              </motion.span>
              <span className="font-pixel text-lg text-dm-gold sm:text-xl lg:text-2xl 2xl:text-3xl" style={{ textShadow: '0 0 16px rgba(245, 158, 11, 0.5)' }}>
                Seviye {player.level}!
              </span>
              <span className="font-pixel text-[9px] text-zinc-400 sm:text-[10px] lg:text-[11px] 2xl:text-[13px]">
                Guclerin artti!
              </span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Respawn overlay with death recap */}
      {!player.alive && (
        <motion.div
          className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dm-health/30 bg-black/70 px-8 py-5 backdrop-blur-sm">
            <motion.span
              className="text-3xl"
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ duration: 0.4, ease: EASE }}
            >
              💀
            </motion.span>
            <p className="text-center font-pixel text-sm text-dm-health sm:text-base 2xl:text-lg">
              Yenildin!
            </p>
            {lastKillerMonster && (
              <p className="text-center font-pixel text-[9px] text-zinc-400 sm:text-[10px] lg:text-[11px] 2xl:text-[13px]">
                {lastKillerMonster} tarafından öldürüldün
              </p>
            )}
            <div className="flex flex-col items-center gap-1">
              {respawnCountdown > 0 && (
                <motion.span
                  className="font-pixel text-2xl text-dm-gold sm:text-3xl"
                  key={respawnCountdown}
                  initial={{ scale: 1.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  {respawnCountdown}
                </motion.span>
              )}
              <motion.p
                className="text-center font-pixel text-[10px] text-zinc-400 sm:text-xs lg:text-sm 2xl:text-base"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                Yeniden doguluyor...
              </motion.p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

'use client';

import { useMemo, useState, useCallback, useEffect, useRef, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { PlayerState, GameState, DungeonRoom, PlayerClass, MonsterState, TileType, FloorModifier } from '../../../shared/types';
import { CLASS_STATS, DIFFICULTY_INFO, xpForLevel, totalXpForLevel } from '../../../shared/types';
import { KillFeed, createKillFeedEntry } from './KillFeed';
import type { KillFeedEntry } from './KillFeed';
import { PlayerHoverCard } from './PlayerHoverCard';
import { DebuffBar } from './hud/DebuffBar';

const EASE = [0.22, 1, 0.36, 1] as const;
const TOAST_DURATION = 3000;

const MODIFIER_EMOJI: Record<string, string> = {
  reduced_healing: '💔',
  darkness: '🌑',
  haste_monsters: '⚡',
  fragile: '🩸',
  drought: '🏜️',
  burning_ground: '🔥',
};
const MODIFIER_COLOR: Record<string, string> = {
  reduced_healing: '#f87171',
  darkness: '#a78bfa',
  haste_monsters: '#facc15',
  fragile: '#fb923c',
  drought: '#60a5fa',
  burning_ground: '#ef4444',
};
const MAX_TOASTS = 4;
const COMBO_WINDOW_MS = 3000;

// DIFFICULTY_INFO imported from shared/types

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
  | { type: 'monster_killed'; playerName: string; playerClass: string; monsterName: string; xp: number };

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
  const isCritical = percentage < 10 && percentage > 0;

  // Delayed damage ghost bar (Dark Souls style)
  const prevPercentRef = useRef(percentage);
  const [ghostPercent, setGhostPercent] = useState(percentage);

  useEffect(() => {
    if (percentage < prevPercentRef.current) {
      // Took damage: show ghost bar at previous level, then shrink after delay
      setGhostPercent(prevPercentRef.current);
      const timer = setTimeout(() => setGhostPercent(percentage), 600);
      prevPercentRef.current = percentage;
      return () => clearTimeout(timer);
    }
    prevPercentRef.current = percentage;
    setGhostPercent(percentage);
  }, [percentage]);

  // Gradient: green -> yellow -> orange -> red based on percentage
  const gradientColor = useMemo(() => {
    if (percentage > 60) return 'linear-gradient(90deg, #22c55e, #4ade80)';
    if (percentage > 30) return 'linear-gradient(90deg, #eab308, #facc15)';
    if (percentage > 10) return 'linear-gradient(90deg, #dc2626, #ef4444)';
    return 'linear-gradient(90deg, #991b1b, #dc2626)';
  }, [percentage]);

  return (
    <div className={`relative ${isLow ? 'low-hp-pulse' : ''}`}>
      <div
        className={`relative h-4 overflow-hidden rounded-sm border border-zinc-700/80 bg-zinc-900 sm:h-4 lg:h-4 2xl:h-5 ${
          isFlashing ? 'hp-flash' : ''
        } ${isCritical ? 'animate-pulse' : ''}`}
      >
        {/* Ghost bar (delayed damage feedback) */}
        {ghostPercent > percentage && (
          <motion.div
            className="absolute inset-y-0 left-0 rounded-sm bg-red-400/40"
            animate={{ width: `${ghostPercent}%` }}
            transition={{ duration: 0.8, ease: EASE }}
          />
        )}
        <motion.div
          className="absolute inset-y-0 left-0 rounded-sm"
          style={{ background: gradientColor }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.3, ease: EASE }}
        />
        {/* Shine overlay */}
        <div className="absolute inset-0 rounded-sm bg-gradient-to-b from-white/10 to-transparent" style={{ height: '50%' }} />
        {/* Segment markers for easier HP reading */}
        {max > 50 && (
          <div className="absolute inset-0">
            {[25, 50, 75].map(seg => (
              <div key={seg} className="absolute inset-y-0 w-px bg-black/20" style={{ left: `${seg}%` }} />
            ))}
          </div>
        )}
        {showNumbers && (
          <span className="absolute inset-0 flex items-center justify-center font-pixel text-[7px] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] sm:text-[7px] lg:text-[8px] xl:text-[9px] 2xl:text-[11px]">
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
    <div className="relative h-3.5 overflow-hidden rounded-sm border border-zinc-700/80 bg-zinc-900 sm:h-3.5 lg:h-4 2xl:h-5">
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
        <span className="absolute inset-0 flex items-center justify-center font-pixel text-[6px] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] sm:text-[6px] lg:text-[7px] xl:text-[8px] 2xl:text-[10px]">
          {Math.ceil(value)}/{max} MP
        </span>
      )}
    </div>
  );
}

function XPBar({
  xp,
  xpToNext,
  xpProgress,
  level,
}: {
  xp: number;
  xpToNext: number;
  xpProgress: number;
  level: number;
}) {
  const currentXP = xpProgress;
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
    <div className="pointer-events-none absolute right-2 top-10 z-30 flex flex-col items-end gap-1.5 sm:right-4 sm:top-16 sm:gap-2">
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

const BOSS_DISPLAY_NAMES: Record<string, { name: string; emoji: string }> = {
  boss_demon: { name: 'Yozlaşmış Kral Karanmir', emoji: '👑' },
  boss_spider_queen: { name: 'Selvira — Dokumacı', emoji: '🕸️' },
  boss_forge_guardian: { name: 'Demirci Koruyucu', emoji: '🔨' },
  boss_stone_warden: { name: 'Taş Muhafız', emoji: '🗿' },
  boss_flame_knight: { name: 'Alev Şövalyesi', emoji: '🔥' },
} as const;

function BossHPBar({ gameState, bossDialogue }: { gameState: GameState; bossDialogue?: { bossType: string; dialogue: string; phase: number } | null }) {
  const boss = useMemo(() => {
    const entries = Object.values(gameState.monsters);
    return entries.find((m) => m.type.startsWith('boss_') && m.alive) ?? null;
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
        {/* Boss name with icons */}
        <div className="mb-1.5 flex items-center justify-center gap-2">
          <span className="text-xs sm:text-sm">{BOSS_DISPLAY_NAMES[boss.type]?.emoji ?? '💀'}</span>
          <span className="boss-pulse font-pixel text-[9px] text-dm-health sm:text-[11px] lg:text-[12px] xl:text-[13px] 2xl:text-[15px]">
            {BOSS_DISPLAY_NAMES[boss.type]?.name ?? 'Boss'}
          </span>
          <span className="text-xs sm:text-sm">{BOSS_DISPLAY_NAMES[boss.type]?.emoji ?? '💀'}</span>
        </div>

        {/* Boss dialogue subtitle */}
        <AnimatePresence>
          {bossDialogue && (
            <motion.p
              key={bossDialogue.dialogue}
              className="mb-1 text-center font-pixel text-[7px] italic text-red-300/80 sm:text-[8px] lg:text-[9px] xl:text-[10px] 2xl:text-[12px]"
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              transition={{ duration: 0.3, ease: EASE }}
            >
              &ldquo;{bossDialogue.dialogue}&rdquo;
            </motion.p>
          )}
        </AnimatePresence>

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

const MinimapRoom = memo(function MinimapRoom({
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
    fill = '#fbbf24';
    opacity = 1;
  } else if (room.cleared) {
    fill = '#4ade80';
    opacity = 0.85;
  } else if (room.isBossRoom) {
    fill = '#ef4444';
    opacity = 1;
    cssClass = 'minimap-boss-glow';
  } else {
    fill = '#a78bfa';
    opacity = 0.85;
    cssClass = 'minimap-danger-pulse';
  }

  return (
    <g>
      {/* Room background with border */}
      <rect
        x={rx}
        y={ry}
        width={room.width}
        height={room.height}
        fill={fill}
        opacity={opacity}
        stroke="#d1d5db"
        strokeWidth={0.5}
        rx={0.5}
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
});

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
      setIsMobile(w < 640);
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

  const sizeByTier = [130, 140, 160, 180, 200] as const;
  const expandedSizeByTier = [190, 230, 260, 290, 320] as const;
  const size = expanded ? expandedSizeByTier[screenTier] : sizeByTier[screenTier];
  const mobileSize = expanded ? 200 : 105;

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
        <span className="font-pixel text-[7px] text-zinc-500 sm:text-[7px] lg:text-[8px] xl:text-[9px] 2xl:text-[11px]">
          Harita {expanded ? '' : `(${currentFloor}/${maxFloors})`}
        </span>
        <span className="font-pixel text-[6px] text-zinc-600 sm:text-[6px] lg:text-[7px] xl:text-[8px] 2xl:text-[10px]">
          {expanded ? '−' : '+'}
        </span>
      </div>
      <motion.div
        className="relative overflow-hidden rounded border border-zinc-600/70 bg-zinc-900"
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
              stroke="#9ca3af"
              strokeWidth={0.7}
              strokeDasharray="1.5 0.5"
              opacity={0.7}
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

          {/* Alive monsters — red dots */}
          {Object.values(monsters).filter((m) => m.alive).map((monster) => (
            <circle
              key={`mm_${monster.id}`}
              cx={monster.position.x - bounds.minX}
              cy={monster.position.y - bounds.minY}
              r={0.8}
              fill="#ef4444"
              opacity={0.9}
              className="minimap-enemy-pulse"
            />
          ))}

          {/* Teammate dots — class-colored with outline */}
          {Object.values(players).filter((p) => p.id !== localPlayerId && p.alive).map((mate) => {
            const mateColor = CLASS_STATS[mate.class]?.color ?? '#4ade80';
            return (
              <g key={`mt_${mate.id}`}>
                <circle
                  cx={mate.position.x - bounds.minX}
                  cy={mate.position.y - bounds.minY}
                  r={1.3}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth={0.3}
                  opacity={0.5}
                />
                <circle
                  cx={mate.position.x - bounds.minX}
                  cy={mate.position.y - bounds.minY}
                  r={1.1}
                  fill={mateColor}
                  opacity={0.95}
                />
              </g>
            );
          })}

          {/* Local player dot — class-colored with white ring, blinking */}
          {localPlayer?.alive && (
            <g filter="url(#mm-glow-gold)">
              <circle
                cx={localPlayer.position.x - bounds.minX}
                cy={localPlayer.position.y - bounds.minY}
                r={1.8}
                fill="none"
                stroke="#ffffff"
                strokeWidth={0.5}
                opacity={0.7}
              />
              <circle
                cx={localPlayer.position.x - bounds.minX}
                cy={localPlayer.position.y - bounds.minY}
                r={1.2}
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
    <PixelFrame className="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5">
      <motion.div
        className="h-3 w-3 rounded-full sm:h-3.5 sm:w-3.5 lg:h-4 lg:w-4 2xl:h-5 2xl:w-5"
        animate={{
          backgroundColor: isSprinting ? '#f59e0b' : '#3f3f46',
          boxShadow: isSprinting
            ? '0 0 10px rgba(245, 158, 11, 0.7)'
            : '0 0 0px transparent',
        }}
        transition={{ duration: 0.15 }}
      />
      <div className="flex flex-col">
        <span
          className="font-pixel text-[8px] sm:text-[9px] lg:text-[10px] xl:text-[11px] 2xl:text-[13px]"
          style={{ color: isSprinting ? '#f59e0b' : '#71717a' }}
        >
          {isSprinting ? '💨 Sprint' : 'Yürü'}
        </span>
        <span className="font-pixel text-[6px] text-zinc-600 sm:text-[7px] lg:text-[8px] xl:text-[9px] 2xl:text-[11px]">[Shift]</span>
      </div>
    </PixelFrame>
  );
}

// --- Action Info ---

const ACTION_ICONS: Record<PlayerClass, string> = {
  warrior: '⚔',
  mage: '🔮',
  archer: '🏹',
  healer: '✨',
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

  const isReady = attackCooldownPct >= 1;

  return (
    <PixelFrame className="flex flex-col items-center gap-1.5 p-2.5 sm:p-3">
      {/* Circular cooldown */}
      <div className="relative flex items-center justify-center">
        <svg viewBox="0 0 40 40" className="h-12 w-12 rotate-[-90deg] lg:h-14 lg:w-14 2xl:h-16 2xl:w-16">
          <circle cx={20} cy={20} r={radius} fill="none" stroke="#1f2937" strokeWidth={3} />
          <circle
            cx={20}
            cy={20}
            r={radius}
            fill="none"
            stroke={isReady ? '#8b5cf6' : '#4c1d95'}
            strokeWidth={3}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.1s linear' }}
          />
        </svg>
        <span className="absolute text-sm lg:text-base 2xl:text-lg">{ACTION_ICONS[playerClass ?? 'warrior']}</span>
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <span className="font-pixel text-[7px] text-zinc-400 sm:text-[8px] lg:text-[9px] xl:text-[10px] 2xl:text-[12px]">Saldırı</span>
        <span className="hidden font-pixel text-[6px] text-zinc-600 sm:block sm:text-[7px] lg:text-[8px] xl:text-[9px] 2xl:text-[11px]">[Space]</span>
      </div>
    </PixelFrame>
  );
}

// --- Ability Info ---

const ABILITY_META: Record<PlayerClass, { icon: string; label: string }> = {
  warrior: { icon: '🛡', label: 'Kalkan' },
  mage: { icon: '❄', label: 'Buz' },
  archer: { icon: '🏹', label: 'Oklar' },
  healer: { icon: '💚', label: 'Şifa' },
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
      <PixelFrame className={`flex flex-col items-center gap-1.5 p-2.5 sm:p-3 ${isReady ? 'ring-1 ring-emerald-500/40' : ''}`}>
        {/* Circular cooldown */}
        <div className="relative flex items-center justify-center">
          <svg viewBox="0 0 40 40" className="h-12 w-12 rotate-[-90deg] lg:h-14 lg:w-14 2xl:h-16 2xl:w-16">
            <circle cx={20} cy={20} r={radius} fill="none" stroke="#1f2937" strokeWidth={3} />
            <circle
              cx={20}
              cy={20}
              r={radius}
              fill="none"
              stroke={isReady ? '#10b981' : '#f59e0b'}
              strokeWidth={3.5}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 0.1s linear' }}
            />
          </svg>
          <span className="absolute text-sm lg:text-base 2xl:text-lg">{meta.icon}</span>
          {/* Ready glow */}
          {isReady && (
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{ boxShadow: '0 0 16px rgba(16, 185, 129, 0.6)' }}
              animate={{ opacity: [0.4, 0.9, 0.4] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            />
          )}
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <span
            className="font-pixel text-[7px] sm:text-[8px] lg:text-[9px] xl:text-[10px] 2xl:text-[12px]"
            style={{ color: isReady ? '#10b981' : '#71717a' }}
          >
            {isReady ? 'Hazir!' : meta.label}
          </span>
          <span className="hidden font-pixel text-[6px] text-zinc-600 sm:block sm:text-[7px] lg:text-[8px] xl:text-[9px] 2xl:text-[11px]">[E]</span>
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
  const difficulty = DIFFICULTY_INFO[Math.min(playerCount, 4)] ?? DIFFICULTY_INFO[1];

  return (
    <PixelFrame className="flex flex-col items-center gap-1 px-3 py-1.5 sm:gap-1.5 sm:px-4 sm:py-2">
      {/* Floor progress bar */}
      <div className="flex w-full items-center gap-2">
        <span className="text-xs sm:text-sm">🏰</span>
        <div className="flex flex-1 flex-col items-center">
          <span className="font-pixel text-[9px] text-dm-gold sm:text-[10px] lg:text-[11px] xl:text-[12px] 2xl:text-[14px]">
            Kat {floor}/10
          </span>
          {/* Floor dots */}
          <div className="mt-0.5 flex items-center gap-0.5">
            {Array.from({ length: 10 }).map((_, i) => (
              <motion.div
                key={i}
                className="h-1 w-1 rounded-full sm:h-1.5 sm:w-1.5"
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
        <span className="font-pixel text-[7px] text-zinc-400 sm:text-[7px] lg:text-[8px] xl:text-[9px] 2xl:text-[11px]">
          Oda {currentRoom + 1}/{totalRooms}
        </span>
        {monstersInRoom > 0 && (
          <span className="font-pixel text-[7px] text-dm-health sm:text-[7px] lg:text-[8px] xl:text-[9px] 2xl:text-[11px]">
            — {monstersInRoom} canavar kaldi
          </span>
        )}
        {monstersInRoom === 0 && !isBossPhase && (
          <span className="font-pixel text-[7px] text-emerald-400 sm:text-[7px] lg:text-[8px] xl:text-[9px] 2xl:text-[11px]">
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
  showFps?: boolean;

  attackCooldownPct?: number;
  abilityCooldownPct?: number;
  abilityActive?: boolean;
  playerClass?: PlayerClass;
  monsterKillEvents?: Array<{ monsterId: string; killerId: string; xp: number }>;
  lootPickupEvents?: Array<{ playerId: string; lootType: string; value: number }>;
  isTouchDevice?: boolean;
  bossDialogue?: { bossType: string; dialogue: string; phase: number } | null;
  floorModifiers?: FloorModifier[];
};

export function HUD({ player, gameState, fps, showFps = false, attackCooldownPct = 1, abilityCooldownPct = 0, abilityActive = false, playerClass, monsterKillEvents, lootPickupEvents, isTouchDevice = false, bossDialogue, floorModifiers = [] }: HUDProps) {
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

  const xpToNextLevel = xpForLevel(player.level);
  const xpCurrentLevel = totalXpForLevel(player.level);
  const xpProgress = player.xp - xpCurrentLevel;
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
  const prevKillEventsLenRef = useRef(monsterKillEvents?.length ?? 0);

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
  const prevLootEventsLenRef = useRef(lootPickupEvents?.length ?? 0);

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
      {isBossPhase && <BossHPBar gameState={gameState} bossDialogue={bossDialogue} />}

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
          {/* Active floor modifiers */}
          {floorModifiers.length > 0 && (
            <div className="mt-1.5 flex items-center justify-center gap-1.5">
              {floorModifiers.map((mod) => (
                <div
                  key={mod.id}
                  className="flex items-center gap-1 rounded-md px-1.5 py-0.5 border"
                  style={{
                    backgroundColor: `${MODIFIER_COLOR[mod.id] ?? '#f87171'}15`,
                    borderColor: `${MODIFIER_COLOR[mod.id] ?? '#f87171'}40`,
                  }}
                  title={mod.description}
                >
                  <span className="text-[10px]">{MODIFIER_EMOJI[mod.id] ?? '⚠️'}</span>
                  <span
                    className="font-pixel text-[7px] sm:text-[8px]"
                    style={{ color: MODIFIER_COLOR[mod.id] ?? '#f87171' }}
                  >
                    {mod.name}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Top-Left: Player Stats (compact on mobile) */}
      <div className="absolute left-2 top-2 sm:left-4 sm:top-4">
        <PixelFrame className={`p-2 sm:p-3 lg:p-3 2xl:p-4 ${isTouchDevice ? 'w-40' : 'w-44 sm:w-56 lg:w-60 xl:w-64 2xl:w-72'}`}>
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

          {/* Active debuff indicators */}
          <DebuffBar player={player} />

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
              xpProgress={xpProgress}
              level={player.level}
            />

            {/* Ultimate ready indicator — F key glow, level 5+ */}
            {(() => {
              const ps = player as PlayerState & { ultimateReady?: boolean; ultimateCooldownTicks?: number };
              if (player.level < 5) return null;
              const ready = ps.ultimateReady ?? false;
              const cd = ps.ultimateCooldownTicks ?? 0;
              const cdSecs = Math.ceil(cd / 20);
              return (
                <motion.div
                  className="mt-1 flex items-center gap-2"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                >
                  <motion.div
                    className="flex items-center gap-1.5 rounded border px-2 py-0.5 font-pixel text-[9px] sm:text-[10px] lg:text-[11px] 2xl:text-[13px]"
                    animate={ready ? { boxShadow: ['0 0 8px rgba(251,191,36,0.35)', '0 0 18px rgba(251,191,36,0.8)', '0 0 8px rgba(251,191,36,0.35)'] } : undefined}
                    transition={ready ? { duration: 1.4, repeat: Infinity, ease: 'easeInOut' } : undefined}
                    style={{
                      borderColor: ready ? '#fbbf24' : '#4b5563',
                      background: ready ? 'rgba(251,191,36,0.12)' : 'rgba(0,0,0,0.4)',
                      color: ready ? '#fbbf24' : '#9ca3af',
                      textShadow: ready ? '0 0 8px rgba(251,191,36,0.8)' : 'none',
                    }}
                  >
                    <span className="font-bold">[F]</span>
                    <span>{ready ? 'ULTIMATE HAZIR' : `Ultimate ${cdSecs}s`}</span>
                  </motion.div>
                </motion.div>
              );
            })()}
          </div>

          {/* Teammates (hidden on touch — saves space for controls) */}
          {teammates.length > 0 && !isTouchDevice && (
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

        </PixelFrame>
      </div>

      {/* Top-Right: Solo Lives OR Gold/Score */}
      <div className="absolute right-2 top-2 sm:right-4 sm:top-4">
        {gameState.isSolo ? (
          <PixelFrame className="flex items-center gap-2.5 px-3 py-2">
            <div className="flex items-center gap-0.5">
              {Array.from({ length: 3 }).map((_, i) => (
                <span
                  key={i}
                  className={`text-sm transition-opacity duration-300 ${
                    i < gameState.soloDeathsRemaining ? 'opacity-100' : 'opacity-25 grayscale'
                  }`}
                  style={{ filter: i < gameState.soloDeathsRemaining ? 'none' : 'grayscale(1)' }}
                >
                  {i < gameState.soloDeathsRemaining ? '❤️' : '🖤'}
                </span>
              ))}
            </div>
            <span className="text-[6px] text-zinc-600">|</span>
            <span className="text-xs">🪙</span>
            <span className="font-pixel text-[9px] text-dm-gold sm:text-[10px] lg:text-[11px]">
              {player.gold}
            </span>
          </PixelFrame>
        ) : (
          <PixelFrame className="p-2 sm:p-3">
            <div className="flex items-center gap-2">
              <span className="text-xs">🪙</span>
              <span className="font-pixel text-[8px] text-dm-gold sm:text-[9px] lg:text-[10px] xl:text-[11px] 2xl:text-[13px]">
                {player.gold}
              </span>
              <span className="text-xs">💀</span>
              <span className="font-pixel text-[8px] text-white sm:text-[9px] lg:text-[10px] xl:text-[11px] 2xl:text-[13px]">
                {player.score}
              </span>
            </div>
          </PixelFrame>
        )}
      </div>

      {/* Minimap: bottom-left on desktop, top-right corner on mobile (below gold/score) */}
      {!isTouchDevice ? (
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
            maxFloors={10}
          />
        </div>
      ) : (
        <div className="absolute right-2 top-16" style={{ opacity: 0.85 }}>
          <Minimap
            rooms={gameState.dungeon.rooms}
            currentRoomId={gameState.currentRoomId}
            players={gameState.players}
            monsters={gameState.monsters}
            loot={gameState.loot}
            localPlayerId={player.id}
            tiles={gameState.dungeon.tiles}
            currentFloor={gameState.dungeon.currentFloor}
            maxFloors={10}
          />
        </div>
      )}

      {/* Bottom-Right: Sprint + Action Info + Ability Info (hidden on touch — touch buttons show cooldowns) */}
      {!isTouchDevice && (
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
      )}

      {/* Kill Feed — bottom center (hidden on touch) */}
      {!isTouchDevice && <KillFeed entries={killFeedEntries} onExpire={handleKillFeedExpire} />}

      {/* FPS counter (toggled via settings) */}
      {showFps && (
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2">
          <span className={`font-pixel text-[7px] sm:text-[8px] lg:text-[9px] xl:text-[10px] 2xl:text-[12px] ${
            fps >= 50 ? 'text-green-500' : fps >= 30 ? 'text-yellow-500' : 'text-red-500'
          }`}>
            {fps} FPS
          </span>
        </div>
      )}

      {/* Combo counter — tier-based premium visual */}
      <AnimatePresence>
        {(() => {
          // Prefer server-tracked comboCount (hit-based); fallback to kill-based local count
          const serverCombo = (player as PlayerState & { comboCount?: number }).comboCount ?? 0;
          const displayCombo = Math.max(serverCombo, comboCount);
          if (displayCombo < 2) return null;
          const tier = displayCombo >= 10 ? 3 : displayCombo >= 6 ? 2 : displayCombo >= 4 ? 1 : 0;
          const cfg = [
            { color: '#ffffff', glow: 'rgba(255,255,255,0.4)', label: 'KOMBO' },
            { color: '#fef3c7', glow: 'rgba(254,243,199,0.65)', label: 'KOMBO' },
            { color: '#fbbf24', glow: 'rgba(251,191,36,0.8)', label: 'SÜPER KOMBO' },
            { color: '#ef4444', glow: 'rgba(239,68,68,0.9)', label: 'KATLİAM' },
          ][tier];
          return (
            <motion.div
              key={`combo-${tier}`}
              className="pointer-events-none absolute right-16 top-1/3 z-30 sm:right-24"
              initial={{ scale: 0.5, opacity: 0, y: -10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 1.4, opacity: 0, y: -5 }}
              transition={{ type: 'spring', stiffness: 380, damping: 18 }}
            >
              <motion.div
                key={displayCombo}
                className="flex flex-col items-center"
                initial={{ scale: 1.3 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 420, damping: 14 }}
              >
                <span
                  className="font-pixel text-2xl font-bold sm:text-3xl lg:text-4xl 2xl:text-5xl"
                  style={{ color: cfg.color, textShadow: `0 0 14px ${cfg.glow}, -1px -1px 0 #000, 1px 1px 0 #000` }}
                >
                  {displayCombo}×
                </span>
                <span
                  className="font-pixel text-[9px] font-semibold tracking-[0.25em] sm:text-[10px] lg:text-[12px] 2xl:text-[13px]"
                  style={{ color: cfg.color, textShadow: `0 0 8px ${cfg.glow}` }}
                >
                  {cfg.label}
                </span>
              </motion.div>
            </motion.div>
          );
        })()}
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

'use client';

import { useMemo, useState, useCallback, useEffect, memo } from 'react';
import { motion } from 'framer-motion';
import type { DungeonRoom, PlayerState, MonsterState, TileType } from '../../../../shared/types';
import { CLASS_STATS } from '../../../../shared/types';
import { PixelFrame } from './PlayerBars';

const EASE = [0.22, 1, 0.36, 1] as const;

/** Per-room monster count from live monster data */
export function useRoomMonsterCounts(rooms: DungeonRoom[], monsters: Record<string, MonsterState>) {
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
export function useRoomHasLoot(rooms: DungeonRoom[], loot: Record<string, { position: { x: number; y: number } }>) {
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

export const MinimapRoom = memo(function MinimapRoom({
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
          <text x={cx} y={cy + 1.5} textAnchor="middle" fontSize={4} fill="#ffffff" opacity={0.95}>&#9760;</text>
        </>
      )}

      {/* Cleared room: checkmark */}
      {room.cleared && !room.isBossRoom && (
        <text x={cx} y={cy + 1.2} textAnchor="middle" fontSize={expanded ? 3.5 : 3} fill="#ffffff" opacity={0.85}>&#10003;</text>
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

export function MinimapStairs({ sx, sy, bx, by }: { sx: number; sy: number; bx: number; by: number }) {
  const x = sx - bx;
  const y = sy - by;
  return (
    <g>
      {/* Beacon ring (expanding pulse) */}
      <circle cx={x} cy={y} r={2} fill="none" stroke="#3b82f6" strokeWidth={0.5} className="minimap-stairs-beacon" />
      {/* Solid center dot */}
      <circle cx={x} cy={y} r={1.5} fill="#3b82f6" opacity={0.95} className="minimap-blink" />
      {/* Down arrow label */}
      <text x={x} y={y - 2.8} textAnchor="middle" fontSize={3} fill="#93c5fd" opacity={0.95}>&#11015;</text>
    </g>
  );
}

export function MinimapLegend({ expanded, allCleared, currentFloor, maxFloors }: { expanded: boolean; allCleared: boolean; currentFloor: number; maxFloors: number }) {
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
        <span className="font-pixel text-[5px] text-zinc-500 sm:text-[6px]">Dusman</span>
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

export function Minimap({
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
          {expanded ? '\u2212' : '+'}
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

          {/* Corridor connections - gradient lines */}
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

          {/* Alive monsters - red dots */}
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

          {/* Teammate dots - class-colored with outline */}
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

          {/* Local player dot - class-colored with white ring, blinking */}
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

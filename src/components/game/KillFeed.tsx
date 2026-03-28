'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CLASS_STATS } from '../../../shared/types';
import type { PlayerClass } from '../../../shared/types';

const EASE = [0.22, 1, 0.36, 1] as const;
const FEED_DURATION = 5000;
const MAX_VISIBLE = 3;

export type KillFeedEntry = {
  id: string;
  playerName: string;
  playerClass: PlayerClass;
  monsterName: string;
  xp: number;
  timestamp: number;
};

let feedIdCounter = 0;

export function createKillFeedEntry(
  playerName: string,
  playerClass: PlayerClass,
  monsterName: string,
  xp: number,
): KillFeedEntry {
  feedIdCounter += 1;
  return {
    id: `kf_${feedIdCounter}_${Date.now()}`,
    playerName,
    playerClass,
    monsterName,
    xp,
    timestamp: Date.now(),
  };
}

type KillFeedProps = {
  entries: KillFeedEntry[];
  onExpire: (id: string) => void;
};

export function KillFeed({ entries, onExpire }: KillFeedProps) {
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    for (const entry of entries) {
      if (!timersRef.current.has(entry.id)) {
        const timer = setTimeout(() => {
          onExpire(entry.id);
          timersRef.current.delete(entry.id);
        }, FEED_DURATION);
        timersRef.current.set(entry.id, timer);
      }
    }
  }, [entries, onExpire]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
    };
  }, []);

  const visibleEntries = entries.slice(-MAX_VISIBLE);

  return (
    <div className="pointer-events-none absolute bottom-16 left-1/2 z-30 hidden -translate-x-1/2 flex-col items-center gap-1 sm:bottom-20 sm:flex">
      <AnimatePresence mode="popLayout">
        {visibleEntries.map((entry) => {
          const classColor = CLASS_STATS[entry.playerClass].color;

          return (
            <motion.div
              key={entry.id}
              layout
              className="rounded border border-dm-border/50 bg-dm-bg/70 px-3 py-1 backdrop-blur-sm"
              initial={{ y: 20, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.9 }}
              transition={{ duration: 0.3, ease: EASE }}
            >
              <span className="font-pixel text-[7px]">
                <span style={{ color: classColor }}>{entry.playerName}</span>
                <span className="text-zinc-500"> → </span>
                <span className="text-zinc-300">{entry.monsterName}</span>
                <span className="text-dm-xp"> (+{entry.xp} XP)</span>
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

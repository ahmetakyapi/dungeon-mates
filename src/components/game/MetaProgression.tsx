'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  META_UPGRADES,
  loadMeta,
  saveMeta,
  buyUpgrade,
  canAfford,
  rankOf,
  upgradeCost,
  type MetaState,
  type MetaUpgradeId,
} from '@/lib/meta-progression';

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Between-run upgrade panel. Shards earned from finished runs are spent here, which
 * is what makes a failed run still feel like progress — the core retention loop for
 * a browser roguelite.
 */
export function MetaProgression({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [meta, setMeta] = useState<MetaState | null>(null);

  // localStorage is only readable on the client, so load after mount.
  useEffect(() => {
    if (open) setMeta(loadMeta());
  }, [open]);

  const handleBuy = useCallback((id: MetaUpgradeId) => {
    setMeta((prev) => {
      if (!prev) return prev;
      const next = buyUpgrade(prev, id);
      if (next !== prev) saveMeta(next);
      return next;
    });
  }, []);

  const upgradeIds = Object.keys(META_UPGRADES) as MetaUpgradeId[];

  return (
    <AnimatePresence>
      {open && meta && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: EASE }}
          role="dialog"
          aria-modal="true"
          aria-label="Kalıcı yükseltmeler"
          onClick={onClose}
        >
          <motion.div
            className="glass-strong relative w-full max-w-2xl overflow-hidden rounded-xl border border-white/10 p-6"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.35, ease: EASE }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="font-pixel text-sm text-dm-accent sm:text-base">Kadim Kalıntılar</h2>
                <p className="mt-1.5 font-body text-xs text-zinc-400">
                  Her run kalıcı güç bırakır. Şardları harca, bir sonraki inişe daha hazır başla.
                </p>
              </div>
              <button
                onClick={onClose}
                className="shrink-0 rounded border border-white/10 px-2.5 py-1 font-pixel text-[9px] text-zinc-400 transition-colors hover:border-white/25 hover:text-white"
                aria-label="Kapat"
              >
                ESC
              </button>
            </div>

            {/* Currency + lifetime stats */}
            <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatChip label="Şard" value={meta.shards} accent />
              <StatChip label="En İyi Kat" value={`${meta.bestFloor}/10`} />
              <StatChip label="Run" value={meta.totalRuns} />
              <StatChip label="Zafer" value={meta.victories} />
            </div>

            {/* Upgrades */}
            <div className="flex flex-col gap-2">
              {upgradeIds.map((id) => {
                const def = META_UPGRADES[id];
                const rank = rankOf(meta, id);
                const maxed = rank >= def.maxRank;
                const cost = upgradeCost(meta, id);
                const affordable = canAfford(meta, id);

                return (
                  <div
                    key={id}
                    className="flex items-center gap-3 rounded-lg border border-white/[0.07] bg-white/[0.02] p-3"
                  >
                    <span className="text-lg" aria-hidden>{def.emoji}</span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-pixel text-[10px] text-zinc-100">{def.name}</span>
                        {/* Rank pips read faster than "3/5" at a glance */}
                        <span className="flex gap-0.5" aria-label={`${rank}/${def.maxRank} rank`}>
                          {Array.from({ length: def.maxRank }).map((_, i) => (
                            <span
                              key={i}
                              className={`h-1.5 w-1.5 rounded-full ${i < rank ? 'bg-dm-accent' : 'bg-white/15'}`}
                            />
                          ))}
                        </span>
                      </div>
                      <p className="mt-1 truncate font-body text-[11px] text-zinc-500">{def.description}</p>
                    </div>

                    <button
                      onClick={() => handleBuy(id)}
                      disabled={maxed || !affordable}
                      className={`shrink-0 rounded px-3 py-1.5 font-pixel text-[9px] transition-all ${
                        maxed
                          ? 'cursor-default border border-emerald-500/25 text-emerald-400/70'
                          : affordable
                            ? 'border border-dm-accent/50 bg-dm-accent/15 text-dm-accent hover:bg-dm-accent/25'
                            : 'cursor-not-allowed border border-white/[0.07] text-zinc-600'
                      }`}
                    >
                      {maxed ? 'TAM' : `${cost} 🔷`}
                    </button>
                  </div>
                );
              })}
            </div>

            {meta.totalRuns === 0 && (
              <p className="mt-4 text-center font-body text-[11px] text-zinc-500">
                Henüz run tamamlamadın. İlk inişini yap, şardlar burada birikmeye başlasın.
              </p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function StatChip({ label, value, accent = false }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2">
      <div className="font-pixel text-[8px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={`mt-1 font-pixel text-xs ${accent ? 'text-dm-accent' : 'text-zinc-200'}`}>{value}</div>
    </div>
  );
}

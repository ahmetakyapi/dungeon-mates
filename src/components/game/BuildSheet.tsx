'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { PlayerState } from '../../../shared/types';
import { CLASS_STATS, TALENT_TREE, TALENT_BRANCH_NAMES } from '../../../shared/types';

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Build sheet — the player's current stats and the talents they picked.
 *
 * Talents were previously invisible the moment they were chosen: TalentSelect is a
 * one-shot modal and nothing else in the game ever showed the branch or the picks
 * again. Neither were the derived stats (crit, dodge, lifesteal) surfaced anywhere,
 * so a player had no way to inspect the build they were assembling.
 */
export function BuildSheet({
  open,
  player,
  ping,
  onClose,
}: {
  open: boolean;
  player: PlayerState;
  ping: number;
  onClose: () => void;
}) {
  const base = CLASS_STATS[player.class];
  const tree = TALENT_TREE[player.class];
  const taken = tree.filter((t) => player.talents.includes(t.id));
  const branch = player.talentBranch
    ? TALENT_BRANCH_NAMES[player.class][player.talentBranch]
    : null;

  const statRows: ReadonlyArray<readonly [string, string | number, boolean]> = [
    ['Can', `${player.hp} / ${player.maxHp}`, player.maxHp !== base.maxHp],
    ['Mana', `${player.mana} / ${player.maxMana}`, player.maxMana !== base.maxMana],
    ['Saldırı', player.attack, player.attack !== base.attack],
    ['Savunma', player.defense, player.defense !== base.defense],
    ['Seviye', player.level, false],
    ['Altın', player.gold, false],
  ];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: EASE }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Karakter sayfası"
        >
          <motion.div
            className="glass-strong w-full max-w-md rounded-xl border border-white/10 p-5"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.99 }}
            transition={{ duration: 0.28, ease: EASE }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-pixel text-xs" style={{ color: base.color }}>
                  {base.label}
                </h2>
                <p className="mt-1 font-body text-[11px] text-zinc-500">
                  {branch ? `${branch.emoji} ${branch.name} dalı` : 'Henüz dal seçilmedi'}
                </p>
              </div>
              <button
                onClick={onClose}
                className="rounded border border-white/10 px-2 py-1 font-pixel text-[8px] text-zinc-400 transition-colors hover:border-white/25 hover:text-white"
              >
                TAB
              </button>
            </div>

            {/* Stats — deviations from the class base are highlighted */}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {statRows.map(([k, v, changed]) => (
                <div key={k} className="flex items-baseline justify-between gap-2 border-b border-white/[0.05] pb-1">
                  <dt className="font-pixel text-[8px] text-zinc-500">{k}</dt>
                  <dd className={`font-pixel text-[9px] tabular-nums ${changed ? 'text-emerald-400' : 'text-zinc-200'}`}>
                    {v}
                  </dd>
                </div>
              ))}
            </dl>

            {/* Talents actually taken */}
            <h3 className="mt-4 font-pixel text-[9px] text-zinc-400">
              Yetenekler {taken.length > 0 && <span className="text-zinc-600">({taken.length})</span>}
            </h3>
            {taken.length === 0 ? (
              <p className="mt-2 font-body text-[11px] text-zinc-600">
                Seviye atladıkça yetenek seçeceksin.
              </p>
            ) : (
              <ul className="mt-2 flex flex-col gap-1.5">
                {taken.map((t) => (
                  <li key={t.id} className="rounded border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-pixel text-[9px] text-zinc-200">{t.name}</span>
                      <span className="font-pixel text-[8px] text-zinc-600">Sv.{t.level}</span>
                    </div>
                    <p className="mt-0.5 font-body text-[11px] text-zinc-500">{t.description}</p>
                  </li>
                ))}
              </ul>
            )}

            {/* Connection quality — there was no latency readout anywhere */}
            <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3">
              <span className="font-pixel text-[8px] text-zinc-500">Bağlantı</span>
              <span
                className={`font-pixel text-[9px] tabular-nums ${
                  ping === 0 ? 'text-zinc-600' : ping < 80 ? 'text-emerald-400' : ping < 180 ? 'text-amber-400' : 'text-red-400'
                }`}
              >
                {ping === 0 ? '—' : `${ping} ms`}
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

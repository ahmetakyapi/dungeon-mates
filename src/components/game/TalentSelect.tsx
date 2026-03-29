'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { TalentDef, TalentBranch, PlayerClass } from '../../../shared/types';
import { TALENT_BRANCH_NAMES } from '../../../shared/types';

type TalentSelectProps = {
  isOpen: boolean;
  talents: TalentDef[];
  playerClass: PlayerClass;
  level: number;
  currentBranch: TalentBranch | null;
  onSelect: (talentId: string) => void;
};

const BRANCH_COLORS: Record<TalentBranch, { bg: string; border: string; glow: string }> = {
  branch_a: { bg: 'from-red-900/40 to-red-950/60', border: 'border-red-500/50', glow: 'shadow-red-500/20' },
  branch_b: { bg: 'from-blue-900/40 to-blue-950/60', border: 'border-blue-500/50', glow: 'shadow-blue-500/20' },
  branch_c: { bg: 'from-emerald-900/40 to-emerald-950/60', border: 'border-emerald-500/50', glow: 'shadow-emerald-500/20' },
};

export function TalentSelect({ isOpen, talents, playerClass, level, currentBranch, onSelect }: TalentSelectProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [autoSelectTimer, setAutoSelectTimer] = useState(15);

  // 15 saniye geri sayım — otomatik seçim
  useEffect(() => {
    if (!isOpen || talents.length === 0) return;
    setAutoSelectTimer(15);
    setSelectedId(null);
    const interval = setInterval(() => {
      setAutoSelectTimer(prev => {
        if (prev <= 1) {
          // Zaman doldu, ilk talent'ı seç
          onSelect(talents[0].id);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, talents, onSelect]);

  const handleSelect = useCallback((talentId: string) => {
    setSelectedId(talentId);
    // Kısa gecikme sonrası onayla (görsel geri bildirim için)
    setTimeout(() => {
      onSelect(talentId);
    }, 300);
  }, [onSelect]);

  if (!isOpen || talents.length === 0) return null;

  // Dal seçimi mi yoksa talent seçimi mi?
  const isBranchSelect = currentBranch === null && talents.length > 1;
  const branchNames = TALENT_BRANCH_NAMES[playerClass];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.8, y: 30 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.8, y: 30 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="relative w-full max-w-lg mx-4"
        >
          {/* Başlık */}
          <div className="text-center mb-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 400 }}
              className="inline-block px-4 py-1 mb-2 rounded-full bg-yellow-500/20 border border-yellow-500/40"
            >
              <span className="text-yellow-400 font-bold text-sm tracking-wider">
                SEVİYE {level}
              </span>
            </motion.div>
            <h2 className="text-xl font-bold text-white">
              {isBranchSelect ? 'Yolunu Seç' : 'Yetenek Seç'}
            </h2>
            <p className="text-zinc-400 text-sm mt-1">
              {isBranchSelect
                ? 'Bu seçim tüm oyun boyunca geçerli olacak'
                : `${branchNames[currentBranch!]?.name ?? ''} dalından yetenek seç`
              }
            </p>
          </div>

          {/* Geri sayım */}
          <div className="flex justify-center mb-3">
            <div className={`
              px-3 py-1 rounded-full text-xs font-mono
              ${autoSelectTimer <= 5 ? 'bg-red-500/20 text-red-400 animate-pulse' : 'bg-zinc-800 text-zinc-400'}
            `}>
              {autoSelectTimer}s
            </div>
          </div>

          {/* Talent kartları */}
          <div className={`grid gap-3 ${talents.length === 3 ? 'grid-cols-3' : talents.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {talents.map((talent, i) => {
              const colors = BRANCH_COLORS[talent.branch];
              const branchInfo = branchNames[talent.branch];
              const isSelected = selectedId === talent.id;

              return (
                <motion.button
                  key={talent.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + i * 0.1 }}
                  onClick={() => handleSelect(talent.id)}
                  disabled={selectedId !== null}
                  className={`
                    relative p-4 rounded-xl border backdrop-blur-md
                    bg-gradient-to-b ${colors.bg} ${colors.border}
                    hover:shadow-lg ${colors.glow}
                    transition-all duration-200
                    ${isSelected ? 'ring-2 ring-yellow-400 scale-105' : 'hover:scale-[1.02]'}
                    ${selectedId !== null && !isSelected ? 'opacity-40' : ''}
                    disabled:cursor-default
                  `}
                >
                  {/* Dal ikonu */}
                  {isBranchSelect && (
                    <div className="text-2xl mb-2">{branchInfo.emoji}</div>
                  )}

                  {/* Dal adı (sadece dal seçiminde) */}
                  {isBranchSelect && (
                    <div className="text-xs text-zinc-400 mb-1 font-medium tracking-wide uppercase">
                      {branchInfo.name}
                    </div>
                  )}

                  {/* Talent adı */}
                  <h3 className="text-white font-bold text-sm mb-1">
                    {talent.name}
                  </h3>

                  {/* Açıklama */}
                  <p className="text-zinc-300 text-xs leading-relaxed">
                    {talent.description}
                  </p>

                  {/* Dal açıklaması (sadece dal seçiminde) */}
                  {isBranchSelect && (
                    <p className="text-zinc-500 text-[10px] mt-2 italic">
                      {branchInfo.description}
                    </p>
                  )}

                  {/* Seçildi işareti */}
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute top-2 right-2 w-5 h-5 rounded-full bg-yellow-400 flex items-center justify-center"
                    >
                      <span className="text-black text-xs font-bold">✓</span>
                    </motion.div>
                  )}
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

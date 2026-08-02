'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PixelButton } from '@/components/ui/PixelButton';
import { ClassPortrait } from '@/components/landing/ClassPortrait';
import {
  CLASS_STATS,
  type PlayerClass,
  type PlayerState,
} from '../../../shared/types';

const EASE = [0.22, 1, 0.36, 1] as const;
const COUNTDOWN_SECONDS = 15;

const CLASSES: PlayerClass[] = ['warrior', 'mage', 'archer', 'healer'] as const;

const CLASS_GRADIENTS: Record<PlayerClass, string> = {
  warrior: 'from-red-900/30 via-transparent to-red-800/10',
  mage: 'from-purple-900/30 via-transparent to-purple-800/10',
  archer: 'from-emerald-900/30 via-transparent to-emerald-800/10',
  healer: 'from-amber-900/30 via-transparent to-amber-800/10',
} as const;

const CLASS_ABILITIES: Record<PlayerClass, string> = {
  warrior: 'Kalkan Duvarı: 4 saniye boyunca hasarı %70 azaltır (E tuşu)',
  mage: 'Buz Fırtınası: Çevredeki düşmanlara hasar verir ve yavaşlatır (E tuşu)',
  archer: 'Ok Yağmuru: Yelpaze şeklinde 5 ok fırlatır (E tuşu)',
  healer: 'Şifa Dalgası: Yakındaki tüm takım arkadaşlarını iyileştirir (E tuşu)',
} as const;

const POPULAR_CLASS: PlayerClass = 'warrior';

const CLASS_ROLES: Record<PlayerClass, string> = {
  warrior: 'tank',
  mage: 'hasar',
  archer: 'hasar',
  healer: 'destek',
} as const;

type StatBarProps = {
  label: string;
  value: number;
  max: number;
  color: string;
};

function StatBar({ label, value, max, color }: StatBarProps) {
  const percentage = Math.min((value / max) * 100, 100);
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 font-pixel text-[7px] text-zinc-400 sm:text-[8px] lg:text-[9px] xl:text-[10px] 2xl:text-[12px]">
        {label}
      </span>
      <div className="relative h-2 flex-1 overflow-hidden rounded-sm bg-zinc-800">
        <motion.div
          className="h-full rounded-sm"
          style={{
            backgroundColor: color,
            boxShadow: `0 0 8px ${color}80`,
          }}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ type: 'spring', stiffness: 80, damping: 16, mass: 0.8 }}
        />
        {/* Shimmer overlay */}
        <motion.div
          className="pointer-events-none absolute inset-y-0 w-8"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)',
          }}
          initial={{ x: -40 }}
          animate={{ x: `${percentage * 3}%` }}
          transition={{ type: 'spring', stiffness: 60, damping: 20, delay: 0.15 }}
        />
      </div>
      <span className="w-6 text-right font-pixel text-[7px] text-zinc-300 lg:text-[9px] xl:text-[10px] 2xl:text-[12px]">
        {value}
      </span>
    </div>
  );
}

// Animated class preview showing attack animation
type ClassSelectProps = {
  players: Record<string, PlayerState>;
  localPlayerId: string;
  onSelectClass: (playerClass: PlayerClass) => void;
  onReady: () => void;
  isSolo?: boolean;
};

export function ClassSelect({
  players,
  localPlayerId,
  onSelectClass,
  onReady,
  isSolo = false,
}: ClassSelectProps) {
  const [selected, setSelected] = useState<PlayerClass | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [hoveredClass, setHoveredClass] = useState<PlayerClass | null>(null);
  const [showAbilityTooltip, setShowAbilityTooltip] = useState<PlayerClass | null>(null);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Countdown timer
  useEffect(() => {
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  // Auto-ready when countdown reaches 0
  useEffect(() => {
    if (countdown === 0 && !isReady) {
      if (!selected) {
        onSelectClass('warrior');
        setSelected('warrior');
      }
      setIsReady(true);
      onReady();
    }
  }, [countdown, isReady, selected, onSelectClass, onReady]);

  const handleSelect = useCallback(
    (cls: PlayerClass) => {
      if (isReady) return;
      setSelected(cls);
      onSelectClass(cls);
    },
    [isReady, onSelectClass],
  );

  const handleReady = useCallback(() => {
    if (!selected) return;
    setIsReady(true);
    onReady();
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, [selected, onReady]);

  const otherPlayers = Object.values(players).filter(
    (p) => p.id !== localPlayerId,
  );

  const showComparison = hoveredClass !== null && selected !== null && hoveredClass !== selected;

  // Team composition hint
  const teamHint = useMemo(() => {
    if (isSolo) return null;
    const allClasses = [
      ...otherPlayers.map((p) => p.class).filter(Boolean),
      selected,
    ].filter(Boolean) as PlayerClass[];

    const hasTank = allClasses.includes('warrior');
    const hasMage = allClasses.includes('mage');
    const hasArcher = allClasses.includes('archer');

    if (!hasTank && allClasses.length >= 1) {
      return { text: 'Takımda savaşçı yok — bir tank önerilir!', icon: '🛡', color: '#ef4444' };
    }
    if (hasTank && hasMage && hasArcher) {
      return { text: 'Mükemmel takım kompozisyonu!', icon: '✨', color: '#10b981' };
    }
    if (!hasMage && allClasses.length >= 2) {
      return { text: 'Bir büyücü alan hasarı yapabilir', icon: '🔮', color: '#a78bfa' };
    }
    return null;
  }, [isSolo, otherPlayers, selected]);

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center bg-dm-bg px-4 py-8">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-dm-accent/5 via-transparent to-dm-gold/5" />

      {/* Countdown timer */}
      <motion.div
        className="z-20 mb-4 flex flex-col items-center gap-2"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: EASE }}
      >
        <motion.div
          className={`flex h-12 w-12 items-center justify-center rounded-full border-2 sm:h-14 sm:w-14 lg:h-16 lg:w-16 2xl:h-20 2xl:w-20 ${
            countdown <= 5
              ? 'border-dm-health bg-dm-health/10'
              : 'border-dm-accent/40 bg-dm-accent/10'
          }`}
          animate={
            countdown <= 5
              ? { scale: [1, 1.08, 1], borderColor: ['#ef4444', '#ef444480', '#ef4444'] }
              : {}
          }
          transition={countdown <= 5 ? { duration: 1, repeat: Infinity } : {}}
        >
          <span
            className={`font-pixel text-base sm:text-lg lg:text-xl xl:text-2xl 2xl:text-3xl ${
              countdown <= 5 ? 'text-dm-health' : 'text-dm-accent'
            }`}
          >
            {countdown}
          </span>
        </motion.div>
        {/* Progress bar */}
        <div className="h-1 w-32 overflow-hidden rounded-full bg-dm-border sm:w-40 lg:w-48 2xl:w-56">
          <motion.div
            className={`h-full rounded-full ${countdown <= 5 ? 'bg-dm-health' : 'bg-dm-accent'}`}
            initial={{ width: '100%' }}
            animate={{ width: `${(countdown / COUNTDOWN_SECONDS) * 100}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </motion.div>

      <motion.h1
        className="glow-purple z-10 mb-2 font-pixel text-lg text-dm-accent sm:text-2xl lg:text-3xl 2xl:text-4xl"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: EASE }}
      >
        Sınıf Seç
      </motion.h1>

      <motion.p
        className="z-10 mb-6 font-pixel text-[10px] text-zinc-400 sm:mb-8 lg:text-sm xl:text-sm 2xl:text-base"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        Hangi sınıfla dalacaksın?
      </motion.p>

      {/* Class cards — stack vertically on small screens, horizontal on larger */}
      <div
        ref={scrollContainerRef}
        className="z-10 flex w-full max-w-4xl flex-col gap-3 px-2 pb-2 sm:flex-row sm:snap-x sm:snap-mandatory sm:gap-6 sm:overflow-x-auto lg:gap-8 2xl:max-w-6xl 2xl:gap-10"
      >
        {CLASSES.map((cls, i) => {
          const stats = CLASS_STATS[cls];
          const isSelected = selected === cls;
          const isPopular = cls === POPULAR_CLASS;

          return (
            <motion.button
              key={cls}
              className={`pixel-border relative w-full flex-1 shrink-0 cursor-pointer rounded-lg p-4 text-left transition-colors sm:min-w-0 sm:snap-center sm:p-6 lg:p-8 2xl:p-10 ${
                isSelected
                  ? 'border-dm-accent bg-dm-accent/10'
                  : 'bg-dm-surface hover:bg-dm-surface/80'
              } ${isReady && !isSelected ? 'opacity-40' : ''}`}
              onClick={() => handleSelect(cls)}
              onMouseEnter={() => setHoveredClass(cls)}
              onMouseLeave={() => setHoveredClass(null)}
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 * i + 0.3, duration: 0.5, ease: EASE }}
              whileHover={!isReady ? { scale: 1.03 } : undefined}
              whileTap={!isReady ? { scale: 0.97 } : undefined}
            >
              {/* Selected gradient background */}
              {isSelected && (
                <div
                  className={`pointer-events-none absolute inset-0 rounded-lg bg-gradient-to-b ${CLASS_GRADIENTS[cls]}`}
                />
              )}

              {/* Selected glow */}
              {isSelected && (
                <motion.div
                  className="absolute inset-0 rounded-lg"
                  style={{
                    boxShadow: `0 0 25px ${stats.color}50, inset 0 0 25px ${stats.color}15`,
                  }}
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              )}

              {/* Popular badge */}
              {isPopular && (
                <motion.div
                  className="absolute -right-1 -top-1 z-20 rounded border border-dm-gold/40 bg-dm-gold/20 px-2 py-0.5"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.6 + i * 0.1, ease: EASE }}
                >
                  <span className="font-pixel text-[6px] text-dm-gold lg:text-[8px] xl:text-[9px] 2xl:text-[10px]">
                    Popüler
                  </span>
                </motion.div>
              )}

              {/*
                ClassPreview used to sit here: an abstract coloured rectangle
                that stood in for character art before there was any. With a
                real animated portrait directly beneath it, it read as a
                rendering fault rather than a flourish.
              */}
              <div className="mb-3 flex justify-center">
                <ClassPortrait cls={cls} height={isSelected ? 132 : 116} />
              </div>

              {/* Name */}
              <h2
                className="mb-1 font-pixel text-sm sm:text-base lg:text-lg xl:text-xl 2xl:text-2xl"
                style={{ color: stats.color }}
              >
                {stats.label}
              </h2>

              {/* Ability tooltip trigger */}
              {/* Nested <button> inside the card's <button> is invalid HTML and
                  triggers a hydration error, so this is a span carrying button
                  semantics — same behaviour, valid markup, still focusable. */}
              <span
                role="button"
                tabIndex={0}
                aria-expanded={showAbilityTooltip === cls}
                className="mb-2 flex w-fit cursor-pointer items-center gap-1 font-pixel text-[9px] text-dm-gold/70 transition-colors hover:text-dm-gold lg:text-[10px] xl:text-[11px] 2xl:text-[13px]"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAbilityTooltip((prev) => (prev === cls ? null : cls));
                }}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter' && e.key !== ' ') return;
                  e.preventDefault();
                  e.stopPropagation();
                  setShowAbilityTooltip((prev) => (prev === cls ? null : cls));
                }}
              >
                <span aria-hidden>✦</span> Yetenek Bilgisi
              </span>

              {/* Ability tooltip */}
              <AnimatePresence>
                {showAbilityTooltip === cls && (
                  <motion.div
                    className="mb-2 rounded bg-dm-bg/80 px-3 py-2 text-[10px] leading-relaxed text-zinc-300 lg:text-sm xl:text-sm 2xl:text-base"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: EASE }}
                  >
                    {CLASS_ABILITIES[cls]}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Stats */}
              <div className="relative mt-2 flex flex-col gap-2">
                <StatBar label="HP" value={stats.maxHp} max={150} color="#ef4444" />
                <StatBar label="ATK" value={stats.attack} max={25} color="#f59e0b" />
                <StatBar label="DEF" value={stats.defense} max={15} color="#3b82f6" />
                <StatBar label="SPD" value={stats.speed * 10} max={30} color="#10b981" />
                <StatBar label="RNG" value={stats.attackRange} max={10} color="#8b5cf6" />
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* VS comparison tooltip */}
      <AnimatePresence>
        {showComparison && hoveredClass && selected && (
          <motion.div
            className="pixel-border z-20 mt-4 rounded bg-dm-surface p-3"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: EASE }}
          >
            <div className="flex items-center gap-4">
              <div className="text-center">
                <span className="text-lg">{CLASS_STATS[selected].emoji}</span>
                <p
                  className="font-pixel text-[7px] lg:text-[9px] xl:text-[10px] 2xl:text-[12px]"
                  style={{ color: CLASS_STATS[selected].color }}
                >
                  {CLASS_STATS[selected].label}
                </p>
              </div>
              <span className="font-pixel text-[10px] text-dm-gold lg:text-sm xl:text-sm 2xl:text-base">VS</span>
              <div className="text-center">
                <span className="text-lg">{CLASS_STATS[hoveredClass].emoji}</span>
                <p
                  className="font-pixel text-[7px] lg:text-[9px] xl:text-[10px] 2xl:text-[12px]"
                  style={{ color: CLASS_STATS[hoveredClass].color }}
                >
                  {CLASS_STATS[hoveredClass].label}
                </p>
              </div>
            </div>
            <div className="mt-2 flex flex-col gap-1">
              {(['maxHp', 'attack', 'defense', 'speed'] as const).map((stat) => {
                const selVal = CLASS_STATS[selected][stat];
                const hovVal = CLASS_STATS[hoveredClass][stat];
                const labels: Record<string, string> = {
                  maxHp: 'HP',
                  attack: 'ATK',
                  defense: 'DEF',
                  speed: 'SPD',
                };
                return (
                  <div key={stat} className="flex items-center justify-between gap-4">
                    <span
                      className={`font-pixel text-[7px] lg:text-[9px] xl:text-[10px] 2xl:text-[12px] ${
                        selVal > hovVal ? 'text-dm-xp' : selVal < hovVal ? 'text-dm-health' : 'text-zinc-400'
                      }`}
                    >
                      {selVal}
                    </span>
                    <span className="font-pixel text-[6px] text-zinc-500 lg:text-[8px] xl:text-[9px] 2xl:text-[10px]">
                      {labels[stat]}
                    </span>
                    <span
                      className={`font-pixel text-[7px] lg:text-[9px] xl:text-[10px] 2xl:text-[12px] ${
                        hovVal > selVal ? 'text-dm-xp' : hovVal < selVal ? 'text-dm-health' : 'text-zinc-400'
                      }`}
                    >
                      {hovVal}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Other players' selections (hidden in solo) */}
      {!isSolo && otherPlayers.length > 0 && (
        <motion.div
          className="z-10 mt-6 flex flex-wrap justify-center gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          {otherPlayers.map((player) => (
            <div
              key={player.id}
              className="flex items-center gap-2 rounded bg-dm-surface px-3 py-2"
            >
              <span className="font-pixel text-[9px] text-zinc-300 lg:text-[11px] xl:text-[12px] 2xl:text-[14px]">
                {player.name}
              </span>
              {player.class ? (
                <span className="text-sm">
                  {CLASS_STATS[player.class].emoji}
                </span>
              ) : (
                <motion.span
                  className="font-pixel text-[8px] text-zinc-500 lg:text-[10px] xl:text-[11px] 2xl:text-[13px]"
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  Seçiyor...
                </motion.span>
              )}
            </div>
          ))}
        </motion.div>
      )}

      {/* Team composition hint */}
      <AnimatePresence>
        {teamHint && (
          <motion.div
            className="z-10 mt-4 flex items-center gap-2 rounded border px-4 py-2"
            style={{
              borderColor: `${teamHint.color}40`,
              backgroundColor: `${teamHint.color}10`,
            }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: EASE }}
          >
            <span className="text-sm">{teamHint.icon}</span>
            <span className="font-pixel text-[8px] lg:text-[10px] xl:text-[11px] 2xl:text-[13px]" style={{ color: teamHint.color }}>
              {teamHint.text}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ready button */}
      <motion.div
        className="z-10 mt-6 sm:mt-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: selected ? 1 : 0.3 }}
        transition={{ duration: 0.3 }}
      >
        <motion.div
          animate={
            selected && !isReady
              ? {
                  boxShadow: [
                    '0 0 0px rgba(139, 92, 246, 0)',
                    '0 0 20px rgba(139, 92, 246, 0.4)',
                    '0 0 0px rgba(139, 92, 246, 0)',
                  ],
                }
              : {}
          }
          transition={{ duration: 1.5, repeat: Infinity }}
          style={{ borderRadius: 4 }}
        >
          <PixelButton
            variant="primary"
            onClick={handleReady}
            disabled={!selected || isReady}
          >
            {isReady ? 'Hazır! Bekleniyor...' : 'Hazırım!'}
          </PixelButton>
        </motion.div>
      </motion.div>
    </main>
  );
}

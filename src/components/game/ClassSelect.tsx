'use client';

import { useState, useCallback, useRef, useEffect, useMemo, type PointerEvent as ReactPointerEvent } from 'react';
import {
  motion,
  AnimatePresence,
  LayoutGroup,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'framer-motion';
import { PixelButton } from '@/components/ui/PixelButton';
import { MaskReveal, SplitReveal } from '@/components/fx/RevealText';
import { EASE_OUT_EXPO } from '@/lib/motion';
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

// ─── CLASS CARD ───────────────────────────────────────────
type ClassCardProps = {
  cls: PlayerClass;
  index: number;
  isSelected: boolean;
  isReady: boolean;
  tooltipOpen: boolean;
  onSelect: (cls: PlayerClass) => void;
  onHover: (cls: PlayerClass | null) => void;
  onToggleTooltip: (cls: PlayerClass) => void;
};

/** Pixel shards that fly off the portrait the moment a class is picked. */
const BURST = Array.from({ length: 10 }, (_, i) => {
  const a = (i / 10) * Math.PI * 2;
  return { x: Math.cos(a) * 70, y: Math.sin(a) * 52, s: 3 + (i % 3) * 2 };
});

/**
 * One class card. Tilts toward the cursor (mouse only — touch gets a plain
 * press), carries a spotlight that follows the pointer, and hands a shared
 * selection ring to whichever card is picked so the choice visibly *moves*.
 */
function ClassCard({
  cls,
  index,
  isSelected,
  isReady,
  tooltipOpen,
  onSelect,
  onHover,
  onToggleTooltip,
}: ClassCardProps) {
  const stats = CLASS_STATS[cls];
  const isPopular = cls === POPULAR_CLASS;
  const reduce = useReducedMotion();

  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const rotateX = useSpring(useTransform(my, [0, 1], [6, -6]), { stiffness: 220, damping: 20 });
  const rotateY = useSpring(useTransform(mx, [0, 1], [-8, 8]), { stiffness: 220, damping: 20 });
  const spotX = useTransform(mx, (v) => `${v * 100}%`);
  const spotY = useTransform(my, (v) => `${v * 100}%`);
  const spotlight = useMotionTemplate`radial-gradient(260px circle at ${spotX} ${spotY}, ${stats.color}2e, transparent 65%)`;

  const handlePointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (reduce || isReady || e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width);
    my.set((e.clientY - r.top) / r.height);
  };

  const handlePointerLeave = () => {
    mx.set(0.5);
    my.set(0.5);
    onHover(null);
  };

  return (
    <motion.button
      className={`pixel-border group relative w-full flex-1 shrink-0 cursor-pointer rounded-lg p-4 text-left transition-[background-color,opacity] duration-300 sm:min-w-0 sm:snap-center sm:p-6 lg:p-8 2xl:p-10 ${
        isSelected ? 'bg-dm-accent/10' : 'bg-dm-surface hover:bg-dm-surface/80'
      } ${isReady && !isSelected ? 'opacity-40 grayscale' : ''}`}
      style={{ rotateX, rotateY, transformPerspective: 900 }}
      onClick={() => onSelect(cls)}
      onPointerEnter={() => onHover(cls)}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      initial={{ y: 48, opacity: 0, clipPath: 'inset(100% -30% -30% -30% round 8px)' }}
      animate={{
        y: 0,
        opacity: 1,
        clipPath: 'inset(-30% -30% -30% -30% round 8px)',
        transition: { delay: 0.35 + index * 0.09, duration: 0.9, ease: EASE_OUT_EXPO },
      }}
      whileHover={!isReady ? { y: -6, scale: 1.02 } : undefined}
      whileTap={!isReady ? { scale: 0.97 } : undefined}
      transition={{ type: 'spring', stiffness: 360, damping: 24 }}
      aria-pressed={isSelected}
    >
      {/* Pointer spotlight */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-lg opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: spotlight }}
      />

      {/* Selected gradient background */}
      <AnimatePresence>
        {isSelected && (
          <motion.div
            aria-hidden
            className={`pointer-events-none absolute inset-0 rounded-lg bg-gradient-to-b ${CLASS_GRADIENTS[cls]}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          />
        )}
      </AnimatePresence>

      {/* Shared selection ring — springs from card to card */}
      {isSelected && (
        <motion.div
          layoutId="class-select-ring"
          aria-hidden
          className="pointer-events-none absolute -inset-[3px] rounded-[10px] border-2"
          style={{
            borderColor: stats.color,
            boxShadow: `0 0 28px ${stats.color}55, inset 0 0 22px ${stats.color}22`,
          }}
          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
        />
      )}

      {/* Popular badge */}
      {isPopular && (
        <motion.div
          className="absolute -right-1 -top-1 z-20 rounded border border-dm-gold/40 bg-dm-gold/20 px-2 py-0.5"
          initial={{ scale: 0, rotate: -12 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.9 + index * 0.09, type: 'spring', stiffness: 420, damping: 16 }}
        >
          <span className="font-pixel text-[6px] text-dm-gold lg:text-[8px] xl:text-[9px] 2xl:text-[10px]">
            Popüler
          </span>
        </motion.div>
      )}

      {/* Selected tag */}
      <AnimatePresence>
        {isSelected && (
          <motion.div
            className="absolute left-3 top-3 z-20 flex items-center gap-1 rounded-sm px-1.5 py-0.5 font-pixel text-[7px] text-dm-bg lg:text-[9px]"
            style={{ background: stats.color }}
            initial={{ scale: 0, opacity: 0, x: -6 }}
            animate={{ scale: 1, opacity: 1, x: 0 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 22 }}
          >
            ✓ Seçildi
          </motion.div>
        )}
      </AnimatePresence>

      {/* Portrait — lifts a touch on hover; shards burst on selection. */}
      <div className="relative mb-3 flex justify-center">
        <motion.div
          className="relative"
          animate={{ scale: isSelected ? 1.08 : 1, y: isSelected ? -2 : 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 18 }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-2 bottom-0 h-6 rounded-full blur-xl transition-opacity duration-300"
            style={{ background: stats.color, opacity: isSelected ? 0.45 : 0.12 }}
          />
          <ClassPortrait cls={cls} height={124} />
        </motion.div>
        {isSelected && !reduce && (
          <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2">
            {BURST.map((b, i) => (
              <motion.span
                key={i}
                className="absolute block"
                style={{ width: b.s, height: b.s, background: stats.color, boxShadow: `0 0 6px ${stats.color}` }}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{ x: b.x, y: b.y, opacity: 0, scale: 0.4 }}
                transition={{ duration: 0.7, ease: EASE_OUT_EXPO }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Name */}
      <h2
        className="relative mb-1 font-pixel text-sm sm:text-base lg:text-lg xl:text-xl 2xl:text-2xl"
        style={{ color: stats.color, textShadow: isSelected ? `0 0 14px ${stats.color}88` : 'none' }}
      >
        {stats.label}
      </h2>
      <p className="relative mb-2 font-mono text-[8px] uppercase tracking-[0.3em] text-zinc-500 lg:text-[10px]">
        {CLASS_ROLES[cls]}
      </p>

      {/* Ability tooltip trigger */}
      {/* Nested <button> inside the card's <button> is invalid HTML and
          triggers a hydration error, so this is a span carrying button
          semantics — same behaviour, valid markup, still focusable. */}
      <span
        role="button"
        tabIndex={0}
        aria-expanded={tooltipOpen}
        className="relative mb-2 flex w-fit cursor-pointer items-center gap-1 font-pixel text-[9px] text-dm-gold/70 transition-colors hover:text-dm-gold lg:text-[10px] xl:text-[11px] 2xl:text-[13px]"
        onClick={(e) => {
          e.stopPropagation();
          onToggleTooltip(cls);
        }}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          e.preventDefault();
          e.stopPropagation();
          onToggleTooltip(cls);
        }}
      >
        <motion.span aria-hidden animate={{ rotate: tooltipOpen ? 45 : 0 }} transition={{ type: 'spring', stiffness: 400, damping: 18 }}>
          ✦
        </motion.span>{' '}
        Yetenek Bilgisi
      </span>

      {/* Ability tooltip */}
      <AnimatePresence initial={false}>
        {tooltipOpen && (
          <motion.div
            className="relative overflow-hidden"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}
          >
            <div
              className="mb-2 border-l-2 bg-dm-bg/80 px-3 py-2 text-[10px] leading-relaxed text-zinc-300 lg:text-sm xl:text-sm 2xl:text-base"
              style={{ borderColor: stats.color }}
            >
              {CLASS_ABILITIES[cls]}
            </div>
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
}

// ─── COUNTDOWN RING ───────────────────────────────────────
const RING_R = 26;
const RING_C = 2 * Math.PI * RING_R;

function CountdownRing({ countdown, urgent }: { countdown: number; urgent: boolean }) {
  const color = urgent ? '#ef4444' : '#8b5cf6';
  const frac = countdown / COUNTDOWN_SECONDS;
  return (
    <motion.div
      className="relative h-14 w-14 sm:h-16 sm:w-16 lg:h-20 lg:w-20"
      animate={urgent ? { scale: [1, 1.08, 1] } : { scale: 1 }}
      transition={urgent ? { duration: 1, repeat: Infinity } : { duration: 0.3 }}
    >
      <svg viewBox="0 0 64 64" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden>
        <circle cx="32" cy="32" r={RING_R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
        <motion.circle
          cx="32"
          cy="32"
          r={RING_R}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="butt"
          strokeDasharray={RING_C}
          initial={{ strokeDashoffset: 0 }}
          animate={{ strokeDashoffset: RING_C * (1 - frac) }}
          transition={{ duration: 0.9, ease: 'linear' }}
          style={{ filter: `drop-shadow(0 0 4px ${color})` }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={countdown}
            className="font-pixel text-base sm:text-lg lg:text-xl 2xl:text-2xl"
            style={{ color }}
            initial={{ y: '-120%', opacity: 0 }}
            animate={{ y: '0%', opacity: 1 }}
            exit={{ y: '120%', opacity: 0 }}
            transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}
          >
            {countdown}
          </motion.span>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

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

  const handleToggleTooltip = useCallback((cls: PlayerClass) => {
    setShowAbilityTooltip((prev) => (prev === cls ? null : cls));
  }, []);

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

  const urgent = countdown <= 5;
  const accent = selected ? CLASS_STATS[selected].color : '#8b5cf6';

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-dm-bg px-4 py-8">
      {/* Background — the room takes on the chosen class's colour. */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-dm-accent/5 via-transparent to-dm-gold/5" />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[60%] h-[70vmin] w-[120vmin] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[120px]"
        animate={{ backgroundColor: accent, opacity: selected ? 0.14 : 0.06 }}
        transition={{ duration: 0.8, ease: EASE_OUT_EXPO }}
      />
      <div className="dm-scanlines" aria-hidden />
      <div className="dm-vignette" aria-hidden />

      {/* Countdown timer */}
      <motion.div
        className="z-20 mb-4 flex flex-col items-center gap-2"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: EASE_OUT_EXPO }}
      >
        <CountdownRing countdown={countdown} urgent={urgent} />
      </motion.div>

      <span className="z-10 mb-2 flex items-center gap-3 font-mono text-[9px] uppercase tracking-[0.45em] text-zinc-500 sm:text-[10px]">
        <motion.span
          className="block h-px w-6 origin-right bg-dm-accent/60"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.1, duration: 0.8, ease: EASE_OUT_EXPO }}
        />
        <MaskReveal delay={0.05} duration={0.7}>Kahramanını Seç</MaskReveal>
        <motion.span
          className="block h-px w-6 origin-left bg-dm-accent/60"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.1, duration: 0.8, ease: EASE_OUT_EXPO }}
        />
      </span>

      <h1
        className="z-10 mb-2 font-pixel text-lg text-dm-accent sm:text-2xl lg:text-3xl 2xl:text-4xl"
        style={{ textShadow: '0 0 24px rgba(139,92,246,0.45)' }}
      >
        <SplitReveal text="Sınıf Seç" delay={0.12} stagger={0.045} />
      </h1>

      <p className="z-10 mb-6 font-pixel text-[10px] text-zinc-400 sm:mb-8 lg:text-sm xl:text-sm 2xl:text-base">
        <MaskReveal delay={0.35}>Hangi sınıfla dalacaksın?</MaskReveal>
      </p>

      {/* Class cards — stack vertically on small screens, horizontal on larger */}
      <LayoutGroup>
        <div
          ref={scrollContainerRef}
          className="z-10 flex w-full max-w-4xl flex-col gap-3 px-2 pb-2 pt-2 sm:flex-row sm:snap-x sm:snap-mandatory sm:gap-6 sm:overflow-x-auto lg:gap-8 2xl:max-w-6xl 2xl:gap-10"
        >
          {CLASSES.map((cls, i) => (
            <ClassCard
              key={cls}
              cls={cls}
              index={i}
              isSelected={selected === cls}
              isReady={isReady}
              tooltipOpen={showAbilityTooltip === cls}
              onSelect={handleSelect}
              onHover={setHoveredClass}
              onToggleTooltip={handleToggleTooltip}
            />
          ))}
        </div>
      </LayoutGroup>

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
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: selected ? 1 : 0.35, y: 0, scale: selected && !isReady ? 1.04 : 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20, delay: selected ? 0 : 0.8 }}
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

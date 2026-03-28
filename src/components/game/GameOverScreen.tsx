'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { PixelButton } from '@/components/ui/PixelButton';

const EASE = [0.22, 1, 0.36, 1] as const;

type GameOverStats = {
  monstersKilled: number;
  damageDealt: number;
  goldCollected: number;
  floorsCleared: number;
  timePlayed: number;
  level: number;
  deaths: number;
  isMVP: boolean;
};

type GameOverScreenProps = {
  result: 'victory' | 'defeat';
  stats: GameOverStats;
  isSolo?: boolean;
  soloDeathsRemaining?: number;
  onPlayAgain: () => void;
  onMainMenu: () => void;
};

function ConfettiParticle({ index }: { index: number }) {
  const style = useMemo(() => {
    const colors = ['#f59e0b', '#8b5cf6', '#10b981', '#ef4444', '#3b82f6', '#ec4899', '#06b6d4'];
    return {
      left: `${(index * 13 + 7) % 100}%`,
      color: colors[index % colors.length],
      size: 4 + (index % 4) * 2,
      duration: 2.5 + (index % 4) * 0.5,
      delay: (index * 0.12) % 2.5,
      rotation: index * 37,
    };
  }, [index]);

  return (
    <motion.div
      className="absolute top-0"
      style={{
        left: style.left,
        width: style.size,
        height: style.size,
        backgroundColor: style.color,
      }}
      initial={{ y: -20, opacity: 1, rotate: 0 }}
      animate={{
        y: '100vh',
        opacity: [1, 1, 1, 0],
        rotate: style.rotation + 720,
        x: [0, (index % 2 === 0 ? 40 : -40), (index % 3 === 0 ? -20 : 20), 0],
      }}
      transition={{
        duration: style.duration,
        delay: style.delay,
        repeat: Infinity,
        ease: 'linear',
      }}
    />
  );
}

function SoundRing({ delay, isVictory }: { delay: number; isVictory: boolean }) {
  return (
    <motion.div
      className="absolute left-1/2 top-1/2 rounded-full border-2"
      style={{
        borderColor: isVictory ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)',
      }}
      initial={{ width: 0, height: 0, x: '-50%', y: '-50%', opacity: 0.6 }}
      animate={{
        width: 600,
        height: 600,
        x: '-50%',
        y: '-50%',
        opacity: 0,
      }}
      transition={{
        duration: 3,
        delay,
        repeat: Infinity,
        ease: 'easeOut',
      }}
    />
  );
}

function StarRating({ stars }: { stars: number }) {
  const items = [0, 1, 2] as const;
  return (
    <div className="flex items-center gap-2">
      {items.map((i) => (
        <motion.span
          key={i}
          className="text-2xl sm:text-3xl"
          initial={{ scale: 0, rotate: -180 }}
          animate={{
            scale: i < stars ? 1 : 0.6,
            rotate: 0,
            opacity: i < stars ? 1 : 0.2,
          }}
          transition={{
            delay: 1.2 + i * 0.2,
            duration: 0.5,
            ease: EASE,
            type: 'spring',
            stiffness: 200,
          }}
        >
          {i < stars ? '\u2B50' : '\u2606'}
        </motion.span>
      ))}
    </div>
  );
}

function SkullAnimation() {
  return (
    <motion.div
      className="text-5xl sm:text-6xl"
      initial={{ scale: 0, rotate: -30 }}
      animate={{ scale: [0, 1.3, 1], rotate: [-30, 10, 0] }}
      transition={{ delay: 0.5, duration: 0.6, ease: EASE }}
    >
      <motion.span
        animate={{ opacity: [1, 0.6, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        💀
      </motion.span>
    </motion.div>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins} dk ${secs} sn`;
}

export function GameOverScreen({
  result,
  stats,
  isSolo = false,
  soloDeathsRemaining = 0,
  onPlayAgain,
  onMainMenu,
}: GameOverScreenProps) {
  const isVictory = result === 'victory';
  const confettiCount = isVictory ? 25 : 0;
  const confettiIndices = useMemo(
    () => Array.from({ length: confettiCount }, (_, i) => i),
    [confettiCount],
  );

  const starCount = stats.deaths === 0 ? 3 : stats.deaths === 1 ? 2 : 1;

  // Calculate total XP (estimate based on kills and floors)
  const totalXP = stats.monstersKilled * 10 + stats.floorsCleared * 50;

  const statRows = useMemo(() => {
    const rows: Array<{ label: string; value: string | number; icon: string }> = [
      { label: 'Canavarlar Öldürüldü', value: stats.monstersKilled, icon: '💀' },
      { label: 'Toplam Hasar', value: stats.damageDealt, icon: '⚔️' },
      { label: 'Altın Toplandı', value: stats.goldCollected, icon: '🪙' },
      { label: 'Ulaşılan Kat', value: stats.floorsCleared, icon: '🏰' },
      { label: 'Süre', value: formatTime(stats.timePlayed), icon: '⏱️' },
      { label: 'Seviye', value: stats.level, icon: '⭐' },
      { label: 'Toplam XP', value: totalXP, icon: '✨' },
    ];
    if (isSolo) {
      rows.push({ label: 'Kalan Can', value: `${soloDeathsRemaining}/3`, icon: '❤️' });
    }
    return rows;
  }, [stats, totalXP, isSolo, soloDeathsRemaining]);

  const ringDelays = [0, 1, 2] as const;

  return (
    <motion.div
      className="absolute inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/80 backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Sound wave rings */}
      {ringDelays.map((d) => (
        <SoundRing key={d} delay={d} isVictory={isVictory} />
      ))}

      {/* Confetti */}
      {confettiIndices.map((i) => (
        <ConfettiParticle key={i} index={i} />
      ))}

      <motion.div
        className="relative z-10 flex w-full max-w-md flex-col items-center gap-5 px-4"
        initial={{ scale: 0.5, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: EASE, delay: 0.15 }}
      >
        {/* Title */}
        <motion.h1
          className={`font-pixel text-4xl sm:text-6xl ${
            isVictory ? 'glow-gold text-dm-gold' : 'text-dm-health'
          }`}
          initial={{ scale: 0.3, opacity: 0 }}
          animate={
            isVictory
              ? { scale: [0.3, 1.15, 1], opacity: 1 }
              : { scale: [0.3, 1], opacity: 1, x: [0, -4, 4, -3, 3, -1, 1, 0] }
          }
          transition={
            isVictory
              ? { duration: 0.8, ease: EASE }
              : { duration: 0.7, ease: EASE }
          }
        >
          {isVictory ? 'ZAFER!' : 'YENILDIN!'}
        </motion.h1>

        {/* Victory: pulse glow, Defeat: skull */}
        {isVictory ? (
          <motion.div
            className="font-pixel text-[10px] text-dm-gold/80"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            Zindanı fethettin, kahraman!
          </motion.div>
        ) : (
          <>
            <SkullAnimation />
            <motion.p
              className="font-pixel text-[9px] text-zinc-500"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
            >
              Her kahraman düşer... önemli olan kalkmaktır!
            </motion.p>
          </>
        )}

        {/* Stars (victory only) */}
        {isVictory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
          >
            <StarRating stars={starCount} />
          </motion.div>
        )}

        {/* MVP badge */}
        {stats.isMVP && (
          <motion.div
            className="rounded border border-dm-gold/40 bg-dm-gold/10 px-4 py-1"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 1.5, ease: EASE }}
          >
            <span className="font-pixel text-[10px] text-dm-gold">
              ⭐ MVP ⭐
            </span>
          </motion.div>
        )}

        {/* Stats — scrollable on small screens */}
        <motion.div
          className={`pixel-border max-h-[40vh] w-full overflow-y-auto rounded p-4 sm:max-h-none ${
            isVictory ? 'bg-dm-surface' : 'bg-dm-surface/70'
          }`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: isVictory ? 1.4 : 1.2, ease: EASE }}
        >
          <p className="mb-3 font-pixel text-[10px] text-dm-accent">
            İstatistikler
          </p>
          <div className="flex flex-col gap-2.5">
            {statRows.map((row, i) => (
              <motion.div
                key={row.label}
                className="flex items-center justify-between"
                initial={{ x: -15, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{
                  delay: (isVictory ? 1.6 : 1.4) + i * 0.1,
                  ease: EASE,
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{row.icon}</span>
                  <span
                    className={`font-pixel text-[8px] ${
                      isVictory ? 'text-zinc-300' : 'text-zinc-500'
                    }`}
                  >
                    {row.label}
                  </span>
                </div>
                <span
                  className={`font-pixel text-[10px] ${
                    isVictory ? 'text-dm-gold' : 'text-zinc-400'
                  }`}
                >
                  {row.value}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Buttons */}
        <motion.div
          className="flex w-full gap-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: isVictory ? 2.2 : 2 }}
        >
          <PixelButton
            variant={isVictory ? 'gold' : 'primary'}
            fullWidth
            onClick={onPlayAgain}
          >
            {isVictory ? 'Tekrar Oyna' : 'Tekrar Dene'}
          </PixelButton>
          <PixelButton variant="secondary" fullWidth onClick={onMainMenu}>
            Ana Menü
          </PixelButton>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

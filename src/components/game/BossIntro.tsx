'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const EASE = [0.22, 1, 0.36, 1] as const;
const AUTO_COMPLETE_MS = 7000;
const PARTICLE_COUNT = 30;
const BOSS_DATA: Record<string, { name: string; title: string; dialogue: string[]; color: string; emoji: string; battleText: string }> = {
  forge: {
    name: 'DEMIRCI KORUYUCU',
    title: 'Zephara\'nın Baş Ustası',
    dialogue: [
      'Bu örsün sesi... altı yüz yıldır susmadı.',
      'Geçmek istiyorsanız, ateşten geçeceksiniz.',
    ],
    color: '#f97316',
    emoji: '🔨',
    battleText: 'SAVAŞ BAŞLIYOR!',
  },
  mid: {
    name: 'SELVİRA',
    title: 'Zephara\'nın Dokumacısı',
    dialogue: [
      'Kapıları... kapalı tutmalıyım...',
      'Geçmeyin... aşağısı... daha kötü...',
    ],
    color: '#7c3aed',
    emoji: '🕸️',
    battleText: 'SAVAŞ BAŞLIYOR!',
  },
  stone: {
    name: 'TAŞ MUHAFIZ',
    title: 'Bahçelerin Bekçisi',
    dialogue: [
      'Bir zamanlar çiçekler büyütürdüm.',
      'Şimdi sadece taş büyütüyorum.',
    ],
    color: '#6b7280',
    emoji: '🗿',
    battleText: 'SAVAŞ BAŞLIYOR!',
  },
  flame: {
    name: 'ALEV ŞÖVALYESİ',
    title: 'Karanmir\'in Son Muhafızı',
    dialogue: [
      'Kralımız için. Zephara için.',
      'Bu koridordan kimse geçemez.',
    ],
    color: '#b91c1c',
    emoji: '🔥',
    battleText: 'SAVAŞ BAŞLIYOR!',
  },
  final: {
    name: 'KARANMİR',
    title: 'Ateş-i Kadim\'in Esiri',
    dialogue: [
      'Ben... onları koruyacaktım.',
      'Ama ateş... ateş her şeyi aldı.',
      'Durdurun beni... lütfen...',
    ],
    color: '#dc2626',
    emoji: '👑',
    battleText: 'SON PERDE',
  },
};

const FLOOR_TO_BOSS: Record<number, string> = {
  3: 'forge',
  5: 'mid',
  7: 'stone',
  8: 'flame',
  10: 'final',
};
const DIALOGUE_INTERVAL_MS = 1400;

type BossIntroProps = {
  onComplete: () => void;
  floor?: number;
};

type Particle = {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  color: string;
};

function generateParticles(): Particle[] {
  const colors = [
    'rgba(139, 92, 246, 0.5)',
    'rgba(220, 38, 38, 0.4)',
    'rgba(168, 85, 247, 0.35)',
    'rgba(185, 28, 28, 0.45)',
  ];
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 2 + Math.random() * 4,
    duration: 2 + Math.random() * 3,
    delay: Math.random() * 2,
    color: colors[i % colors.length],
  }));
}

function EnergyRing({ delay }: { delay: number }) {
  return (
    <motion.div
      className="absolute left-1/2 top-1/2 rounded-full border-2"
      style={{ borderColor: 'rgba(239, 68, 68, 0.2)' }}
      initial={{ width: 0, height: 0, x: '-50%', y: '-50%', opacity: 0.7 }}
      animate={{
        width: 800,
        height: 800,
        x: '-50%',
        y: '-50%',
        opacity: 0,
      }}
      transition={{
        duration: 2.5,
        delay: 2.5 + delay * 0.4,
        ease: 'easeOut',
      }}
    />
  );
}

function LightningFlash({ delay }: { delay: number }) {
  return (
    <motion.div
      className="pointer-events-none absolute inset-0 bg-red-600/20"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 0.6, 0, 0.3, 0] }}
      transition={{ duration: 0.4, delay, ease: 'easeOut' }}
    />
  );
}

export function BossIntro({ onComplete, floor }: BossIntroProps) {
  const bossKey = FLOOR_TO_BOSS[floor ?? 10] ?? 'final';
  const boss = BOSS_DATA[bossKey];
  const particles = useMemo(generateParticles, []);
  const nameLetters = useMemo(() => boss.name.split(''), [boss.name]);
  const ringDelays = useMemo(() => [0, 1, 2] as const, []);

  const handleSkip = useCallback(() => {
    onComplete();
  }, [onComplete]);

  // Auto-complete after 5 seconds
  useEffect(() => {
    const timer = setTimeout(onComplete, AUTO_COMPLETE_MS);
    return () => clearTimeout(timer);
  }, [onComplete]);

  // Skip on Enter or click
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') handleSkip();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSkip]);

  return (
    <motion.div
      className="fixed inset-0 z-[92] flex items-center justify-center overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: EASE }}
      onClick={handleSkip}
    >
      {/* Dark red/black gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-black via-red-950/90 to-black" />

      {/* Vignette effect */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 30%, rgba(0, 0, 0, 0.85) 100%)',
        }}
      />

      {/* Screen shake container */}
      <motion.div
        className="absolute inset-0"
        animate={{
          x: [0, -6, 5, -4, 3, -2, 1, 0],
          y: [0, 4, -5, 3, -3, 2, -1, 0],
        }}
        transition={{ duration: 0.5, delay: 0.4, ease: 'easeOut' }}
      >
        {/* Red ambient glow pulse */}
        <motion.div
          className="pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(220, 38, 38, 0.25) 0%, transparent 70%)',
          }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{
            scale: [0, 1.2, 0.9, 1.1, 1],
            opacity: [0, 0.8, 0.5, 0.7, 0.6],
          }}
          transition={{ duration: 1.5, delay: 0.3, ease: EASE }}
        />

        {/* Lightning flashes */}
        <LightningFlash delay={0.3} />
        <LightningFlash delay={0.8} />
        <LightningFlash delay={1.5} />

        {/* Background particles */}
        {particles.map((p) => (
          <motion.div
            key={p.id}
            className="absolute rounded-full"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: p.size,
              height: p.size,
              backgroundColor: p.color,
            }}
            animate={{
              y: [0, -60, 0],
              opacity: [0, 0.7, 0],
              scale: [0.5, 1.2, 0.5],
            }}
            transition={{
              duration: p.duration,
              delay: p.delay,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        ))}

        {/* Energy rings */}
        {ringDelays.map((d) => (
          <EnergyRing key={d} delay={d} />
        ))}
      </motion.div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-4">
        {/* Skull slam */}
        <motion.div
          className="text-6xl sm:text-7xl lg:text-8xl 2xl:text-9xl"
          initial={{ scale: 4, opacity: 0, y: -100 }}
          animate={{ scale: [4, 0.8, 1.1, 1], opacity: [0, 1, 1, 1], y: 0 }}
          transition={{ duration: 0.6, delay: 0.5, ease: EASE }}
        >
          <motion.span
            animate={{ opacity: [1, 0.6, 1], filter: ['brightness(1)', 'brightness(1.5)', 'brightness(1)'] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            {boss.emoji}
          </motion.span>
        </motion.div>

        {/* Boss name — letter by letter */}
        <motion.div
          className="flex gap-1 sm:gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          {nameLetters.map((letter, i) => (
            <motion.span
              key={i}
              className="font-pixel text-3xl text-dm-health sm:text-4xl lg:text-5xl xl:text-6xl 2xl:text-7xl"
              style={{
                textShadow:
                  '0 0 20px rgba(239, 68, 68, 0.8), 0 0 40px rgba(220, 38, 38, 0.5)',
              }}
              initial={{ opacity: 0, y: -20, scale: 0.5 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                delay: 1 + i * 0.08,
                duration: 0.3,
                ease: EASE,
              }}
            >
              {letter}
            </motion.span>
          ))}
        </motion.div>

        {/* Subtitle */}
        <motion.p
          className="font-pixel text-[10px] tracking-widest text-red-400/80 lg:text-sm xl:text-sm 2xl:text-base"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5, duration: 0.4, ease: EASE }}
        >
          {boss.title}
        </motion.p>

        {/* Dialogue */}
        <motion.div
          className="mt-2 max-w-md px-4 text-center lg:max-w-lg"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2, duration: 0.6, ease: EASE }}
        >
          <p
            className="font-pixel text-[9px] leading-relaxed text-red-300/90 lg:text-[11px] xl:text-[12px] 2xl:text-[14px]"
            style={{
              textShadow: '0 0 12px rgba(239, 68, 68, 0.4)',
            }}
          >
            &ldquo;{boss.dialogue.join(' ')}&rdquo;
          </p>
        </motion.div>

        {/* "SAVAS BASLIYOR!" flash text */}
        <motion.h2
          className="mt-4 font-pixel text-2xl text-dm-gold sm:text-3xl lg:text-4xl xl:text-5xl 2xl:text-6xl"
          style={{
            textShadow:
              '0 0 20px rgba(245, 158, 11, 0.8), 0 0 40px rgba(245, 158, 11, 0.4), 0 0 60px rgba(245, 158, 11, 0.2)',
          }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{
            opacity: [0, 1, 0.7, 1],
            scale: [0.5, 1.2, 0.95, 1],
          }}
          transition={{ delay: 3, duration: 0.6, ease: EASE }}
        >
          {boss.battleText}
        </motion.h2>

        {/* Skip hint */}
        <motion.p
          className="mt-6 font-pixel text-[7px] text-zinc-600 lg:text-[9px] xl:text-[10px] 2xl:text-[12px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          transition={{ delay: 3.5, duration: 0.3 }}
        >
          Atlamak i\u00e7in t\u0131kla veya Enter&apos;a bas
        </motion.p>
      </div>

      {/* Final fade out */}
      <motion.div
        className="pointer-events-none absolute inset-0 bg-black"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 4.5, duration: 0.5, ease: EASE }}
      />
    </motion.div>
  );
}

'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';

const EASE = [0.22, 1, 0.36, 1] as const;

type LoadingScreenProps = {
  message: string;
  subMessage?: string;
  floor?: number;
};

const GAME_TIPS: Record<number, readonly string[]> = {
  0: [
    'Savaşçı en önde, büyücü en arkada durmalı.',
    'Can iksirini doğru zamanda topla — israf etme.',
    'Kapılar ancak tüm canavarlar temizlenince açılır.',
    'Boss\'un saldırı kalıplarını öğren, sonra vur.',
    'Okçu hızlıdır — keşif görevi için idealdir.',
    'Takım arkadaşın düşerse onu yalnız bırakma.',
    'Altın toplamak skoru artırır.',
    'Her katta canavarlar daha güçlü olur — hazırlıklı ol.',
  ],
  1: [
    'İlk kat — acele etme, kontrollere alış.',
    'İskeletler yavaştır ama güçlüdür — mesafe koru.',
    'Slime\'lar kolay ama sürü halinde tehlikeli.',
  ],
  2: [
    'İkinci katta yarasalar var — hızlı hareket et!',
    'Goblinler gruplarda saldırır — dikkatli ol.',
    'Mana iksirlerini büyücüye bırak.',
  ],
  3: [
    'Üçüncü kat çok daha zor — hazırlıklı ol!',
    'Boss odası yaklaşıyor — iksir biriktir.',
    'Takım koordinasyonu burada çok önemli.',
  ],
} as const;

// Pixel particles
const PARTICLE_COUNT = 12;

type Particle = {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
};

function generateParticles(): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 2 + Math.random() * 4,
    duration: 2 + Math.random() * 3,
    delay: Math.random() * 2,
  }));
}

export function LoadingScreen({ message, subMessage, floor }: LoadingScreenProps) {
  const [dotCount, setDotCount] = useState(0);
  const particles = useMemo(generateParticles, []);

  const tip = useMemo(() => {
    const floorTips = floor && GAME_TIPS[floor] ? GAME_TIPS[floor] : GAME_TIPS[0];
    const index = Math.floor(Math.random() * floorTips.length);
    return floorTips[index];
  }, [floor]);

  // Animate dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDotCount((prev) => (prev + 1) % 4);
    }, 400);
    return () => clearInterval(interval);
  }, []);

  const dots = '.'.repeat(dotCount);

  return (
    <motion.div
      className="fixed inset-0 z-[90] flex flex-col items-center justify-center bg-dm-bg"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      {/* Particles */}
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute bg-dm-accent/30"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [0.2, 0.6, 0.2],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}

      {/* Dungeon door animation */}
      <div className="relative mb-8 flex h-28 w-20 items-end justify-center overflow-hidden sm:h-36 sm:w-24">
        {/* Door frame */}
        <div className="absolute inset-0 rounded-t-lg border-4 border-dm-border bg-dm-surface">
          {/* Arch top */}
          <div className="absolute -top-1 left-1/2 h-6 w-14 -translate-x-1/2 rounded-t-full border-4 border-dm-border bg-dm-bg sm:w-16" />
        </div>

        {/* Left door */}
        <motion.div
          className="absolute bottom-0 left-1 top-6 w-[calc(50%-2px)] border-2 border-dm-border bg-dm-bg"
          animate={{ rotateY: [0, -60, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: EASE }}
          style={{ transformOrigin: 'left center' }}
        >
          {/* Door handle */}
          <div className="absolute right-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-dm-gold" />
        </motion.div>

        {/* Right door */}
        <motion.div
          className="absolute bottom-0 right-1 top-6 w-[calc(50%-2px)] border-2 border-dm-border bg-dm-bg"
          animate={{ rotateY: [0, 60, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: EASE }}
          style={{ transformOrigin: 'right center' }}
        >
          {/* Door handle */}
          <div className="absolute left-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-dm-gold" />
        </motion.div>

        {/* Glow behind doors */}
        <motion.div
          className="absolute bottom-0 left-2 right-2 top-8 bg-dm-accent/10"
          animate={{ opacity: [0.05, 0.2, 0.05] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Floor indicator */}
      {floor && (
        <motion.p
          className="glow-gold mb-4 font-pixel text-lg text-dm-gold sm:text-xl"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: [0.8, 1.1, 1], opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5, ease: EASE }}
        >
          Kat {floor}
        </motion.p>
      )}

      {/* Loading text */}
      <p className="font-pixel text-xs text-white sm:text-sm">
        {message}
        <span className="inline-block w-6 text-left">{dots}</span>
      </p>

      {subMessage && (
        <p className="mt-2 font-body text-xs text-zinc-500">{subMessage}</p>
      )}

      {/* Ambient glow behind the door */}
      <motion.div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-dm-accent/[0.06] blur-[100px]"
        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Tip */}
      <div className="mt-8 max-w-xs px-4 text-center sm:max-w-sm">
        <p className="font-pixel text-[8px] text-dm-gold sm:text-[9px]">İpucu</p>
        <p className="mt-2 font-body text-[11px] leading-relaxed text-zinc-400 sm:text-xs">
          {tip}
        </p>
      </div>
    </motion.div>
  );
}

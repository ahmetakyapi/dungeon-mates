'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PixelButton } from '@/components/ui/PixelButton';

const EASE = [0.22, 1, 0.36, 1] as const;
const PARTICLE_COUNT = 30;
const LINE_INTERVAL_MS = 1500;
const AUTO_ADVANCE_MS = 12000;
const FLOOR_AUTO_ADVANCE_MS = 4000;

type StoryIntroProps = {
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

const STORY_LINES = [
  'Yerin yedi kat altında, güneşin ulaşamadığı bir şehir vardı.',
  'Zephara — Ateş-i Kadim\'in ışığıyla parlayan bir medeniyet.',
  'Kral Karanmir, sönen ateşi kurtarmak için bedenini yakıt olarak sundu.',
  'Ritüel başarısız oldu. Ateş yenilendi ama dönüştü. Halk canavar oldu. Kral... başka bir şeye.',
  'Altı yüz yıl sonra kapılar tekrar açılıyor. Ve sen, ilk adımı atan kişisin.',
] as const;

const FLOOR_INTROS: Record<number, { name: string; lore: string }> = {
  1: { name: 'Yıkık Kapılar', lore: 'Zephara\'nın giriş kapıları çoktan çökmüş. Karanlıkta bir şeyler hareket ediyor...' },
  2: { name: 'Sessiz Sokaklar', lore: 'Evler boş, sokaklar sessiz. Ama iskeletler hâlâ nöbet tutuyor.' },
  3: { name: 'Demircinin Ocağı', lore: 'Eski dökümhaneler. Çekiçlerin sesi kesildi ama Demirci Koruyucu hâlâ burada.' },
  4: { name: 'Terkedilmiş Pazar', lore: 'Tezgahlar devrilmiş, altınlar saçılmış. Ama dokunma — gölgeler izliyor.' },
  5: { name: 'Dokuyucunun Evi', lore: 'Selvira\'nın karantina hattı. Devasa ağlar ve bir fısıltı: "Geçmeyin..."' },
  6: { name: 'Yıkık Kütüphane', lore: 'Zephara\'nın tüm bilgisi buradaydı. Şimdi sadece hayaletler okuyor.' },
  7: { name: 'Taş Bahçeler', lore: 'Bir zamanlar çiçekler açardı. Şimdi her şey taş ve sessizlik.' },
  8: { name: 'Lav Nehirleri', lore: 'Sıcaklık dayanılmaz. Magma arasında bir yol var — tek bir yol.' },
  9: { name: 'Ruhlar Tapınağı', lore: 'Dualar lanet oldu. Rahiplerin ruhları huzur arıyor — ve bulamıyor.' },
  10: { name: 'Taht Salonu', lore: 'Karanmir burada bekliyor. Altı yüz yıldır her saniyesini hatırlayarak, acı çekerek.' },
};

function generateParticles(): Particle[] {
  const colors = [
    'rgba(245, 158, 11, 0.25)',
    'rgba(139, 92, 246, 0.3)',
    'rgba(245, 158, 11, 0.15)',
    'rgba(16, 185, 129, 0.2)',
    'rgba(251, 191, 36, 0.2)',
  ];
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 1 + Math.random() * 4,
    duration: 3 + Math.random() * 4,
    delay: Math.random() * 2,
    color: colors[i % colors.length],
  }));
}

export function StoryIntro({ onComplete, floor }: StoryIntroProps) {
  const [visibleLines, setVisibleLines] = useState(0);
  const [showPrompt, setShowPrompt] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const particles = useMemo(generateParticles, []);

  const handleSkip = useCallback(() => {
    if (skipped) return;
    setSkipped(true);
    onComplete();
  }, [skipped, onComplete]);

  // Keyboard skip handler
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleSkip();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleSkip]);

  // Floor intro: auto-advance after 4s
  useEffect(() => {
    if (floor == null) return;
    const timer = setTimeout(onComplete, FLOOR_AUTO_ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [floor, onComplete]);

  // Main story: reveal lines one by one
  useEffect(() => {
    if (floor != null) return;

    if (visibleLines < STORY_LINES.length) {
      const timer = setTimeout(() => {
        setVisibleLines((prev) => prev + 1);
      }, visibleLines === 0 ? 1800 : LINE_INTERVAL_MS);
      return () => clearTimeout(timer);
    }

    // All lines shown — show prompt
    const promptTimer = setTimeout(() => setShowPrompt(true), 800);
    return () => clearTimeout(promptTimer);
  }, [visibleLines, floor]);

  // Main story: auto-advance after ~12s
  useEffect(() => {
    if (floor != null) return;
    const timer = setTimeout(onComplete, AUTO_ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [floor, onComplete]);

  // ── Floor-specific intro ──
  if (floor != null) {
    const floorData = FLOOR_INTROS[floor];
    if (!floorData) {
      onComplete();
      return null;
    }

    return (
      <motion.div
        className="fixed inset-0 z-[95] flex flex-col items-center justify-center overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
        onClick={handleSkip}
      >
        {/* Background */}
        <div className="absolute inset-0 bg-dm-bg" />

        {/* Ambient glow */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-dm-gold/[0.06] blur-[100px]" />

        {/* Particles */}
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
              y: [0, -30, 0],
              opacity: [0.05, 0.5, 0.05],
            }}
            transition={{
              duration: p.duration,
              delay: p.delay,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        ))}

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center gap-4 px-6 text-center">
          <motion.p
            className="font-pixel text-[9px] uppercase tracking-widest text-dm-accent lg:text-xs 2xl:text-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.4 }}
          >
            Kat {floor}
          </motion.p>

          <motion.h1
            className="glow-gold font-pixel text-3xl text-dm-gold sm:text-4xl lg:text-5xl xl:text-6xl 2xl:text-7xl"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: [0.6, 1.1, 1], opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.3, ease: EASE }}
          >
            {floorData.name}
          </motion.h1>

          <motion.p
            className="mt-2 max-w-md font-body text-sm leading-relaxed text-zinc-400 lg:text-base 2xl:text-lg"
            initial={{ y: 15, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.5, ease: EASE }}
          >
            {floorData.lore}
          </motion.p>

          {/* Auto-advance bar */}
          <motion.div className="mt-6 h-1 w-24 overflow-hidden rounded-full bg-dm-border">
            <motion.div
              className="h-full rounded-full bg-dm-gold"
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{
                duration: FLOOR_AUTO_ADVANCE_MS / 1000,
                ease: 'linear',
              }}
            />
          </motion.div>

          <motion.p
            className="mt-2 font-pixel text-[7px] text-zinc-600 lg:text-[9px] 2xl:text-[11px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            transition={{ delay: 1 }}
          >
            Tıkla veya Enter ile geç
          </motion.p>
        </div>
      </motion.div>
    );
  }

  // ── Main story intro ──
  return (
    <motion.div
      className="fixed inset-0 z-[95] flex flex-col items-center justify-center overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
      onClick={handleSkip}
    >
      {/* Background */}
      <div className="absolute inset-0 bg-dm-bg" />

      {/* Ambient glow — golden */}
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-dm-gold/[0.05] blur-[140px]" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-[300px] w-[600px] -translate-x-1/2 rounded-full bg-dm-accent/[0.04] blur-[100px]" />

      {/* Floating particles */}
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
            y: [0, -50, 0],
            x: [0, (p.id % 2 === 0 ? 10 : -10), 0],
            opacity: [0.05, 0.5, 0.05],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-6 px-6 text-center">
        {/* Title */}
        <motion.h1
          className="glow-gold font-pixel text-4xl text-dm-gold sm:text-5xl lg:text-6xl xl:text-7xl 2xl:text-8xl"
          initial={{ scale: 0.5, opacity: 0, y: -20 }}
          animate={{ scale: [0.5, 1.15, 1], opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE }}
        >
          ZEPHARA
        </motion.h1>

        {/* Divider */}
        <motion.div
          className="h-px w-48 bg-gradient-to-r from-transparent via-dm-gold/40 to-transparent lg:w-64"
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5, ease: EASE }}
        />

        {/* Story lines */}
        <div className="mt-4 flex max-w-lg flex-col gap-3 lg:max-w-xl">
          {STORY_LINES.map((line, i) => (
            <AnimatePresence key={i}>
              {i < visibleLines && (
                <motion.p
                  className="font-body text-sm leading-relaxed text-zinc-300 lg:text-base 2xl:text-lg"
                  initial={{ y: 15, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.6, ease: EASE }}
                >
                  {line}
                </motion.p>
              )}
            </AnimatePresence>
          ))}
        </div>

        {/* Ready prompt */}
        <AnimatePresence>
          {showPrompt && (
            <motion.div
              className="mt-6 flex flex-col items-center gap-4"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, ease: EASE }}
            >
              <p className="font-pixel text-[11px] text-dm-gold lg:text-sm 2xl:text-base">
                Hazır mısın?
              </p>

              <PixelButton
                variant="gold"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSkip();
                }}
              >
                Zephara'ya İn!
              </PixelButton>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Skip hint */}
        <motion.p
          className="mt-4 font-pixel text-[7px] text-zinc-600 lg:text-[9px] 2xl:text-[11px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          transition={{ delay: 2, duration: 0.5 }}
        >
          Enter ile geç
        </motion.p>
      </div>
    </motion.div>
  );
}

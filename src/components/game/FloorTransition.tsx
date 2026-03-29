'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const EASE = [0.22, 1, 0.36, 1] as const;
const AUTO_CONTINUE_MS = 5000;
const PARTICLE_COUNT = 20;

const FLOOR_LORE: Record<number, { name: string; lore: string; icon: string }> = {
  1: { name: 'Yıkık Kapılar', lore: 'Zephara\'nın çökmüş giriş kapıları. Haşereler her yerde.', icon: '🚪' },
  2: { name: 'Sessiz Sokaklar', lore: 'Bir zamanlar canlı mahalleler. İskeletler hâlâ nöbet tutuyor.', icon: '🏚️' },
  3: { name: 'Demircinin Ocağı', lore: 'Eski dökümhaneler. Demirci Koruyucu hâlâ çekicini sallıyor.', icon: '🔨' },
  4: { name: 'Terkedilmiş Pazar', lore: 'Eski ticaret merkezi. Tezgahlar devrilmiş, gölgeler hareket ediyor.', icon: '🏪' },
  5: { name: 'Dokuyucunun Evi', lore: 'Selvira\'nın karantina hattı. Devasa ağlar her yeri kaplamış.', icon: '🕸️' },
  6: { name: 'Yıkık Kütüphane', lore: 'Zephara\'nın bilgi hazinesi. Kitaplar çürümüş, ruhlar dolaşıyor.', icon: '📚' },
  7: { name: 'Taş Bahçeler', lore: 'Bir zamanlar yeşillik. Şimdi taşlaşmış ağaçlar ve gargoiller.', icon: '🗿' },
  8: { name: 'Lav Nehirleri', lore: 'Zephara\'nın en derin noktası. Magma arasında yol bul.', icon: '🌋' },
  9: { name: 'Ruhlar Tapınağı', lore: 'Rahiplerin lanetli duaları hâlâ yankılanıyor.', icon: '🕯️' },
  10: { name: 'Taht Salonu', lore: 'Karanmir burada bekliyor. Ateş-i Kadim\'in yozlaşmış ışığı son kez yanıyor.', icon: '👑' },
} as const;

const FLOOR_QUOTES: Record<number, string> = {
  1: 'Kapılar geçildi. Zephara seni içine çekiyor...',
  2: 'Sokaklar sessiz ama duvarlar hatırlıyor.',
  3: 'Tünellerin sonu görünmüyor. Karanlık kalınlaşıyor.',
  4: 'Pazarın sessizliği aldatıcı. Daha derinde bir şey var.',
  5: 'Kraliçe yenildi. Ama asıl tehlike daha aşağıda.',
  6: 'Bilgi güçtür. Ama buradaki bilgi lanetli.',
  7: 'Taş bahçeler geride kaldı. Sıcaklık artıyor.',
  8: 'Lavların arasından geçtin. Tapınak görünüyor.',
  9: 'Son engel aşıldı. Mor\'Khan\'la yüzleşme zamanı.',
} as const;

type FloorTransitionProps = {
  isVisible: boolean;
  completedFloor: number;
  nextFloor: number;
  monstersKilled?: number;
  timeSpent?: number;
  onContinue: () => void;
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
    'rgba(139, 92, 246, 0.4)',
    'rgba(245, 158, 11, 0.3)',
    'rgba(16, 185, 129, 0.3)',
    'rgba(59, 130, 246, 0.3)',
  ];
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 2 + Math.random() * 6,
    duration: 2 + Math.random() * 3,
    delay: Math.random() * 1.5,
    color: colors[i % colors.length],
  }));
}

export function FloorTransition({
  isVisible,
  completedFloor,
  nextFloor,
  monstersKilled = 0,
  timeSpent = 0,
  onContinue,
}: FloorTransitionProps) {
  const [showNext, setShowNext] = useState(false);
  const particles = useMemo(generateParticles, []);

  // Auto-continue after delay
  useEffect(() => {
    if (!isVisible) {
      setShowNext(false);
      return;
    }

    const nextTimer = setTimeout(() => setShowNext(true), 1200);
    const autoTimer = setTimeout(onContinue, AUTO_CONTINUE_MS);

    return () => {
      clearTimeout(nextTimer);
      clearTimeout(autoTimer);
    };
  }, [isVisible, onContinue]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed inset-0 z-[85] flex flex-col items-center justify-center overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          {/* Background */}
          <div className="absolute inset-0 bg-dm-bg" />

          {/* Ambient glow */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-dm-accent/[0.08] blur-[120px]" />

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
                y: [0, -40, 0],
                opacity: [0.1, 0.6, 0.1],
                scale: [1, 1.3, 1],
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
          <div className="relative z-10 flex flex-col items-center gap-6">
            {/* Completed floor */}
            <motion.div
              className="flex flex-col items-center gap-2"
              initial={{ y: -30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.6, ease: EASE }}
            >
              <motion.p
                className="font-pixel text-[10px] uppercase tracking-widest text-dm-xp lg:text-sm xl:text-sm 2xl:text-base"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                Kat Tamamlandı!
              </motion.p>
              <motion.h1
                className="glow-gold font-pixel text-4xl text-dm-gold sm:text-5xl lg:text-6xl xl:text-7xl 2xl:text-8xl"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: [0.5, 1.15, 1], opacity: 1 }}
                transition={{ duration: 0.7, delay: 0.2, ease: EASE }}
              >
                Kat {completedFloor}
              </motion.h1>

              {/* Completed floor name & lore */}
              {FLOOR_LORE[completedFloor] && (
                <motion.div
                  className="mt-2 flex flex-col items-center gap-1"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.5, ease: EASE }}
                >
                  <span className="font-pixel text-[11px] text-dm-accent lg:text-sm xl:text-base 2xl:text-lg">
                    {FLOOR_LORE[completedFloor].icon} {FLOOR_LORE[completedFloor].name}
                  </span>
                  <span className="font-body text-[10px] italic text-zinc-500 lg:text-xs xl:text-sm 2xl:text-base">
                    {FLOOR_LORE[completedFloor].lore}
                  </span>
                </motion.div>
              )}
            </motion.div>

            {/* Mini stats */}
            <motion.div
              className="flex gap-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.4 }}
            >
              {monstersKilled > 0 && (
                <div className="flex flex-col items-center gap-1">
                  <span className="text-lg lg:text-xl 2xl:text-2xl">💀</span>
                  <span className="font-pixel text-[10px] text-zinc-300 lg:text-sm xl:text-sm 2xl:text-base">
                    {monstersKilled}
                  </span>
                  <span className="font-pixel text-[7px] text-zinc-600 lg:text-[9px] xl:text-[10px] 2xl:text-[12px]">
                    Canavar
                  </span>
                </div>
              )}
              {timeSpent > 0 && (
                <div className="flex flex-col items-center gap-1">
                  <span className="text-lg lg:text-xl 2xl:text-2xl">⏱️</span>
                  <span className="font-pixel text-[10px] text-zinc-300 lg:text-sm xl:text-sm 2xl:text-base">
                    {formatTime(timeSpent)}
                  </span>
                  <span className="font-pixel text-[7px] text-zinc-600 lg:text-[9px] xl:text-[10px] 2xl:text-[12px]">
                    Süre
                  </span>
                </div>
              )}
            </motion.div>

            {/* Motivational quote */}
            {FLOOR_QUOTES[completedFloor] && (
              <motion.p
                className="max-w-xs text-center font-body text-[10px] italic text-dm-gold/60 lg:text-xs xl:text-sm 2xl:text-base"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7, duration: 0.5, ease: EASE }}
              >
                &ldquo;{FLOOR_QUOTES[completedFloor]}&rdquo;
              </motion.p>
            )}

            {/* Divider */}
            <motion.div
              className="section-divider w-40"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.8, duration: 0.4, ease: EASE }}
            />

            {/* Next floor reveal */}
            <AnimatePresence>
              {showNext && (
                <motion.div
                  className="flex flex-col items-center gap-2"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.5, ease: EASE }}
                >
                  <p className="font-pixel text-[9px] text-zinc-500 lg:text-[11px] xl:text-[12px] 2xl:text-[14px]">
                    Sonraki Kat
                  </p>
                  <motion.h2
                    className="glow-purple font-pixel text-2xl text-dm-accent sm:text-3xl lg:text-4xl xl:text-5xl 2xl:text-6xl"
                    initial={{ scale: 0.8 }}
                    animate={{ scale: [0.8, 1.1, 1] }}
                    transition={{ duration: 0.5, ease: EASE }}
                  >
                    Kat {nextFloor}
                  </motion.h2>

                  {/* Next floor name & lore */}
                  {FLOOR_LORE[nextFloor] && (
                    <motion.div
                      className="mt-1 flex flex-col items-center gap-1"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3, duration: 0.5, ease: EASE }}
                    >
                      <span className="font-pixel text-[11px] text-dm-gold lg:text-sm xl:text-base 2xl:text-lg">
                        {FLOOR_LORE[nextFloor].icon} {FLOOR_LORE[nextFloor].name}
                      </span>
                      <span className="max-w-xs text-center font-body text-[10px] italic text-zinc-500 lg:text-xs xl:text-sm 2xl:text-base">
                        {FLOOR_LORE[nextFloor].lore}
                      </span>
                    </motion.div>
                  )}

                  {/* Auto-continue indicator */}
                  <motion.div
                    className="mt-4 h-1 w-24 overflow-hidden rounded-full bg-dm-border"
                  >
                    <motion.div
                      className="h-full rounded-full bg-dm-accent"
                      initial={{ width: '0%' }}
                      animate={{ width: '100%' }}
                      transition={{
                        duration: (AUTO_CONTINUE_MS - 1200) / 1000,
                        ease: 'linear',
                      }}
                    />
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const EASE = [0.22, 1, 0.36, 1] as const;
const AUTO_CONTINUE_MS = 3000;
const PARTICLE_COUNT = 20;

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
                className="font-pixel text-[10px] uppercase tracking-widest text-dm-xp"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                Kat Tamamlandı!
              </motion.p>
              <motion.h1
                className="glow-gold font-pixel text-4xl text-dm-gold sm:text-5xl"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: [0.5, 1.15, 1], opacity: 1 }}
                transition={{ duration: 0.7, delay: 0.2, ease: EASE }}
              >
                Kat {completedFloor}
              </motion.h1>
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
                  <span className="text-lg">💀</span>
                  <span className="font-pixel text-[10px] text-zinc-300">
                    {monstersKilled}
                  </span>
                  <span className="font-pixel text-[7px] text-zinc-600">
                    Canavar
                  </span>
                </div>
              )}
              {timeSpent > 0 && (
                <div className="flex flex-col items-center gap-1">
                  <span className="text-lg">⏱️</span>
                  <span className="font-pixel text-[10px] text-zinc-300">
                    {formatTime(timeSpent)}
                  </span>
                  <span className="font-pixel text-[7px] text-zinc-600">
                    Süre
                  </span>
                </div>
              )}
            </motion.div>

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
                  <p className="font-pixel text-[9px] text-zinc-500">
                    Sonraki Kat
                  </p>
                  <motion.h2
                    className="glow-purple font-pixel text-2xl text-dm-accent sm:text-3xl"
                    initial={{ scale: 0.8 }}
                    animate={{ scale: [0.8, 1.1, 1] }}
                    transition={{ duration: 0.5, ease: EASE }}
                  >
                    Kat {nextFloor}
                  </motion.h2>

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

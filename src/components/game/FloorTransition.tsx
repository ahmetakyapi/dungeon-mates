'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import { FLOOR_LORE } from '../../../shared/types';
import { MaskReveal, SplitReveal } from '@/components/fx/RevealText';
import { EASE_OUT_EXPO, EASE_IN_OUT, prefersReducedMotion } from '@/lib/motion';

const AUTO_CONTINUE_MS = 5000;
const NEXT_REVEAL_MS = 1200;
const CONFETTI_COUNT = 36;
const STREAKS = 12;
const CONTINUE_BLOCKS = 16;
/** Same scale as the loading screen's depth gauge. */
const METERS_PER_FLOOR = 24;

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

// Confetti: square pixels bursting from the headline.
type Confetto = {
  id: number;
  x: number;
  startY: number;
  endY: number;
  drift: number;
  rotation: number;
  color: string;
  size: number;
  duration: number;
  delay: number;
};

function generateConfetti(): Confetto[] {
  const colors = ['#fbbf24', '#a78bfa', '#10b981', '#ef4444', '#3b82f6', '#fde68a', '#f97316'];
  return Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
    id: i,
    x: 40 + Math.random() * 20, // center-biased
    startY: 30 + Math.random() * 10,
    endY: 10 + Math.random() * 85,
    drift: (i % 2 === 0 ? 1 : -1) * (30 + Math.random() * 160),
    rotation: Math.random() * 720 - 360,
    color: colors[i % colors.length],
    size: 3 + Math.round(Math.random() * 4),
    duration: 1.4 + Math.random() * 0.8,
    delay: 0.35 + Math.random() * 0.25,
  }));
}

function formatTime(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/** Count-up number display — animates from 0 to `value`. */
function CountUpNumber({
  value,
  duration = 1.1,
  delay = 0,
  format,
}: {
  value: number;
  duration?: number;
  delay?: number;
  format?: (v: number) => string;
}) {
  const motionValue = useMotionValue(0);
  const text = useTransform(motionValue, (v) => (format ? format(v) : Math.floor(v).toString()));
  useEffect(() => {
    if (prefersReducedMotion()) { motionValue.set(value); return; }
    const controls = animate(motionValue, value, { duration, delay, ease: EASE_OUT_EXPO });
    return () => controls.stop();
  }, [value, duration, delay, motionValue]);
  return <motion.span className="tabular-nums">{text}</motion.span>;
}

function StatTile({
  icon,
  label,
  delay,
  children,
}: {
  icon: string;
  label: string;
  delay: number;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      className="dm-corners flex min-w-[88px] flex-col items-center gap-1 border border-white/5 bg-white/[0.02] px-4 py-3 sm:min-w-[110px]"
      style={{ ['--dm-corner' as string]: 'rgba(245,158,11,0.6)' }}
      initial={{ opacity: 0, y: 16, clipPath: 'inset(0 0 100% 0)' }}
      animate={{ opacity: 1, y: 0, clipPath: 'inset(-20% -20% -20% -20%)' }}
      transition={{ delay, duration: 0.8, ease: EASE_OUT_EXPO }}
    >
      <motion.span
        className="text-lg lg:text-xl 2xl:text-2xl"
        initial={{ scale: 0.4, rotate: -20 }}
        animate={{ scale: [0.4, 1.25, 1], rotate: 0 }}
        transition={{ delay: delay + 0.1, duration: 0.6, ease: EASE_OUT_EXPO }}
      >
        {icon}
      </motion.span>
      <span className="font-pixel text-xs text-white lg:text-base 2xl:text-lg">{children}</span>
      <span className="font-mono text-[8px] uppercase tracking-[0.3em] text-zinc-500 lg:text-[10px]">{label}</span>
    </motion.div>
  );
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
  const confetti = useMemo(generateConfetti, []);

  // Auto-continue after delay
  useEffect(() => {
    if (!isVisible) {
      setShowNext(false);
      return;
    }

    const nextTimer = setTimeout(() => setShowNext(true), NEXT_REVEAL_MS);
    const autoTimer = setTimeout(onContinue, AUTO_CONTINUE_MS);

    return () => {
      clearTimeout(nextTimer);
      clearTimeout(autoTimer);
    };
  }, [isVisible, onContinue]);

  const completedLore = FLOOR_LORE[completedFloor];
  const nextLore = FLOOR_LORE[nextFloor];
  const quote = FLOOR_QUOTES[completedFloor];
  const holdMs = AUTO_CONTINUE_MS - NEXT_REVEAL_MS;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed inset-0 z-[85] flex flex-col items-center justify-center overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.5, delay: 0.15, ease: EASE_IN_OUT } }}
          transition={{ duration: 0.35 }}
        >
          {/* Background */}
          <div className="absolute inset-0 bg-[#06070d]" />
          <motion.div
            className="pointer-events-none absolute left-1/2 top-[40%] h-[70vmin] w-[70vmin] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[110px]"
            style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.18), transparent 65%)' }}
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1.4, ease: EASE_OUT_EXPO }}
          />
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            {Array.from({ length: STREAKS }).map((_, i) => (
              <span
                key={i}
                className="dm-streak"
                style={{
                  left: `${(i * 41 + 7) % 100}%`,
                  animationDuration: `${1.6 + ((i * 7) % 5) * 0.4}s`,
                  animationDelay: `${-((i * 0.37) % 1.8)}s`,
                  opacity: 0.2 + ((i * 3) % 4) * 0.1,
                }}
              />
            ))}
          </div>
          <div className="dm-scanlines" aria-hidden />
          <div className="dm-vignette" aria-hidden />

          {/* Confetti celebration burst */}
          {confetti.map((c) => (
            <motion.div
              key={c.id}
              className="pointer-events-none absolute"
              style={{
                left: `${c.x}%`,
                top: `${c.startY}%`,
                width: c.size,
                height: c.size,
                backgroundColor: c.color,
                boxShadow: `0 0 6px ${c.color}`,
              }}
              initial={{ opacity: 0, y: 0, x: 0, rotate: 0, scale: 1 }}
              animate={{
                opacity: [0, 1, 1, 0],
                y: `${c.endY - c.startY}vh`,
                x: c.drift,
                rotate: c.rotation,
                scale: [1, 1, 0.6],
              }}
              transition={{
                duration: c.duration,
                delay: c.delay,
                ease: EASE_OUT_EXPO,
              }}
            />
          ))}

          {/* Content */}
          <motion.div
            className="relative z-10 flex w-full max-w-xl flex-col items-center gap-5 px-4 text-center sm:gap-6"
            exit={{ y: -30, opacity: 0, filter: 'blur(8px)', transition: { duration: 0.45, ease: EASE_IN_OUT } }}
          >
            {/* Completed floor */}
            <div className="flex flex-col items-center gap-2">
              <span className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.45em] text-dm-xp lg:text-xs">
                <motion.span
                  className="block h-px w-8 origin-right bg-dm-xp/60"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.15, duration: 0.8, ease: EASE_OUT_EXPO }}
                />
                <SplitReveal text="Kat Tamamlandı!" delay={0.1} stagger={0.025} duration={0.6} />
                <motion.span
                  className="block h-px w-8 origin-left bg-dm-xp/60"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.15, duration: 0.8, ease: EASE_OUT_EXPO }}
                />
              </span>

              <h1
                className="relative font-pixel text-4xl text-dm-gold sm:text-5xl lg:text-6xl xl:text-7xl 2xl:text-8xl"
                style={{ textShadow: '0 0 32px rgba(245,158,11,0.5)' }}
              >
                <MaskReveal delay={0.2} duration={1}>Kat {completedFloor}</MaskReveal>
                {/* A seal stamped across the cleared floor */}
                <motion.span
                  aria-hidden
                  className="absolute left-[-6%] top-1/2 block h-[3px] w-[112%] origin-left bg-dm-gold/80"
                  style={{ boxShadow: '0 0 12px rgba(245,158,11,0.8)' }}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.85, duration: 0.5, ease: EASE_IN_OUT }}
                />
              </h1>

              {/* Completed floor name & lore */}
              {completedLore && (
                <div className="mt-1 flex flex-col items-center gap-1">
                  <MaskReveal delay={0.45} className="font-pixel text-[11px] text-dm-accent lg:text-sm xl:text-base 2xl:text-lg">
                    {completedLore.icon} {completedLore.name}
                  </MaskReveal>
                  <motion.span
                    className="max-w-sm font-body text-[10px] italic text-zinc-500 lg:text-xs xl:text-sm 2xl:text-base"
                    initial={{ opacity: 0, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, filter: 'blur(0px)' }}
                    transition={{ delay: 0.6, duration: 0.8, ease: EASE_OUT_EXPO }}
                  >
                    {completedLore.reveal}
                  </motion.span>
                </div>
              )}
            </div>

            {/* Mini stats */}
            {(monstersKilled > 0 || timeSpent > 0) && (
              <div className="flex gap-3 sm:gap-4">
                {monstersKilled > 0 && (
                  <StatTile icon="💀" label="Canavar" delay={0.7}>
                    <CountUpNumber value={monstersKilled} delay={0.8} />
                  </StatTile>
                )}
                {timeSpent > 0 && (
                  <StatTile icon="⏱️" label="Süre" delay={0.8}>
                    <CountUpNumber value={timeSpent} delay={0.9} format={formatTime} />
                  </StatTile>
                )}
              </div>
            )}

            {/* Motivational quote — words surface one by one */}
            {quote && (
              <p className="max-w-xs font-body text-[10px] italic text-dm-gold/70 sm:max-w-sm lg:text-xs xl:text-sm 2xl:text-base">
                {quote.split(' ').map((w, i) => (
                  <motion.span
                    key={`${w}-${i}`}
                    className="inline-block"
                    initial={{ opacity: 0, y: 6, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    transition={{ delay: 0.9 + i * 0.04, duration: 0.5, ease: EASE_OUT_EXPO }}
                  >
                    {i === 0 ? '“' : ''}{w}{i === quote.split(' ').length - 1 ? '”' : ''}&nbsp;
                  </motion.span>
                ))}
              </p>
            )}

            {/* Divider */}
            <motion.div
              className="h-px w-40 sm:w-56"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.8), transparent)' }}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 1.0, duration: 0.8, ease: EASE_OUT_EXPO }}
            />

            {/* Next floor reveal */}
            <div className="flex min-h-[120px] flex-col items-center gap-2">
              <AnimatePresence>
                {showNext && (
                  <motion.div
                    className="flex flex-col items-center gap-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    <span className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.4em] text-zinc-500 lg:text-[11px]">
                      <MaskReveal duration={0.6}>Sonraki Kat</MaskReveal>
                      <span className="text-zinc-700">·</span>
                      <MaskReveal delay={0.08} duration={0.6}>
                        <span className="tabular-nums text-dm-accent">−{String(nextFloor * METERS_PER_FLOOR).padStart(3, '0')}m</span>
                      </MaskReveal>
                    </span>
                    <h2
                      className="font-pixel text-2xl text-dm-accent sm:text-3xl lg:text-4xl xl:text-5xl 2xl:text-6xl"
                      style={{ textShadow: '0 0 28px rgba(139,92,246,0.55)' }}
                    >
                      <MaskReveal delay={0.1} duration={0.9}>Kat {nextFloor}</MaskReveal>
                    </h2>

                    {/* Next floor name & lore */}
                    {nextLore && (
                      <div className="mt-1 flex flex-col items-center gap-1">
                        <span className="font-pixel text-[11px] text-dm-gold lg:text-sm xl:text-base 2xl:text-lg">
                          <SplitReveal text={`${nextLore.icon} ${nextLore.name}`} delay={0.3} stagger={0.022} />
                        </span>
                        <motion.span
                          className="max-w-xs font-body text-[10px] italic text-zinc-500 sm:max-w-sm lg:text-xs xl:text-sm 2xl:text-base"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.55, duration: 0.7, ease: EASE_OUT_EXPO }}
                        >
                          {nextLore.lore}
                        </motion.span>
                      </div>
                    )}

                    {/* Auto-continue indicator — pixel blocks lighting in sequence */}
                    <div
                      className="mt-4 flex gap-[3px]"
                      aria-hidden
                      style={{ ['--dm-fill-on' as string]: '#8b5cf6' }}
                    >
                      {Array.from({ length: CONTINUE_BLOCKS }).map((_, i) => (
                        <span
                          key={i}
                          className="dm-fill-block block h-[5px] w-[5px]"
                          style={{ animationDelay: `${Math.round(((i + 1) / CONTINUE_BLOCKS) * (holdMs - 350))}ms` }}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

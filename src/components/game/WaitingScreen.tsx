'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PixelButton } from '@/components/ui/PixelButton';
import { BlockBar, MaskReveal } from '@/components/fx/RevealText';
import { EASE_OUT_EXPO } from '@/lib/motion';

type WaitingScreenProps = {
  connectionState: 'connecting' | 'disconnected';
  reconnectAttempt: number;
  error?: string;
  onRetry?: () => void;
  onBack?: () => void;
};

// ─── TIPS ──────────────────────────────────────────────────
const GAME_TIPS = [
  'Savaşçı yakın dövüşte en güçlü sınıftır — kalkan yeteneği ile takımını koru',
  'Büyücü güçlü ama kırılgan — her zaman mesafe koru',
  'Okçu en hızlı sınıf — keşif görevleri için idealdir',
  'Sandıkları açmak için R tuşuna bas — içinden iksir ve güçlendirme düşer',
  'Her katta canavarlar daha güçlü olur — hazırlıklı ol',
  'Boss\'un saldırı kalıplarını öğren, sonra saldır',
  'Takım arkadaşlarınla iletişim kur — T tuşu ile sohbet aç',
  'Merdivenleri kullanmak için tüm canavarları temizlemen gerek',
  'Altın toplamak skorunu artırır — gözden kaçırma',
  'Can iksirini doğru zamanda topla — israf etme',
  'E tuşu ile özel yeteneğini kullan — mana ve bekleme süresi var',
  'Solo modda 3 canın var — dikkatli oyna',
  'Minimap\'i takip et — düşmanları ve takım arkadaşlarını görebilirsin',
  'Sprint için Shift tuşuna bas — hızla hareket et',
  'ESC ile oyunu duraklatabilirsin',
  'Her sınıfın kendine özel yeteneği var — sınıf seçiminde incele',
] as const;

const FUN_FACTS = [
  '3 farklı sınıf, her biri benzersiz yetenek ve saldırı stiline sahip',
  'Zindanlar her oyunda rastgele üretilir — hiçbir oyun bir diğerine benzemez',
  '2-4 kişi ile co-op oynayabilir veya solo meydan okumayı deneyebilirsin',
] as const;

// ─── PROGRESS BAR ─────────────────────────────────────────
function useProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    const totalDuration = 45_000; // 45 seconds to ~95%

    const tick = () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / totalDuration, 1);
      // Ease-out cubic: fast start, slows down near end; caps at 95%
      const eased = 1 - Math.pow(1 - t, 3);
      setProgress(Math.min(eased * 95, 95));
    };

    const interval = setInterval(tick, 200);
    return () => clearInterval(interval);
  }, []);

  return progress;
}

// ─── CONNECTION RUNE ──────────────────────────────────────
const RUNE_SIZE = 4;
/** Socket.IO is configured for 10 attempts (useGameSocket). */
const MAX_ATTEMPTS = 10;

/**
 * A 4×4 block of pixels lit along a snake path — the shutter's blocks, idling.
 * Pure CSS; the colour follows the connection state.
 */
function ConnectionRune({ tone, stalled }: { tone: string; stalled: boolean }) {
  return (
    <div className="relative grid place-items-center" aria-hidden>
      {/* Halo */}
      <motion.div
        className="absolute h-40 w-40 rounded-full blur-3xl sm:h-52 sm:w-52"
        animate={{ background: `radial-gradient(circle, ${tone}40 0%, transparent 70%)` }}
        transition={{ duration: 0.6 }}
      />
      {/* Orbiting frame */}
      <motion.div
        className="absolute h-24 w-24 border sm:h-28 sm:w-28"
        style={{ borderColor: `${tone}40` }}
        animate={{ rotate: stalled ? 0 : 360 }}
        transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
      />
      <motion.div
        className="absolute h-[4.5rem] w-[4.5rem] border sm:h-20 sm:w-20"
        style={{ borderColor: `${tone}26` }}
        animate={{ rotate: stalled ? 45 : -360 }}
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
      />
      <div
        className="relative grid gap-[3px]"
        style={{
          gridTemplateColumns: `repeat(${RUNE_SIZE}, 1fr)`,
          ['--dm-rune' as string]: tone,
        }}
      >
        {Array.from({ length: RUNE_SIZE * RUNE_SIZE }).map((_, i) => {
          const r = Math.floor(i / RUNE_SIZE);
          const c = i % RUNE_SIZE;
          const order = r % 2 === 0 ? r * RUNE_SIZE + c : r * RUNE_SIZE + (RUNE_SIZE - 1 - c);
          return (
            <span
              key={i}
              className="dm-rune-cell block h-2.5 w-2.5 sm:h-3 sm:w-3"
              style={{
                animationDelay: `${order * 100}ms`,
                animationDuration: stalled ? '2.6s' : '1.6s',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────
export function WaitingScreen({ connectionState, reconnectAttempt, error, onRetry, onBack }: WaitingScreenProps) {
  // A random initial tip would differ between server and client; pick after mount.
  const [tipIndex, setTipIndex] = useState(0);
  useEffect(() => { setTipIndex(Math.floor(Math.random() * GAME_TIPS.length)); }, []);
  const [factIndex, setFactIndex] = useState(0);
  const [dotCount, setDotCount] = useState(0);
  const progress = useProgress();

  useEffect(() => {
    const interval = setInterval(() => setTipIndex((prev) => (prev + 1) % GAME_TIPS.length), 5_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setFactIndex((prev) => (prev + 1) % FUN_FACTS.length), 8_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setDotCount((prev) => (prev + 1) % 4), 400);
    return () => clearInterval(interval);
  }, []);

  const dots = '.'.repeat(dotCount);
  const isDisconnected = connectionState === 'disconnected';
  const stalled = reconnectAttempt >= 5;
  const showActions = isDisconnected || stalled;

  const tone = isDisconnected ? '#ef4444' : stalled ? '#f59e0b' : '#8b5cf6';
  const chip = isDisconnected ? 'Bağlantı koptu' : stalled ? 'Uzun sürüyor' : 'Bağlanıyor';
  const statusText = connectionState === 'connecting' ? 'Sunucu uyanıyor' : 'Yeniden bağlanılıyor';

  return (
    <motion.div
      className="fixed inset-0 z-[90] overflow-y-auto overflow-x-hidden bg-[#06070d]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: EASE_OUT_EXPO }}
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-none fixed inset-0" aria-hidden>
      {/* Faint tile grid — the dungeon floor, seen from far above. */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        aria-hidden
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          maskImage: 'radial-gradient(ellipse at center, black 10%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 10%, transparent 70%)',
        }}
      />
      <div className="dm-scanlines" />
      <div className="dm-vignette" />
      </div>

      <div className="relative z-10 flex min-h-full w-full flex-col items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-md flex-col items-center lg:max-w-lg">
        {/* Rune */}
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 160, damping: 18 }}
          className="mb-8 sm:mb-10"
        >
          <ConnectionRune tone={tone} stalled={stalled && !isDisconnected} />
        </motion.div>

        {/* State chip */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={chip}
            className="mb-3 flex items-center gap-2 border px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.35em] sm:text-[10px]"
            style={{ borderColor: `${tone}55`, color: tone, background: `${tone}12` }}
            initial={{ opacity: 0, y: 6, clipPath: 'inset(0 100% 0 0)' }}
            animate={{ opacity: 1, y: 0, clipPath: 'inset(0 0% 0 0)' }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
          >
            <span className="dm-pulse-dot block h-1.5 w-1.5" style={{ background: tone }} aria-hidden />
            {chip}
          </motion.div>
        </AnimatePresence>

        {/* Headline */}
        <h1 className="text-center font-pixel text-sm text-white sm:text-base lg:text-xl 2xl:text-2xl">
          <MaskReveal key={statusText} delay={0.1}>
            {statusText}
            <span className="inline-block w-6 text-left sm:w-8" aria-hidden>{dots}</span>
          </MaskReveal>
        </h1>

        {/* Attempt pips */}
        {reconnectAttempt > 0 && (
          <motion.div
            className="mt-3 flex items-center gap-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            <span className="font-mono text-[10px] text-zinc-500 sm:text-xs">Deneme #{reconnectAttempt}</span>
            <div className="flex gap-[3px]" aria-hidden>
              {Array.from({ length: MAX_ATTEMPTS }).map((_, i) => (
                <span
                  key={i}
                  className="block h-1.5 w-1.5 transition-colors duration-300"
                  style={{ background: i < reconnectAttempt ? tone : 'rgba(255,255,255,0.1)' }}
                />
              ))}
            </div>
          </motion.div>
        )}

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.p
              className={`mt-3 max-w-sm text-center font-body text-[11px] sm:text-xs lg:text-sm ${
                isDisconnected ? 'text-red-300' : 'text-amber-300/80'
              }`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Progress — pixel blocks */}
        <motion.div
          className="mt-6 flex flex-col items-center gap-2"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6, ease: EASE_OUT_EXPO }}
        >
          <BlockBar value={progress / 100} blocks={24} color={tone} size={7} gap={3} />
          <p className="font-mono text-[9px] tabular-nums tracking-[0.3em] text-zinc-500 sm:text-[10px]">
            %{Math.round(progress).toString().padStart(2, '0')}
          </p>
        </motion.div>

        {/* Retry / Back */}
        <AnimatePresence>
          {showActions && (onRetry || onBack) && (
            <motion.div
              className="mt-6 flex w-full max-w-xs flex-col gap-2 sm:flex-row sm:gap-3"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
            >
              {onRetry && (
                <PixelButton variant="primary" fullWidth onClick={onRetry}>
                  ↻ Tekrar Dene
                </PixelButton>
              )}
              {onBack && (
                <PixelButton variant="secondary" fullWidth onClick={onBack}>
                  Ana Menü
                </PixelButton>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tip + fact */}
        <motion.div
          className="mt-8 grid w-full gap-5 text-center sm:mt-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.6 }}
        >
          <div>
            <p className="mb-1.5 flex items-center justify-center gap-2 font-mono text-[9px] uppercase tracking-[0.4em] text-dm-gold/80 lg:text-[10px]">
              <span className="block h-[5px] w-[5px] bg-dm-gold" aria-hidden />
              İpucu
            </p>
            <div className="grid min-h-[3em] place-items-center">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.p
                  key={tipIndex}
                  className="col-start-1 row-start-1 font-body text-[11px] leading-relaxed text-zinc-400 sm:text-xs lg:text-sm"
                  initial={{ opacity: 0, y: 8, filter: 'blur(6px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -8, filter: 'blur(6px)' }}
                  transition={{ duration: 0.55, ease: EASE_OUT_EXPO }}
                >
                  {GAME_TIPS[tipIndex]}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>
          <div>
            <p className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.4em] text-dm-accent/70 lg:text-[10px]">
              Biliyor muydun?
            </p>
            <div className="grid min-h-[2.6em] place-items-center">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.p
                  key={factIndex}
                  className="col-start-1 row-start-1 font-body text-[10px] leading-relaxed text-zinc-500 sm:text-[11px] lg:text-xs"
                  initial={{ opacity: 0, y: 8, filter: 'blur(6px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -8, filter: 'blur(6px)' }}
                  transition={{ duration: 0.55, ease: EASE_OUT_EXPO }}
                >
                  {FUN_FACTS[factIndex]}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </div>
      </div>
    </motion.div>
  );
}

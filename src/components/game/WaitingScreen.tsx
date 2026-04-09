'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const EASE = [0.22, 1, 0.36, 1] as const;

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

// ─── PARTICLES ─────────────────────────────────────────────
const PARTICLE_COUNT = 18;

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
    size: 2 + Math.random() * 3,
    duration: 2 + Math.random() * 4,
    delay: Math.random() * 3,
  }));
}

// ─── TORCH COMPONENT ──────────────────────────────────────
function Torch({ side }: { side: 'left' | 'right' }) {
  const posClass = side === 'left'
    ? 'left-[10%] sm:left-[15%] lg:left-[20%]'
    : 'right-[10%] sm:right-[15%] lg:right-[20%]';

  return (
    <div className={`absolute top-[25%] ${posClass}`}>
      {/* Torch handle */}
      <div className="mx-auto h-8 w-2 bg-amber-800 sm:h-10 lg:h-12" />
      {/* Flame container */}
      <div className="relative -top-9 flex justify-center sm:-top-11 lg:-top-13">
        {/* Flame core */}
        <motion.div
          className="h-4 w-3 rounded-full bg-amber-400 sm:h-5 sm:w-4 lg:h-6 lg:w-5"
          animate={{
            scaleY: [1, 1.3, 0.9, 1.2, 1],
            scaleX: [1, 0.9, 1.1, 0.95, 1],
            opacity: [0.9, 1, 0.85, 1, 0.9],
          }}
          transition={{ duration: 0.6, repeat: Infinity, ease: 'easeInOut' }}
          style={{ filter: 'blur(1px)' }}
        />
        {/* Flame outer glow */}
        <motion.div
          className="absolute -top-1 h-6 w-5 rounded-full bg-orange-500/50 sm:h-7 sm:w-6 lg:h-8 lg:w-7"
          animate={{
            scaleY: [1, 1.4, 0.85, 1.25, 1],
            scaleX: [1, 0.85, 1.15, 0.9, 1],
            opacity: [0.4, 0.6, 0.35, 0.55, 0.4],
          }}
          transition={{ duration: 0.5, repeat: Infinity, ease: 'easeInOut', delay: 0.1 }}
          style={{ filter: 'blur(3px)' }}
        />
        {/* Light cast */}
        <motion.div
          className="absolute -top-4 h-16 w-16 rounded-full bg-amber-400/10 sm:h-20 sm:w-20 lg:h-24 lg:w-24"
          animate={{ opacity: [0.15, 0.3, 0.15], scale: [0.95, 1.05, 0.95] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
          style={{ filter: 'blur(12px)' }}
        />
      </div>
    </div>
  );
}

// ─── WALKING CHARACTER ────────────────────────────────────
function WalkingCharacter() {
  return (
    <motion.div
      className="absolute bottom-[18%] sm:bottom-[20%]"
      animate={{ x: ['-60px', '60px', '-60px'] }}
      transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
    >
      {/* Simple pixel character */}
      <div className="relative">
        {/* Head */}
        <div className="mx-auto h-3 w-3 bg-[#fcd5b4] sm:h-4 sm:w-4" />
        {/* Hair */}
        <div className="absolute -top-1 left-0 h-1.5 w-3 bg-amber-700 sm:h-2 sm:w-4" />
        {/* Body */}
        <div className="mx-auto h-4 w-3 bg-dm-accent sm:h-5 sm:w-4" />
        {/* Legs — animated */}
        <div className="flex justify-center gap-px">
          <motion.div
            className="h-2 w-1 bg-zinc-600 sm:h-3 sm:w-1.5"
            animate={{ scaleY: [1, 0.7, 1] }}
            transition={{ duration: 0.4, repeat: Infinity }}
          />
          <motion.div
            className="h-2 w-1 bg-zinc-600 sm:h-3 sm:w-1.5"
            animate={{ scaleY: [0.7, 1, 0.7] }}
            transition={{ duration: 0.4, repeat: Infinity }}
          />
        </div>
      </div>
    </motion.div>
  );
}

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

// ─── MAIN COMPONENT ──────────────────────────────────────
export function WaitingScreen({ connectionState, reconnectAttempt, error, onRetry, onBack }: WaitingScreenProps) {
  const [tipIndex, setTipIndex] = useState(() => Math.floor(Math.random() * GAME_TIPS.length));
  const [factIndex, setFactIndex] = useState(0);
  const [dotCount, setDotCount] = useState(0);
  const particles = useMemo(generateParticles, []);
  const progress = useProgress();

  // Rotate tips every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % GAME_TIPS.length);
    }, 5_000);
    return () => clearInterval(interval);
  }, []);

  // Rotate fun facts every 8 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setFactIndex((prev) => (prev + 1) % FUN_FACTS.length);
    }, 8_000);
    return () => clearInterval(interval);
  }, []);

  // Animated dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDotCount((prev) => (prev + 1) % 4);
    }, 400);
    return () => clearInterval(interval);
  }, []);

  const dots = '.'.repeat(dotCount);

  const statusText = connectionState === 'connecting'
    ? 'Sunucu uyanıyor'
    : 'Yeniden bağlanılıyor';

  return (
    <motion.div
      className="fixed inset-0 z-[90] flex flex-col items-center justify-center overflow-hidden bg-dm-bg"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      {/* ── Background glow effects ── */}
      <div className="pointer-events-none absolute inset-0">
        {/* Top-left accent */}
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-dm-accent/[0.04] blur-[120px]" />
        {/* Bottom-right accent */}
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-dm-gold/[0.03] blur-[120px]" />
        {/* Center pulsing glow */}
        <motion.div
          className="absolute left-1/2 top-1/3 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-dm-accent/[0.05] blur-[100px]"
          animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* ── Particles ── */}
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute bg-dm-accent/20"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
          }}
          animate={{
            y: [0, -40, 0],
            opacity: [0.1, 0.5, 0.1],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}

      {/* ── Dungeon scene ── */}
      <div className="relative mb-6 h-40 w-64 sm:mb-8 sm:h-48 sm:w-80 lg:h-56 lg:w-96 2xl:h-64 2xl:w-[28rem]">
        {/* Stone wall background */}
        <div className="absolute inset-0 rounded-lg border-2 border-dm-border/50 bg-dm-surface/60">
          {/* Stone texture lines */}
          <div className="absolute left-0 top-[30%] h-px w-full bg-dm-border/30" />
          <div className="absolute left-0 top-[60%] h-px w-full bg-dm-border/30" />
          <div className="absolute left-[25%] top-0 h-[30%] w-px bg-dm-border/20" />
          <div className="absolute left-[50%] top-[30%] h-[30%] w-px bg-dm-border/20" />
          <div className="absolute left-[75%] top-[60%] h-[40%] w-px bg-dm-border/20" />
        </div>

        {/* Floor */}
        <div className="absolute bottom-0 left-0 right-0 h-[20%] rounded-b-lg border-t-2 border-dm-border/40 bg-zinc-800/80" />

        {/* Torches */}
        <Torch side="left" />
        <Torch side="right" />

        {/* Walking character */}
        <WalkingCharacter />

        {/* Dungeon archway (center) */}
        <div className="absolute bottom-[20%] left-1/2 -translate-x-1/2">
          <div className="h-12 w-10 rounded-t-full border-2 border-dm-border bg-dm-bg/80 sm:h-14 sm:w-12 lg:h-16 lg:w-14">
            {/* Keyhole */}
            <div className="mx-auto mt-4 h-2 w-1 rounded-full bg-dm-gold/50 sm:mt-5" />
            <div className="mx-auto mt-px h-1.5 w-0.5 bg-dm-gold/50" />
          </div>
        </div>
      </div>

      {/* ── Connection status ── */}
      <motion.div
        className="mb-4 text-center"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5, ease: EASE }}
      >
        <p className="font-pixel text-xs text-white sm:text-sm lg:text-base xl:text-lg 2xl:text-xl">
          {statusText}
          <span className="inline-block w-6 text-left sm:w-8">{dots}</span>
        </p>
        {reconnectAttempt > 0 && (
          <p className="mt-1 font-body text-[10px] text-zinc-500 sm:text-xs lg:text-sm 2xl:text-base">
            Deneme #{reconnectAttempt}
          </p>
        )}
        {error && (
          <motion.p
            className={`mt-2 font-body text-[11px] sm:text-xs lg:text-sm 2xl:text-base ${
              connectionState === 'disconnected' ? 'text-dm-health' : 'text-amber-400/80'
            }`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {error}
          </motion.p>
        )}
      </motion.div>

      {/* ── Retry / Back buttons ── */}
      {(connectionState === 'disconnected' || reconnectAttempt >= 5) && (
        <motion.div
          className="mb-4 flex gap-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4, ease: EASE }}
        >
          {onRetry && (
            <button
              onClick={onRetry}
              className="rounded border-2 border-dm-accent bg-dm-accent/10 px-4 py-2 font-pixel text-[10px] text-dm-accent transition-colors hover:bg-dm-accent/20 sm:text-xs lg:text-sm 2xl:text-base"
            >
              Tekrar Dene
            </button>
          )}
          {onBack && (
            <button
              onClick={onBack}
              className="rounded border-2 border-dm-border bg-dm-surface px-4 py-2 font-pixel text-[10px] text-zinc-400 transition-colors hover:text-white sm:text-xs lg:text-sm 2xl:text-base"
            >
              Ana Menü
            </button>
          )}
        </motion.div>
      )}

      {/* ── Progress bar ── */}
      <motion.div
        className="mb-6 w-56 sm:mb-8 sm:w-64 lg:w-80 2xl:w-96"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5, ease: EASE }}
      >
        <div className="relative h-3 overflow-hidden rounded-full border border-dm-border bg-dm-surface lg:h-4 2xl:h-5">
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #8b5cf6, #a78bfa, #8b5cf6)',
              backgroundSize: '200% 100%',
            }}
            animate={{ backgroundPosition: ['0% 0%', '200% 0%'] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          />
          {/* Shine effect */}
          <motion.div
            className="absolute inset-y-0 left-0 w-full"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)',
              backgroundSize: '50% 100%',
            }}
            animate={{ backgroundPosition: ['-100% 0%', '200% 0%'] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          />
        </div>
        <p className="mt-1.5 text-center font-pixel text-[8px] text-dm-accent sm:text-[9px] lg:text-[10px] 2xl:text-xs">
          %{Math.round(progress)}
        </p>
      </motion.div>

      {/* ── Rotating tip ── */}
      <div className="mb-4 h-16 max-w-xs px-4 text-center sm:max-w-sm lg:max-w-md 2xl:max-w-lg">
        <p className="mb-1.5 font-pixel text-[8px] text-dm-gold sm:text-[9px] lg:text-[11px] xl:text-[12px] 2xl:text-[14px]">
          İpucu
        </p>
        <AnimatePresence mode="wait">
          <motion.p
            key={tipIndex}
            className="font-body text-[11px] leading-relaxed text-zinc-400 sm:text-xs lg:text-sm xl:text-base 2xl:text-base"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.4, ease: EASE }}
          >
            {GAME_TIPS[tipIndex]}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* ── Fun fact ── */}
      <div className="max-w-xs px-4 text-center sm:max-w-sm lg:max-w-md 2xl:max-w-lg">
        <p className="mb-1.5 font-pixel text-[8px] text-dm-accent/70 sm:text-[9px] lg:text-[11px] xl:text-[12px] 2xl:text-[14px]">
          Biliyor muydun?
        </p>
        <AnimatePresence mode="wait">
          <motion.p
            key={factIndex}
            className="font-body text-[10px] leading-relaxed text-zinc-500 sm:text-[11px] lg:text-xs xl:text-sm 2xl:text-sm"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.4, ease: EASE }}
          >
            {FUN_FACTS[factIndex]}
          </motion.p>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

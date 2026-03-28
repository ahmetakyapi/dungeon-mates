'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CLASS_STATS } from '../../../shared/types';
import { PixelButton } from '../ui/PixelButton';

const EASE = [0.22, 1, 0.36, 1] as const;
const TOTAL_SLIDES = 4;
const AUTO_SKIP_MS = 30_000;

type TutorialOverlayProps = {
  onComplete: () => void;
};

// --- Slide 1: Kontroller ---

function KeyCap({ label, wide }: { label: string; wide?: boolean }) {
  return (
    <div
      className={`flex items-center justify-center rounded border-2 border-dm-border bg-dm-surface font-pixel text-[8px] text-white shadow-[0_2px_0_0_#1f2937] sm:text-[10px] ${
        wide ? 'px-4 py-2 sm:px-6' : 'h-8 w-8 sm:h-10 sm:w-10'
      }`}
    >
      {label}
    </div>
  );
}

function DesktopControls() {
  return (
    <div className="flex flex-col gap-3">
      <p className="font-pixel text-[9px] text-dm-accent sm:text-[10px]">Masaüstü</p>
      <div className="flex items-start gap-6">
        {/* WASD */}
        <div className="flex flex-col items-center gap-1">
          <KeyCap label="W" />
          <div className="flex gap-1">
            <KeyCap label="A" />
            <KeyCap label="S" />
            <KeyCap label="D" />
          </div>
          <p className="mt-1 font-body text-[10px] text-zinc-400">Hareket</p>
        </div>

        {/* Space */}
        <div className="flex flex-col items-center gap-1">
          <KeyCap label="SPACE" wide />
          <p className="mt-1 font-body text-[10px] text-zinc-400">Saldırı</p>
        </div>

        {/* E */}
        <div className="flex flex-col items-center gap-1">
          <KeyCap label="E" />
          <p className="mt-1 font-body text-[10px] text-zinc-400">Yetenek Kullan</p>
        </div>

        {/* R */}
        <div className="flex flex-col items-center gap-1">
          <KeyCap label="R" />
          <p className="mt-1 font-body text-[10px] text-zinc-400">Etkileşim</p>
          <p className="font-body text-[9px] text-zinc-500">(Sandık, Merdiven)</p>
        </div>

        {/* Escape */}
        <div className="flex flex-col items-center gap-1">
          <KeyCap label="ESC" />
          <p className="mt-1 font-body text-[10px] text-zinc-400">Menü</p>
        </div>
      </div>
    </div>
  );
}

function MobileControls() {
  return (
    <div className="flex flex-col gap-3">
      <p className="font-pixel text-[9px] text-dm-accent sm:text-[10px]">Mobil</p>
      <div className="flex items-center gap-6">
        {/* Left joystick */}
        <div className="flex flex-col items-center gap-1">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dm-accent/40 bg-dm-surface">
            <div className="h-6 w-6 rounded-full bg-dm-accent/60" />
          </div>
          <p className="mt-1 font-body text-[10px] text-zinc-400">Sol taraf: Hareket</p>
        </div>

        {/* Right buttons */}
        <div className="flex flex-col items-center gap-1">
          <div className="flex gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-dm-health/40 bg-dm-surface font-pixel text-[8px] text-dm-health">
              ⚔
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-dm-mana/40 bg-dm-surface font-pixel text-[8px] text-dm-mana">
              ✦
            </div>
          </div>
          <p className="mt-1 font-body text-[10px] text-zinc-400">Sağ taraf: Saldırı, Yetenek & Etkileşim</p>
        </div>
      </div>
    </div>
  );
}

function SlideControls() {
  return (
    <div className="flex flex-col gap-6">
      <h2 className="font-pixel text-sm text-dm-gold sm:text-base">Kontroller</h2>
      <DesktopControls />
      <div className="h-px w-full bg-dm-border" />
      <MobileControls />
    </div>
  );
}

// --- Slide 2: Sınıflar ---

const CLASS_ENTRIES = [
  {
    key: 'warrior' as const,
    title: 'Savaşçı',
    desc: 'Yakın dövüş, yüksek can, takımın kalkanı. Kalkan Duvarı (E) — Hasarı %70 azaltır',
  },
  {
    key: 'mage' as const,
    title: 'Büyücü',
    desc: 'Alan hasarı, ateş topu, düşük can. Buz Fırtınası (E) — Çevreye hasar + yavaşlatma',
  },
  {
    key: 'archer' as const,
    title: 'Okçu',
    desc: 'Hızlı saldırı, uzak menzil, çevik. Ok Yağmuru (E) — 5 ok yelpaze',
  },
] as const;

function SlideClasses() {
  return (
    <div className="flex flex-col gap-5">
      <h2 className="font-pixel text-sm text-dm-gold sm:text-base">Sınıflar</h2>
      <div className="flex flex-col gap-4">
        {CLASS_ENTRIES.map((entry) => {
          const stats = CLASS_STATS[entry.key];
          return (
            <div
              key={entry.key}
              className="pixel-border flex items-start gap-3 rounded bg-dm-surface/80 px-4 py-3"
            >
              <span className="text-xl">{stats.emoji}</span>
              <div className="flex flex-col gap-1">
                <span className="font-pixel text-[10px] sm:text-xs" style={{ color: stats.color }}>
                  {entry.title}
                </span>
                <span className="font-body text-[11px] text-zinc-400">{entry.desc}</span>
                <div className="mt-1 flex gap-3 font-body text-[10px] text-zinc-500">
                  <span>❤️ {stats.maxHp}</span>
                  <span>⚔ {stats.attack}</span>
                  <span>🛡 {stats.defense}</span>
                  <span>💨 {stats.speed}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Slide 3: Zindanı Keşfet ---

const DUNGEON_ITEMS = [
  'Odadaki tüm canavarları öldür → kapılar açılır',
  'Sandıkları aç (R) → can iksiri, mana iksiri veya güçlendirme düşürür',
  'Merdivenleri kullan (R) → bir sonraki kata ilerle (tüm canavarlar temizlenmeli)',
  'Yeteneğini kullan (E) → sınıfa özel güçlü saldırı (mana/bekleme süresi var)',
  '5. katta boss\'u yen → zafer!',
] as const;

function SlideDungeon() {
  return (
    <div className="flex flex-col gap-5">
      <h2 className="font-pixel text-sm text-dm-gold sm:text-base">Zindanı Keşfet</h2>
      <ul className="flex flex-col gap-3">
        {DUNGEON_ITEMS.map((item, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="mt-0.5 inline-block h-2 w-2 shrink-0 bg-dm-accent" />
            <span className="font-body text-[12px] leading-relaxed text-zinc-300 sm:text-sm">
              {item}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// --- Slide 4: İpuçları ---

const TIPS = [
  'Takım halinde hareket et — yalnız kalma!',
  'Can iksirleri canavar öldürdüğünde düşer',
  'Büyücünün mana\'sı var — dikkatli kullan',
  'Yeteneğin (E) hazır olduğunda HUD\'da parlak görünür',
  'Sandıklar her zaman loot verir — kaçırma!',
  'Odadaki tüm canavarları öldürünce kapılar açılır',
  'Boss odasına hazırlıksız girme!',
] as const;

function SlideTips() {
  return (
    <div className="flex flex-col gap-5">
      <h2 className="font-pixel text-sm text-dm-gold sm:text-base">İpuçları</h2>
      <ul className="flex flex-col gap-3">
        {TIPS.map((tip, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="mt-0.5 inline-block h-2 w-2 shrink-0 bg-dm-accent" />
            <span className="font-body text-[12px] leading-relaxed text-zinc-300 sm:text-sm">
              {tip}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// --- Main Component ---

const SLIDES = [SlideControls, SlideClasses, SlideDungeon, SlideTips] as const;

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 200 : -200,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -200 : 200,
    opacity: 0,
  }),
} as const;

export function TutorialOverlay({ onComplete }: TutorialOverlayProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState(1);

  const goNext = useCallback(() => {
    if (currentSlide < TOTAL_SLIDES - 1) {
      setDirection(1);
      setCurrentSlide((prev) => prev + 1);
    } else {
      onComplete();
    }
  }, [currentSlide, onComplete]);

  const goPrev = useCallback(() => {
    if (currentSlide > 0) {
      setDirection(-1);
      setCurrentSlide((prev) => prev - 1);
    }
  }, [currentSlide]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onComplete();
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [goNext, goPrev, onComplete]);

  // Auto-skip timer
  useEffect(() => {
    const timer = setTimeout(onComplete, AUTO_SKIP_MS);
    return () => clearTimeout(timer);
  }, [onComplete]);

  const CurrentSlideComponent = SLIDES[currentSlide];

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: EASE }}
    >
      <motion.div
        className="pixel-border relative mx-4 flex w-full max-w-lg flex-col gap-6 rounded-lg bg-dm-bg/95 px-6 py-8 sm:px-8 sm:py-10"
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ duration: 0.4, ease: EASE }}
      >
        {/* Slide content */}
        <div className="relative min-h-[280px] overflow-hidden sm:min-h-[320px]">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentSlide}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: EASE }}
            >
              <CurrentSlideComponent />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Dot indicators */}
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: TOTAL_SLIDES }).map((_, i) => (
            <button
              key={i}
              onClick={() => {
                setDirection(i > currentSlide ? 1 : -1);
                setCurrentSlide(i);
              }}
              className={`h-2 w-2 rounded-full transition-colors ${
                i === currentSlide ? 'bg-dm-accent' : 'bg-dm-border'
              }`}
            />
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between gap-3">
          <PixelButton
            variant="secondary"
            onClick={goPrev}
            disabled={currentSlide === 0}
            className="text-[8px] sm:text-[10px]"
          >
            Geri
          </PixelButton>

          {currentSlide < TOTAL_SLIDES - 1 ? (
            <PixelButton onClick={goNext} className="text-[8px] sm:text-[10px]">
              İleri
            </PixelButton>
          ) : (
            <PixelButton variant="gold" onClick={onComplete} className="text-[8px] sm:text-[10px]">
              Anladım, Başla!
            </PixelButton>
          )}
        </div>

        {/* Skip shortcut hint */}
        <p className="text-center font-body text-[10px] text-zinc-600">
          ESC ile geç &middot; Enter/Space ile ilerle
        </p>
      </motion.div>
    </motion.div>
  );
}

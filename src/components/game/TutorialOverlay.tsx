'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
      className={`flex items-center justify-center rounded border-2 border-dm-border bg-dm-surface font-pixel text-[8px] text-white shadow-[0_2px_0_0_#1f2937] sm:text-[10px] lg:text-[11px] xl:text-[12px] 2xl:text-[14px] ${
        wide ? 'px-4 py-2 sm:px-6 lg:px-8' : 'h-8 w-8 sm:h-10 sm:w-10 lg:h-12 lg:w-12 2xl:h-14 2xl:w-14'
      }`}
    >
      {label}
    </div>
  );
}

function DesktopControls() {
  return (
    <div className="flex flex-col gap-3">
      <p className="font-pixel text-[9px] text-dm-accent sm:text-[10px] lg:text-[11px] xl:text-[12px] 2xl:text-[14px]">Masaüstü</p>
      <div className="flex flex-wrap items-start justify-center gap-x-5 gap-y-4">
        {/* WASD */}
        <div className="flex w-[84px] flex-col items-center gap-1 text-center">
          <KeyCap label="W" />
          <div className="flex gap-1">
            <KeyCap label="A" />
            <KeyCap label="S" />
            <KeyCap label="D" />
          </div>
          <p className="mt-1 font-body text-[10px] text-zinc-400 lg:text-sm xl:text-sm 2xl:text-base">Hareket</p>
        </div>

        {/* Space */}
        <div className="flex w-[84px] flex-col items-center gap-1 text-center">
          <KeyCap label="SPACE" wide />
          <p className="mt-1 font-body text-[10px] text-zinc-400 lg:text-sm xl:text-sm 2xl:text-base">Saldırı</p>
        </div>

        {/* Q — dodge. Taught explicitly because it is the counter to enemy
            attack telegraphs, and it was previously undocumented anywhere. */}
        <div className="flex w-[84px] flex-col items-center gap-1 text-center">
          <KeyCap label="Q" />
          <p className="mt-1 font-body text-[10px] text-zinc-400 lg:text-sm xl:text-sm 2xl:text-base">Takla — kırmızı alandan kaç</p>
        </div>

        {/* E */}
        <div className="flex w-[84px] flex-col items-center gap-1 text-center">
          <KeyCap label="E" />
          <p className="mt-1 font-body text-[10px] text-zinc-400 lg:text-sm xl:text-sm 2xl:text-base">Yetenek Kullan</p>
        </div>

        {/* F */}
        <div className="flex w-[84px] flex-col items-center gap-1 text-center">
          <KeyCap label="F" />
          <p className="mt-1 font-body text-[10px] text-zinc-400 lg:text-sm xl:text-sm 2xl:text-base">Ultimate (Sv. 5+)</p>
        </div>

        {/* R */}
        <div className="flex w-[84px] flex-col items-center gap-1 text-center">
          <KeyCap label="R" />
          <p className="mt-1 font-body text-[10px] text-zinc-400 lg:text-sm xl:text-sm 2xl:text-base">Etkileşim</p>
          <p className="font-body text-[9px] text-zinc-500 lg:text-xs xl:text-sm 2xl:text-sm">(Sandık, Merdiven)</p>
        </div>

        {/* Escape */}
        <div className="flex w-[84px] flex-col items-center gap-1 text-center">
          <KeyCap label="ESC" />
          <p className="mt-1 font-body text-[10px] text-zinc-400 lg:text-sm xl:text-sm 2xl:text-base">Menü</p>
        </div>
      </div>
    </div>
  );
}

function MobileControls() {
  return (
    <div className="flex flex-col gap-3">
      <p className="font-pixel text-[9px] text-dm-accent sm:text-[10px] lg:text-[11px] xl:text-[12px] 2xl:text-[14px]">Mobil</p>
      <div className="flex items-center gap-6">
        {/* Left joystick */}
        <div className="flex w-[84px] flex-col items-center gap-1 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dm-accent/40 bg-dm-surface">
            <div className="h-6 w-6 rounded-full bg-dm-accent/60" />
          </div>
          <p className="mt-1 font-body text-[10px] text-zinc-400 lg:text-sm xl:text-sm 2xl:text-base">Sol taraf: Hareket</p>
        </div>

        {/* Right buttons */}
        <div className="flex w-[84px] flex-col items-center gap-1 text-center">
          <div className="flex gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-dm-health/40 bg-dm-surface font-pixel text-[8px] text-dm-health">
              ⚔
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-dm-mana/40 bg-dm-surface font-pixel text-[8px] text-dm-mana">
              ✦
            </div>
          </div>
          <p className="mt-1 font-body text-[10px] text-zinc-400 lg:text-sm xl:text-sm 2xl:text-base">Sağ taraf: Saldırı, Yetenek, Takla & Ultimate</p>
        </div>
      </div>
    </div>
  );
}

function SlideControls() {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    setIsTouch('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <h2 className="font-pixel text-sm text-dm-gold sm:text-base lg:text-lg xl:text-xl 2xl:text-2xl">Kontroller</h2>
      {/* Show mobile controls first on touch devices */}
      {isTouch ? (
        <>
          <MobileControls />
          <div className="h-px w-full bg-dm-border" />
          <details className="group">
            <summary className="cursor-pointer font-pixel text-[8px] text-zinc-500 group-open:text-dm-accent sm:text-[9px]">
              Masaüstü kontrolleri göster ▾
            </summary>
            <div className="mt-3">
              <DesktopControls />
            </div>
          </details>
        </>
      ) : (
        <>
          <DesktopControls />
          <div className="h-px w-full bg-dm-border" />
          <MobileControls />
        </>
      )}
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
      <h2 className="font-pixel text-sm text-dm-gold sm:text-base lg:text-lg xl:text-xl 2xl:text-2xl">Sınıflar</h2>
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
                <span className="font-pixel text-[10px] sm:text-xs lg:text-sm xl:text-sm 2xl:text-base" style={{ color: stats.color }}>
                  {entry.title}
                </span>
                <span className="font-body text-[11px] text-zinc-400 lg:text-sm xl:text-base 2xl:text-base">{entry.desc}</span>
                <div className="mt-1 flex gap-3 font-body text-[10px] text-zinc-500 lg:text-sm xl:text-sm 2xl:text-base">
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
  '📦 Sandıklara yaklaş ve R tuşuna bas → loot düşürür (altın parlama ile belirtilir)',
  '🪜 Merdivenlere yaklaş ve R tuşuna bas → bir sonraki kata ilerle (mavi parlama ile belirtilir)',
  '✨ Yeteneğini kullan (E) → sınıfa özel güçlü saldırı (mana/bekleme süresi var)',
  '👹 5. katta boss\'u yen → zafer!',
  '⚖️ Oyuncu sayısı arttıkça zorluk artar! (2: Normal, 3: Zor, 4: Çok Zor)',
] as const;

function SlideDungeon() {
  return (
    <div className="flex flex-col gap-5">
      <h2 className="font-pixel text-sm text-dm-gold sm:text-base lg:text-lg xl:text-xl 2xl:text-2xl">Zindanı Keşfet</h2>
      <ul className="flex flex-col gap-3">
        {DUNGEON_ITEMS.map((item, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="mt-0.5 inline-block h-2 w-2 shrink-0 bg-dm-accent" />
            <span className="font-body text-[12px] leading-relaxed text-zinc-300 sm:text-sm lg:text-sm xl:text-base 2xl:text-lg">
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
  'Büyücünün manası sınırlı — dikkatli kullan',
  'Yeteneğin (E) hazır olduğunda HUD\'da parlak görünür',
  'Sandıklar her zaman loot verir — kaçırma!',
  'Odadaki tüm canavarları öldürünce kapılar açılır — HUD\'da canavar sayısını takip et',
  'Taht Salonu\'na hazırlıksız girme!',
  'Hızlı öldürme yaparak kombo zinciri oluştur — daha fazla puan!',
  'Shift ile sprint yaparak hızlı hareket et',
] as const;

function SlideTips() {
  return (
    <div className="flex flex-col gap-5">
      <h2 className="font-pixel text-sm text-dm-gold sm:text-base lg:text-lg xl:text-xl 2xl:text-2xl">İpuçları</h2>
      <ul className="flex flex-col gap-3">
        {TIPS.map((tip, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="mt-0.5 inline-block h-2 w-2 shrink-0 bg-dm-accent" />
            <span className="font-body text-[12px] leading-relaxed text-zinc-300 sm:text-sm lg:text-sm xl:text-base 2xl:text-lg">
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
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  // The bounds check has to happen inside the updater, against `prev`. Checking
  // the captured `currentSlide` instead meant several clicks batched into one
  // render all saw the same stale value, passed the guard, and each incremented —
  // running the index past the last slide so SLIDES[i] came back undefined and
  // React threw "type is invalid". Mashing Enter or double-clicking "İleri" was
  // enough to crash into the error boundary.
  const goNext = useCallback(() => {
    let completed = false;
    setCurrentSlide((prev) => {
      if (prev < TOTAL_SLIDES - 1) {
        setDirection(1);
        return prev + 1;
      }
      completed = true;
      return prev;
    });
    if (completed) onComplete();
  }, [onComplete]);

  const goPrev = useCallback(() => {
    setCurrentSlide((prev) => {
      if (prev <= 0) return prev;
      setDirection(-1);
      return prev - 1;
    });
  }, []);

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

  // Swipe navigation for mobile
  const handleSwipeTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);

  const handleSwipeTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
    touchStartRef.current = null;
    if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx)) return;
    if (dx < 0) goNext();
    else goPrev();
  }, [goNext, goPrev]);

  const CurrentSlideComponent = SLIDES[currentSlide] ?? SLIDES[SLIDES.length - 1];

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: EASE }}
    >
      <motion.div
        className="pixel-border relative mx-4 flex w-full max-w-lg flex-col gap-6 rounded-lg bg-dm-bg/95 px-6 py-8 sm:px-8 sm:py-10 lg:max-w-xl lg:gap-8 2xl:max-w-2xl 2xl:gap-10 2xl:px-10 2xl:py-12"
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ duration: 0.4, ease: EASE }}
      >
        {/* Slide content — swipe enabled */}
        <div
          className="relative min-h-[240px] overflow-hidden sm:min-h-[320px]"
          onTouchStart={handleSwipeTouchStart}
          onTouchEnd={handleSwipeTouchEnd}
        >
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

        {/* Skip shortcut hint — context-aware for mobile/desktop */}
        <p className="text-center font-body text-[10px] text-zinc-600 sm:hidden">
          Sola/sağa kaydır &middot; Herhangi bir yere dokun
        </p>
        <p className="hidden text-center font-body text-[10px] text-zinc-600 sm:block lg:text-sm xl:text-sm 2xl:text-base">
          ESC ile geç &middot; Enter/Space ile ilerle
        </p>
      </motion.div>
    </motion.div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { PixelShutter } from '@/components/fx/PixelShutter';
import { EASE_OUT_EXPO, EASE_IN_OUT, prefersReducedMotion } from '@/lib/motion';
import { floorTheme } from '../../../../shared/types';
import { setScrollLocked } from './SmoothScroll';

const SEEN_KEY = 'dm-preloader-seen';
const COUNT_MS = 1900;

type Stage = 'count' | 'exit' | 'reveal' | 'done';

/**
 * The way in.
 *
 * A depth counter runs from the surface to the bottom of the tenth floor while
 * the floor names flick past, then the screen breaks up into pixel blocks and
 * the page comes through. Plays once per browser session; later visits get the
 * block reveal on its own so the page still arrives with intent.
 *
 * The overlay is in the server HTML so the page never flashes before it, with a
 * CSS failsafe (.dm-preloader) that hides it if JavaScript never runs.
 */
export function Preloader({ onDone }: { onDone: () => void }) {
  const [stage, setStage] = useState<Stage>('count');
  const [pct, setPct] = useState(0);

  useEffect(() => {
    let seen = false;
    try { seen = sessionStorage.getItem(SEEN_KEY) === '1'; } catch { /* private mode */ }
    if (seen || prefersReducedMotion()) {
      setStage('reveal');
      onDone();
      return;
    }
    setScrollLocked(true);
    window.scrollTo(0, 0);

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / COUNT_MS);
      // Fast off the surface, slows as it nears the bottom — like a lift
      // braking into the last floor.
      const eased = 1 - Math.pow(1 - t, 2.4);
      setPct(Math.round(eased * 100));
      if (t < 1) raf = requestAnimationFrame(tick);
      else window.setTimeout(() => setStage('exit'), 220);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); setScrollLocked(false); };
    // onDone is stable for the page's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (stage !== 'exit') return;
    // Marked seen only once it has actually played — React's dev double-mount
    // would otherwise flag it on the first pass and skip it on the second.
    try { sessionStorage.setItem(SEEN_KEY, '1'); } catch { /* ignore */ }
    const t = window.setTimeout(() => {
      setStage('reveal');
      setScrollLocked(false);
      // Start the hero while the blocks are still clearing, so the two overlap.
      window.setTimeout(onDone, 260);
    }, 620);
    return () => window.clearTimeout(t);
  }, [stage, onDone]);

  if (stage === 'done') return null;
  if (stage === 'reveal') {
    return <PixelShutter mode="reveal" color="#07080f" edge="#9184d9" durationMs={980} zIndex={300} onDone={() => setStage('done')} />;
  }

  const floor = Math.min(10, Math.max(1, Math.ceil(pct / 10)));
  const theme = floorTheme(floor);
  const depth = Math.round(pct * 2.4);

  return (
    <div className="dm-preloader" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Yükleniyor">
      {/* The floor's own stone tint bleeding in as the counter descends. */}
      <div
        aria-hidden
        className="absolute inset-0 transition-[background] duration-300"
        style={{ background: `radial-gradient(ellipse 70% 55% at 50% 60%, ${theme.wall[1]}55, transparent 70%)` }}
      />

      <motion.div
        className="relative flex w-full max-w-[1240px] flex-col px-[clamp(16px,4vw,40px)]"
        animate={stage === 'exit' ? { y: '-6vh', opacity: 0 } : { y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: EASE_IN_OUT }}
      >
        <div className="flex items-end justify-between gap-6 font-mono text-[11px] uppercase tracking-[0.32em] text-zinc-400">
          <span>Zephara</span>
          <span className="tabular-nums">−{String(depth).padStart(3, '0')}m</span>
        </div>

        {/* The counter. Plain tabular digits — it changes every frame, and a
            per-digit roll at that rate only smeared into overlapping glyphs. */}
        <div className="mt-4 flex items-end justify-between gap-4">
          <div className="dm-preloader-count" aria-hidden>{String(pct).padStart(3, '0')}</div>
          <div className="mb-[0.6em] hidden text-right sm:block">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500">Kat {String(floor).padStart(2, '0')}</p>
            <div className="mt-1 h-[1.4em] overflow-hidden">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.p
                  key={floor}
                  className="text-lg font-medium tracking-tight"
                  style={{ color: theme.accent }}
                  initial={{ y: '100%', opacity: 0 }}
                  animate={{ y: '0%', opacity: 1 }}
                  exit={{ y: '-100%', opacity: 0 }}
                  transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}
                >
                  {theme.name}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Ten segments, one per floor, lit as the counter passes them. */}
        <div className="mt-6 grid grid-cols-10 gap-[3px]">
          {Array.from({ length: 10 }).map((_, i) => {
            const lit = Math.min(1, Math.max(0, pct / 10 - i));
            const c = floorTheme(i + 1).accent;
            return (
              <span key={i} className="relative block h-[3px] overflow-hidden bg-white/[0.07]">
                <span
                  className="absolute inset-y-0 left-0"
                  style={{ width: `${lit * 100}%`, background: c, boxShadow: lit > 0 ? `0 0 10px ${c}` : undefined }}
                />
              </span>
            );
          })}
        </div>
        <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500 sm:hidden" style={{ color: theme.accent }}>
          {theme.name}
        </p>
      </motion.div>
    </div>
  );
}

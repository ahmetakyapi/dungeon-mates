'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, useMotionValueEvent, useScroll, useSpring, useTransform } from 'framer-motion';
import { ACTS, FLOOR_LORE, floorTheme } from '../../../../shared/types';
import { FloorStrip } from '../FloorStrip';
import { RevealText } from './RevealText';

const BOSS_FLOORS: Record<number, string> = { 3: 'Boss', 5: 'Boss', 7: 'Boss', 8: 'Boss', 10: 'Final' };

// useLayoutEffect warns during SSR; the measurement only matters in the browser.
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * The ten floors as a pinned horizontal descent.
 *
 * Vertical scroll drives a sideways track, so going "down" the page walks the
 * reader floor by floor along the shaft. The pinned frame takes on the stone
 * colour of whichever floor is centred — read from the same palette module the
 * game paints tiles with — and a gauge along the bottom keeps count.
 */
export function FloorGallery() {
  const ref = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [dist, setDist] = useState(0);
  const [active, setActive] = useState(0); // 0 = intro panel, 1..10 floors

  useIsoLayoutEffect(() => {
    const measure = () => {
      if (!track.current) return;
      setDist(Math.max(0, track.current.scrollWidth - window.innerWidth));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (track.current) ro.observe(track.current);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, []);

  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const xRaw = useTransform(scrollYProgress, (v) => -v * dist);
  const x = useSpring(xRaw, { stiffness: 170, damping: 32, mass: 0.35 });
  const bar = useSpring(scrollYProgress, { stiffness: 170, damping: 32 });

  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    // Eleven panels; the intro owns the first sliver.
    const idx = Math.min(10, Math.max(0, Math.round(v * 10.4)));
    setActive((prev) => (prev === idx ? prev : idx));
  });

  const floor = Math.max(1, active);
  const theme = floorTheme(floor);

  return (
    <section
      ref={ref}
      id="katalog"
      className="dm-gallery"
      style={{ height: `calc(100vh + ${dist}px)` }}
      aria-label="Katlar"
    >
      <div className="dm-gallery-pin">
        {/* Stone wash of the centred floor. Crossfades through CSS. */}
        <div
          aria-hidden
          className="dm-gallery-wash"
          style={{
            background: `radial-gradient(ellipse 80% 70% at 60% 55%, ${theme.wall[1]}66, transparent 70%), radial-gradient(ellipse 50% 40% at 20% 90%, ${theme.accent}22, transparent 70%)`,
          }}
        />

        <motion.div ref={track} className="dm-gallery-track" style={{ x }}>
          {/* Intro panel */}
          <div className="dm-gallery-intro">
            <p className="dm-eyebrow"><span className="dm-eyebrow-num">02</span> Katlar · 01 — 10</p>
            <RevealText as="h2" className="dm-display" text="Her kat kendi rengiyle karşılar." />
            <p className="dm-muted" style={{ maxWidth: '38ch', marginTop: 18 }}>
              Kaydırdıkça bir kat daha in. Taşın rengi, ışığı, büyüyen yosunu — hepsi oyunun
              kendi paletinden.
            </p>
            <div className="dm-gallery-acts">
              {ACTS.map((a) => (
                <div key={a.id}>
                  <span className="dm-eyebrow" style={{ color: 'var(--color-ember)' }}>{a.roman}</span>
                  <span>{a.name}</span>
                  <em>{a.question}</em>
                </div>
              ))}
            </div>
          </div>

          {Array.from({ length: 10 }, (_, i) => i + 1).map((f) => {
            const t = floorTheme(f);
            const lore = FLOOR_LORE[f];
            const act = ACTS.find((a) => a.floors[0] === f);
            const boss = BOSS_FLOORS[f];
            const on = active === f;
            return (
              <div key={f} className="dm-gallery-slot">
                {act && (
                  <div className="dm-gallery-act" aria-hidden>
                    <span>{act.roman}</span>
                    <span>{act.name}</span>
                  </div>
                )}
                <article
                  className="dm-floor-panel"
                  data-on={on ? 'true' : undefined}
                  style={{ ['--floor-accent' as string]: t.accent, ['--floor-wall' as string]: t.wall[1] }}
                >
                  <div className="dm-floor-panel-strip">
                    <FloorStrip floor={f} />
                    <span aria-hidden className="dm-floor-panel-strip-fade" />
                  </div>
                  <span aria-hidden className="dm-floor-num">{String(f).padStart(2, '0')}</span>
                  <div className="dm-floor-panel-body">
                    <div className="dm-floor-panel-head">
                      <h3>{t.name}</h3>
                      {boss && <span className="dm-floor-tag">{boss}</span>}
                    </div>
                    <p className="dm-floor-lore">{lore.lore}</p>
                    <p className="dm-floor-reveal">“{lore.reveal}”</p>
                    <div aria-hidden className="dm-floor-ramp">
                      {[...t.wall, t.growth, t.accent].map((c, ci) => (
                        <span key={ci} style={{ background: c }} />
                      ))}
                    </div>
                    <p className="dm-floor-depth">−{f * 24}m</p>
                  </div>
                </article>
              </div>
            );
          })}
          <div className="dm-gallery-end" aria-hidden>
            <span>Dip.</span>
          </div>
        </motion.div>

        {/* Gauge */}
        <div className="dm-gallery-gauge" aria-hidden>
          <span className="dm-gallery-gauge-label" style={{ color: theme.accent }}>
            {active === 0 ? 'Yüzey' : `Kat ${String(active).padStart(2, '0')} · ${theme.name}`}
          </span>
          <div className="dm-gallery-gauge-bar">
            <motion.span style={{ scaleX: bar, background: theme.accent }} />
            {Array.from({ length: 10 }).map((_, i) => (
              <i key={i} style={{ left: `${((i + 1) / 10.4) * 100}%` }} data-on={active >= i + 1 ? 'true' : undefined} />
            ))}
          </div>
          <span className="dm-gallery-gauge-depth">−{String(active * 24).padStart(3, '0')}m</span>
        </div>
      </div>
    </section>
  );
}

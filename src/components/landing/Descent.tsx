'use client';

import { useEffect, useRef, useState } from 'react';
import { FloorStrip } from './FloorStrip';
import { DepthGauge } from './DepthGauge';
import { floorTheme } from '../../../shared/types';

/** Act structure from STORY.md — the descent is not a flat list of ten rooms. */
const ACTS: Record<number, string> = {
  1: 'I. Perde — Yüzey',
  5: 'II. Perde — Derinlikler',
  8: 'III. Perde — Karanlığın Kalbi',
};

/** What the player actually meets on each floor. Concrete, not marketing copy. */
const FLOOR_NOTES: Record<number, string> = {
  1: 'Sıçanlar, balçıklar, yarasalar. Kapılar hâlâ menteşelerinde.',
  2: 'İskeletler ve örümcekler. Sokaklar boşaldığından beri kimse süpürmedi.',
  3: 'Ocak Muhafızı burada bekliyor. Yer sarsıntısı önce zeminde görünür.',
  4: 'Tezgâhlar devrilmiş, mal yerinde. Goblinler pazarlığı sevmiyor.',
  5: 'Örümcek Kraliçe. Ağ hattına girersen yavaşlarsın; ikinci fazda kök salar.',
  6: 'Raflar arasında gargoyleler var ve taş fırlatıyorlar. Siperi kullan.',
  7: 'Taş Muhafız taşlaştırma bakışını koni hâlinde gösterir. Koniden çık.',
  8: 'Alev Şövalyesi hücuma kalkar. Hücum çizgisi zeminde belirir.',
  9: 'Fantomlar duvarlardan geçer, ruh oku atar. Açık alanda durma.',
  10: "Taht Salonu. Mor'Khan üç faz, her fazda daha hızlı.",
};

export function Descent() {
  const [activeFloor, setActiveFloor] = useState(1);
  const [floorProgress, setFloorProgress] = useState(0);
  const sectionRefs = useRef<Array<HTMLElement | null>>([]);

  // Track which floor band occupies the middle of the viewport, and how far
  // through it the reader is — that drives both the gauge and the page tint.
  useEffect(() => {
    const onScroll = () => {
      const mid = window.innerHeight / 2;
      for (let i = 0; i < sectionRefs.current.length; i++) {
        const el = sectionRefs.current[i];
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (r.top <= mid && r.bottom >= mid) {
          setActiveFloor(i + 1);
          setFloorProgress(Math.min(1, Math.max(0, (mid - r.top) / r.height)));
          return;
        }
      }
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const active = floorTheme(activeFloor);

  return (
    <section id="inis" className="relative">
      <DepthGauge floor={activeFloor} progress={floorProgress} />

      {/* Ambient wash driven by the floor the reader is currently in. The colour
          is read from the same palette module the game renders tiles with, so the
          page literally takes on the colour of the floor being described. */}
      <div
        className="pointer-events-none fixed inset-0 -z-10 transition-colors duration-700"
        style={{ background: `radial-gradient(ellipse at 50% 40%, ${active.wall[1]}22, transparent 65%)` }}
      />

      <div className="mx-auto max-w-5xl px-5 pb-24 pt-10 sm:px-8">
        {Array.from({ length: 10 }).map((_, i) => {
          const floor = i + 1;
          const theme = floorTheme(floor);
          const act = ACTS[floor];
          const isBoss = floor === 3 || floor === 5 || floor === 7 || floor === 8 || floor === 10;

          return (
            <div key={floor}>
              {act && (
                <p className="mb-5 mt-16 font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-600 first:mt-0">
                  {act}
                </p>
              )}

              <article
                ref={(el) => { sectionRefs.current[i] = el; }}
                className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 border-t border-white/[0.06] py-8 sm:gap-x-7 sm:py-10"
              >
                {/* Floor numeral — a real sequence, so numbering carries meaning */}
                <span
                  className="font-mono text-2xl font-semibold tabular-nums leading-none sm:text-4xl"
                  style={{ color: theme.accent }}
                >
                  {String(floor).padStart(2, '0')}
                </span>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h3 className="font-pixel text-[11px] leading-relaxed text-zinc-100 sm:text-sm">
                      {theme.name}
                    </h3>
                    {isBoss && (
                      <span
                        className="rounded-sm px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest"
                        style={{ color: theme.accent, background: `${theme.accent}1a` }}
                      >
                        boss
                      </span>
                    )}
                  </div>

                  <p className="mt-2 max-w-prose font-body text-sm leading-relaxed text-zinc-400">
                    {FLOOR_NOTES[floor]}
                  </p>

                  {/* The floor's actual stone ramp, straight from the palette */}
                  <div className="mt-4 flex items-center gap-2">
                    <div className="flex overflow-hidden rounded-sm">
                      {[...theme.wall, theme.growth, theme.accent].map((c, ci) => (
                        <span key={ci} className="h-3.5 w-5" style={{ background: c }} />
                      ))}
                    </div>
                    <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-700">
                      palet
                    </span>
                  </div>
                </div>

                {/* Real tiles, drawn by the game's renderer */}
                <div className="col-span-2 mt-4 min-w-0 overflow-hidden rounded border border-white/[0.06]">
                  <div className="h-[68px] sm:h-[84px]">
                    <FloorStrip floor={floor} />
                  </div>
                </div>
              </article>
            </div>
          );
        })}
      </div>
    </section>
  );
}

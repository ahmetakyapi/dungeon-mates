'use client';

import { useEffect, useRef, useState } from 'react';
import { ACTS, FLOOR_LORE, floorTheme } from '../../../../shared/types';
import { FloorStrip } from '../FloorStrip';
import { RevealText } from './RevealText';

const BOSS_FLOORS: Record<number, string> = { 3: 'Boss', 5: 'Boss', 7: 'Boss', 8: 'Boss', 10: 'Final' };
const FLOORS = Array.from({ length: 10 }, (_, i) => i + 1);
/** Landing'in derinlik dili: her kat 24 metre. Nav göstergesiyle aynı ölçek. */
const METERS_PER_FLOOR = 24;

/**
 * The ten floors as a vertical shaft.
 *
 * It used to be a pinned sideways gallery — the same "scroll down, slide
 * across" device other landings use, six screens long with 13px copy. A
 * dungeon is a descent, so the floors now stack the way they are played: one
 * under the other. The left column stays put and reads out where the reader
 * is (depth, floor, act); the right column is the floors themselves.
 *
 * Nothing here is scroll-linked per frame. An IntersectionObserver picks the
 * floor crossing the middle of the screen — eleven state changes for the
 * whole section — and CSS transitions do the rest.
 */
export function FloorShaft() {
  const [active, setActive] = useState(0); // 0 = above the first floor
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const f = Number((e.target as HTMLElement).dataset.floor);
          if (f) setActive(f);
        }
      },
      // A thin band across the middle of the viewport: whichever floor is in it is "here".
      { rootMargin: '-48% 0px -48% 0px' },
    );
    list.querySelectorAll<HTMLElement>('[data-floor]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const floor = Math.max(1, active);
  const theme = floorTheme(floor);
  const act = ACTS.find((a) => a.floors.includes(floor)) ?? ACTS[0];

  return (
    <section id="katalog" className="dm-shaft dm-section dm-wrap" aria-label="Katlar">
      <div className="dm-shaft-grid">
        <aside className="dm-shaft-side" style={{ ['--floor-accent' as string]: theme.accent }}>
          <RevealText as="h2" className="dm-display dm-shaft-title" text="On Kat, Üç Perde" />
          <p className="dm-lead dm-shaft-intro">
            Her kat farklı bir mahalle: kendi taşı, kendi düşmanları, kendi hikâyesi. Renkler
            oyunun kendi paletinden geliyor.
          </p>

          {/* Where the reader is. Desktop only: on a phone the column is not sticky. */}
          <div className="dm-shaft-gauge" aria-hidden>
            <span className="dm-shaft-depth">
              −{String(active * METERS_PER_FLOOR).padStart(3, '0')} m
            </span>
            <span className="dm-shaft-here">
              {active === 0 ? 'Yüzeydesin' : `Kat ${active} · ${theme.name}`}
            </span>
            <span className="dm-shaft-ticks">
              {FLOORS.map((f) => (
                <i key={f} data-on={active >= f ? 'true' : undefined} />
              ))}
            </span>
          </div>

          <ol className="dm-shaft-acts">
            {ACTS.map((a) => (
              <li key={a.id} data-on={active > 0 && a.id === act.id ? 'true' : undefined}>
                <span className="dm-shaft-act-name">{a.roman} · {a.name}</span>
                <span className="dm-shaft-act-q">{a.question}</span>
              </li>
            ))}
          </ol>
        </aside>

        <ol ref={listRef} className="dm-shaft-list">
          {FLOORS.map((f) => {
            const t = floorTheme(f);
            const lore = FLOOR_LORE[f];
            const boss = BOSS_FLOORS[f];
            const startsAct = ACTS.find((a) => a.floors[0] === f);
            return (
              <li key={f} data-floor={f}>
                {startsAct && (
                  <p className="dm-shaft-divider">
                    <span>{startsAct.roman}</span> {startsAct.name}
                  </p>
                )}
                <article
                  className="dm-shaft-floor"
                  data-on={active === f ? 'true' : undefined}
                  style={{ ['--floor-accent' as string]: t.accent, ['--floor-wall' as string]: t.wall[1] }}
                >
                  <div className="dm-shaft-strip">
                    <FloorStrip floor={f} />
                  </div>
                  <div className="dm-shaft-body">
                    <div className="dm-shaft-head">
                      <span className="dm-shaft-num">{String(f).padStart(2, '0')}</span>
                      <h3>{t.name}</h3>
                      {boss && <span className="dm-floor-tag">{boss}</span>}
                      <span className="dm-shaft-m">−{f * METERS_PER_FLOOR} m</span>
                    </div>
                    <p className="dm-shaft-lore">{lore.lore}</p>
                    <p className="dm-shaft-reveal">“{lore.reveal}”</p>
                  </div>
                </article>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

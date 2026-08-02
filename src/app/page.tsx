'use client';

/*
 * Landing page — the "Dungeon Mates Landing v2" design from the user's Claude
 * Design project, built on its Nocturne design system.
 *
 * Nocturne: near-neutral blue-grey ground (#161826), Inter at medium weight, 8px
 * radii, a single blurple accent used as a line and a glow rather than a flood,
 * outlined buttons, left-aligned asymmetric layout, and rules that fade to
 * transparent at their ends. Compact by design — density 0.70×.
 *
 * The source file is a `.dc.html` design-canvas document: it depends on an
 * `<x-dc>` runtime, `{{ }}` bindings and `<image-slot>` custom elements that only
 * exist inside the design host. This is a port of that design onto React, taking
 * the system's tokens and component classes verbatim (src/styles/nocturne.css)
 * and reproducing the layout, copy and motion — not a copy of markup that could
 * not run here.
 *
 * Imagery: the six slots in the source are all game content — "oyun içi ekran
 * görüntüsü", "boss odası / geniş sahne", "karakter görseli". Stock photography
 * would misrepresent a pixel-art game, so none is used.
 *
 * The three scene slots are not screenshots either: <LiveScene> renders the
 * dungeon with the game's own SpriteRenderer and runs the real windup → active →
 * recovery cycle straight out of ATTACK_PROFILES, so the page demonstrates the
 * mechanic rather than illustrating it, and it stays correct when combat is
 * retuned. The class portraits are captures of the game's own PixelHero sprites,
 * dark-grounded — exactly what the system's `.lighten` wrapper wants.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { CLASS_STATS, type PlayerClass, floorTheme, ACTS, FLOOR_LORE, PROLOGUE, CALLING } from '../../shared/types';
import { LiveScene, type ScenePhase, type PhaseEvent } from '@/components/landing/LiveScene';
import { ClassPortrait } from '@/components/landing/ClassPortrait';
import { MetaProgression } from '@/components/game/MetaProgression';
import { loadMeta, type MetaState } from '@/lib/meta-progression';
import '../styles/nocturne.css';

type Mode = 'idle' | 'multiplayer';

// Acts and per-floor copy come from shared/lore.ts, the same table the game
// itself narrates from. The page used to carry its own, and the two had already
// drifted — the landing still called Act III "Karanlığın Kalbi" and the final
// boss "Mor'Khan" while the game called them "Ateşin Kalbi" and "Karanmir".


const BOSS_FLOORS: Record<number, string> = { 3: 'BOSS', 5: 'BOSS', 7: 'BOSS', 8: 'BOSS', 10: 'FİNAL' };

const CLASSES: ReadonlyArray<{
  key: PlayerClass; role: string; art: string; line: string;
}> = [
  { key: 'warrior', role: 'Ön Saf', art: '/art/class-savasci.png', line: 'Kalkan duvarı hasarı yutar. Ağır düşmanı hazırlık anında sersemletir.' },
  { key: 'mage', role: 'Alan Hasarı', art: '/art/class-buyucu.png', line: 'Buz fırtınası yavaşlatır. Yanan hedefe buz vurulursa dondurur.' },
  { key: 'archer', role: 'Menzil', art: '/art/class-okcu.png', line: 'En hızlı sınıf. Kritik yığar; ok yağmuru koridoru kapatır.' },
  { key: 'healer', role: 'Destek', art: '/art/class-sifaci.png', line: 'Takımı ayakta tutar. Ultimate ekibe üç saniye dokunulmazlık verir.' },
];

/**
 * The one saturated band the system allows.
 *
 * `to` counts up when the band scrolls into view; `text` is for the two values
 * that are not numbers and should just appear. A number that counts is worth
 * reading — five static numbers on a flat field were wallpaper.
 */
const STATS: ReadonlyArray<{ label: string; to?: number; text?: string; suffix?: string }> = [
  { label: 'Kat', to: 10 },
  { label: 'Sınıf', to: 4 },
  { label: 'Canavar', to: 17 },
  { label: 'Oyuncu', text: '1–4' },
  { label: 'Kurulum', text: 'Yok' },
];

/** Counts from 0 to `to` once `run` flips true. Respects reduced motion. */
function useCountUp(to: number, run: boolean, ms = 900): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!run) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setN(to); return; }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      // Ease-out so the last few digits settle rather than snapping.
      setN(Math.round(to * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, run, ms]);
  return n;
}

function StatCell({ stat, run, index }: {
  stat: (typeof STATS)[number]; run: boolean; index: number;
}) {
  const counted = useCountUp(stat.to ?? 0, run);
  const value = stat.text ?? String(counted);
  return (
    <div style={{
      position: 'relative',
      // Hairline separators that fade out at both ends — the same signature the
      // system uses for its rules, turned on its side.
      paddingLeft: index === 0 ? 0 : 'clamp(14px, 2.4vw, 30px)',
      background: index === 0 ? undefined
        : 'linear-gradient(to bottom, transparent, color-mix(in srgb, var(--color-neutral-100) 26%, transparent) 22%, color-mix(in srgb, var(--color-neutral-100) 26%, transparent) 78%, transparent) no-repeat left / 1px 100%',
    }}>
      <div style={{
        fontSize: 'clamp(30px, 4.6vw, 48px)', fontWeight: 500,
        letterSpacing: '-0.035em', lineHeight: 1,
        fontVariantNumeric: 'tabular-nums',
        // A touch of light on the numerals so they sit on the field rather than
        // being painted flat onto it.
        background: 'linear-gradient(180deg, #ffffff 0%, color-mix(in srgb, var(--color-neutral-200) 78%, transparent) 100%)',
        WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
      }}>{value}</div>
      <div style={{
        fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase',
        opacity: 0.62, marginTop: 10, fontWeight: 500,
      }}>{stat.label}</div>
    </div>
  );
}

/**
 * How far the telegraph demonstration is slowed for the page.
 *
 * The real active frame is 200ms; at that speed the middle row lit and cleared
 * before it could be read, so the list looked like it jumped from wind-up
 * straight to recovery. Only the clock is stretched — the phases keep their
 * true proportions.
 */
const TELEGRAPH_SLOWDOWN = 4;

const PHASE_ROWS: ReadonlyArray<{
  key: ScenePhase; num: string; label: string; time: string; note: string;
}> = [
  { key: 'windup', num: '01', label: 'Hazırlık', time: '0.25 – 0.65 sn', note: 'alan dolar' },
  { key: 'active', num: '02', label: 'Vuruş', time: '0.1 – 0.2 sn', note: 'hasar çözülür' },
  { key: 'recovery', num: '03', label: 'Toparlanma', time: '0.2 – 0.7 sn', note: 'karşılık ver' },
];

const CONTROLS: ReadonlyArray<readonly [string, string]> = [
  ['WASD', 'Hareket'], ['Fare', 'Nişan'], ['Sol Tık', 'Saldırı'],
  ['Q', 'Takla'], ['E', 'Yetenek'], ['F', 'Ultimate'], ['R', 'Etkileşim'],
];

/**
 * Reveal-on-scroll.
 *
 * `armed` only becomes true once the effect has run, so the server-rendered
 * markup and any no-JS render are fully visible. Hiding content by default would
 * mean a failed observer leaves whole sections permanently blank — which is
 * exactly what happened before this guard: the mechanic and class sections
 * rendered at opacity 0 and never came back.
 *
 * Reduced motion skips the animation entirely.
 */
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [armed, setArmed] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setShown(true); return; }
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setShown(true); return; }
    setArmed(true);
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } },
      { rootMargin: '0px 0px -6% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const hidden = armed && !shown;
  return {
    ref,
    shown,
    style: {
      animation: shown ? 'dmRise .7s cubic-bezier(.22,1,.36,1) both' : undefined,
      opacity: hidden ? 0 : 1,
    } as const,
  };
}

export default function HomePage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('idle');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [metaOpen, setMetaOpen] = useState(false);
  const [meta, setMeta] = useState<MetaState | null>(null);
  const [scrolled, setScrolled] = useState(false);
  // Driven by the live scene so the phase list reads out what is on screen.
  // `seq` increments on every change so React remounts the fill element and the
  // CSS animation restarts even when the same phase comes round again.
  const [phase, setPhase] = useState<{ phase: ScenePhase; durationMs: number; seq: number }>(
    { phase: 'idle', durationMs: 0, seq: 0 },
  );
  const onPhase = useCallback((e: PhaseEvent) => {
    setPhase((prev) => ({ phase: e.phase, durationMs: e.durationMs, seq: prev.seq + 1 }));
  }, []);

  useEffect(() => { setMeta(loadMeta()); }, [metaOpen]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const go = useCallback((id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), []);

  const createRoom = useCallback(() => {
    if (!name.trim()) { setError('Önce bir isim gir.'); return; }
    setError('');
    router.push(`/game?room=new&name=${encodeURIComponent(name.trim())}`);
  }, [name, router]);

  const joinRoom = useCallback(() => {
    if (!name.trim()) { setError('Önce bir isim gir.'); return; }
    if (code.trim().length !== 4) { setError('Oda kodu 4 haneli.'); return; }
    setError('');
    router.push(`/game?room=${code.trim().toUpperCase()}&name=${encodeURIComponent(name.trim())}`);
  }, [name, code, router]);

  const floorNames = useMemo(() => Array.from({ length: 10 }, (_, i) => floorTheme(i + 1).name), []);

  const catalogue = useReveal<HTMLElement>();
  const mechanic = useReveal<HTMLElement>();
  const classSec = useReveal<HTMLElement>();
  const rhythm = useReveal<HTMLElement>();
  const statBand = useReveal<HTMLElement>();
  const story = useReveal<HTMLElement>();

  return (
    <div className="nocturne" style={{ position: 'relative', overflowX: 'clip', minHeight: '100dvh' }}>
      {/* ── Nav ─────────────────────────────────────────────── */}
      <nav
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
          display: 'flex', alignItems: 'center', gap: 28, padding: '14px clamp(16px, 4vw, 40px)',
          transition: 'background .35s ease, box-shadow .35s ease, backdrop-filter .35s ease',
          background: scrolled ? 'color-mix(in srgb, var(--color-bg) 82%, transparent)' : 'transparent',
          backdropFilter: scrolled ? 'blur(14px)' : 'none',
          boxShadow: scrolled ? '0 1px 0 0 var(--color-divider)' : 'none',
        }}
      >
        <a href="#top" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
           style={{ display: 'flex', alignItems: 'center', gap: 11, textDecoration: 'none', color: 'var(--color-text)', marginRight: 'auto' }}>
          {/* The mark: a rotating square that pulses — accent as a line and a glow */}
          <span aria-hidden style={{
            width: 18, height: 18, display: 'block',
            border: '1.5px solid var(--color-accent)', borderRadius: 2,
            animation: 'dmPulse 3.4s ease-in-out infinite',
            boxShadow: '0 0 16px color-mix(in srgb, var(--color-accent) 50%, transparent)',
          }} />
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>Dungeon Mates</span>
        </a>

        <div className="dm-navlinks">
          <button className="btn btn-ghost" onClick={() => go('hikaye')}>Hikâye</button>
          <button className="btn btn-ghost" onClick={() => go('katalog')}>Katlar</button>
          <button className="btn btn-ghost" onClick={() => go('telegraf')}>Dövüş</button>
          <button className="btn btn-ghost" onClick={() => go('siniflar')}>Sınıflar</button>
          <button className="btn btn-ghost" onClick={() => setMetaOpen(true)}>
            Kalıntılar{meta && meta.shards > 0 ? ` ${meta.shards}` : ''}
          </button>
        </div>
        <button className="btn btn-primary" onClick={() => go('oyna')}>Oyna</button>
      </nav>

      {/* ── Hero ────────────────────────────────────────────── */}
      <header id="top" style={{ padding: 'clamp(96px, 14vh, 150px) clamp(16px, 4vw, 40px) 0', maxWidth: 1240, margin: '0 auto' }}>
        <div className="dm-hero-grid" style={{ display: 'grid', gap: 'clamp(28px, 5vw, 64px)', alignItems: 'center' }}>
          <div style={{ minWidth: 0 }}>
            <p className="text-muted" style={{ fontSize: 12, letterSpacing: '0.18em', textTransform: 'uppercase', margin: 0 }}>
              Zephara · Yüzeyin Altı
            </p>

            <h1 className="balance" style={{
              fontSize: 'clamp(34px, 5.4vw, 62px)', lineHeight: 1.06, marginTop: 18,
              letterSpacing: '-0.03em', fontWeight: 600,
            }}>
              On Kat Aşağı<br />
              <span style={{ color: 'var(--color-accent)' }}>Tek Çıkış En Dipte</span>
            </h1>

            <p className="text-muted" style={{ maxWidth: '52ch', fontSize: 16, marginTop: 22, lineHeight: 1.6 }}>
              Tarayıcıda açılan co-op zindan. Düşmanlar vuracakları yeri önce zeminde
              gösterir — okuyabilirsen kaçabilirsin. Dört sınıf, on kat, bir yozlaşmış kral.
            </p>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 28 }}>
              <button className="btn btn-primary" style={{ padding: '10px 18px' }}
                      onClick={() => router.push('/game?mode=solo&name=Kahraman')}>
                Tek Oyna
              </button>
              <button className="btn btn-secondary" style={{ padding: '10px 18px' }} onClick={() => go('oyna')}>
                Arkadaşlarınla Oyna
              </button>
            </div>

            <p className="text-muted" style={{ fontSize: 12, marginTop: 16 }}>
              Kurulum yok · Ücretsiz · Tarayıcıda anında
            </p>
          </div>

          {/* Key visual — a real capture of the running game */}
          <figure style={{ position: 'relative', minWidth: 0 }}>
            <div style={{
              position: 'relative', borderRadius: 'var(--radius-lg)', overflow: 'hidden',
              boxShadow: 'var(--shadow-md)', aspectRatio: '4 / 3',
            }}>
              {/* A still screenshot sat awkwardly in this frame and could never fill
                  it at a fixed aspect. This is the game rendering live instead. */}
              <LiveScene scene="skirmish" floor={10} cols={14} rows={11} showLabel={false} />
              {/* Accent sweep — a line of light, never a flood */}
              <span aria-hidden style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                background: 'linear-gradient(100deg, transparent 40%, color-mix(in srgb, var(--color-accent) 18%, transparent) 50%, transparent 60%)',
                animation: 'dmSweep 6.5s ease-in-out infinite',
              }} />
            </div>
            <figcaption>Kat 10 · Taht Salonu — gerçek zamanlı, oyunun kendi render&apos;ı</figcaption>
          </figure>
        </div>

        {/* Floor-name marquee */}
        <div aria-hidden style={{ marginTop: 'clamp(40px, 7vh, 78px)', overflow: 'hidden', maskImage: 'linear-gradient(to right, transparent, #000 12%, #000 88%, transparent)' }}>
          <div style={{ display: 'flex', width: 'max-content', animation: 'dmMarquee 42s linear infinite' }}>
            {[0, 1].map((dup) => (
              <div key={dup} style={{ display: 'flex', gap: 40, paddingRight: 40 }}>
                {floorNames.map((n, i) => (
                  <span key={`${dup}-${n}`} className="text-muted" style={{ fontSize: 13, whiteSpace: 'nowrap', letterSpacing: '0.06em' }}>
                    <span style={{ color: 'var(--color-accent)', marginRight: 8 }}>{String(i + 1).padStart(2, '0')}</span>
                    {n}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* ── Stat band — the one full-bleed saturated field the system allows ── */}
      <section ref={statBand.ref} style={{
        marginTop: 'clamp(44px, 8vh, 92px)', position: 'relative', overflow: 'hidden',
        // A field with a light source in it rather than a flat fill.
        background: 'linear-gradient(160deg, var(--color-section-glow) -10%, var(--color-section) 55%, #1e2150 100%)',
        boxShadow: 'inset 0 1px 0 color-mix(in srgb, var(--color-neutral-100) 14%, transparent), inset 0 -1px 0 rgba(0,0,0,0.35)',
      }}>
        <span aria-hidden style={{
          position: 'absolute', inset: '-40% 30% auto -10%', height: '180%',
          background: 'radial-gradient(closest-side, var(--color-section-glow), transparent)', opacity: .8,
        }} />
        <div style={{
          position: 'relative', maxWidth: 1240, margin: '0 auto',
          padding: 'clamp(22px, 4vw, 38px) clamp(16px, 4vw, 40px)',
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(120px, 100%), 1fr))', gap: 18,
        }}>
          {STATS.map((stat, i) => (
            <StatCell key={stat.label} stat={stat} run={statBand.shown} index={i} />
          ))}
        </div>
      </section>

      {/* ── Story ───────────────────────────────────────────── */}
      <section id="hikaye" ref={story.ref} style={{ ...story.style, maxWidth: 1240, margin: '0 auto', padding: 'clamp(56px, 10vh, 110px) clamp(16px, 4vw, 40px) 0' }}>
        <h6 className="text-muted">Hikâye</h6>
        <h2 className="balance" style={{ fontSize: 'clamp(28px, 4.4vw, 46px)', letterSpacing: '-0.025em', maxWidth: '22ch' }}>
          Sana Bir Canavarı Öldürmen Söylendi
        </h2>

        <div className="dm-story-grid" style={{ display: 'grid', gap: 'clamp(28px, 4vw, 64px)', marginTop: 34, alignItems: 'start' }}>
          {/*
            The prologue as a descent rather than a list. A lit spine runs down
            the left with a node per beat, and an ember travels it on a loop —
            the story is about a fire going down into the ground, so the eye is
            led the same way. Beats stagger in as the section reveals.
          */}
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, position: 'relative' }}>
            <span aria-hidden style={{
              position: 'absolute', left: 7, top: 6, bottom: 6, width: 2, borderRadius: 2,
              background: 'linear-gradient(to bottom, color-mix(in srgb, var(--color-accent) 55%, transparent), color-mix(in srgb, var(--color-accent) 12%, transparent) 70%, transparent)',
            }} />
            {story.shown && (
              <span aria-hidden style={{
                position: 'absolute', left: 4, top: 0, width: 8, height: 8, borderRadius: '50%',
                background: 'var(--color-accent-300)',
                boxShadow: '0 0 12px 3px color-mix(in srgb, var(--color-accent) 70%, transparent)',
                animation: 'dmEmber 7s cubic-bezier(.55,0,.45,1) infinite',
              }} />
            )}

            {PROLOGUE.map((line, i) => {
              const last = i === PROLOGUE.length - 1;
              return (
                <li
                  key={line}
                  style={{
                    position: 'relative', paddingLeft: 34,
                    paddingBottom: last ? 0 : 'clamp(16px, 2vw, 22px)',
                    animation: story.shown ? `dmBeatIn .6s cubic-bezier(.22,1,.36,1) ${0.08 * i}s both` : undefined,
                  }}
                >
                  <span aria-hidden style={{
                    position: 'absolute', left: 3, top: 8, width: 10, height: 10,
                    borderRadius: '50%', boxSizing: 'border-box',
                    border: `2px solid ${last ? 'var(--color-accent-300)' : 'color-mix(in srgb, var(--color-accent) 45%, transparent)'}`,
                    background: last ? 'var(--color-accent-300)' : 'var(--color-bg)',
                    boxShadow: last ? '0 0 14px 3px color-mix(in srgb, var(--color-accent) 60%, transparent)' : undefined,
                  }} />
                  <span style={{
                    display: 'block', maxWidth: '44ch',
                    fontSize: last ? 'clamp(17px, 2vw, 21px)' : 15,
                    lineHeight: 1.6,
                    color: last ? 'var(--color-text)' : undefined,
                    fontFamily: last ? 'var(--font-heading)' : undefined,
                    letterSpacing: last ? '-0.015em' : undefined,
                  }} className={last ? undefined : 'text-muted'}>
                    {line}
                  </span>
                </li>
              );
            })}
          </ol>

          <aside style={{ minWidth: 0, position: 'relative' }}>
            {/* A warm bloom behind the card — the Fire the copy is about,
                present as light rather than as an illustration of it. */}
            <span aria-hidden style={{
              position: 'absolute', inset: '-18% -12% auto -12%', height: '70%',
              background: 'radial-gradient(closest-side, color-mix(in srgb, var(--color-accent) 22%, transparent), transparent)',
              pointerEvents: 'none',
            }} />
            <div className="card elev-md" style={{ position: 'relative', padding: 20, gap: 12 }}>
              <span className="card-kicker">Neden Sen</span>
              {CALLING.map((line) => (
                <p key={line} className="card-body" style={{ fontSize: 14, lineHeight: 1.65, opacity: 0.92 }}>{line}</p>
              ))}
              <hr className="hr" style={{ margin: '6px 0' }} />
              <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6 }}>
                Aşağıda bulacağın şey bir canavar değil.{' '}
                <span style={{ color: 'var(--color-accent)' }}>
                  Altı yüz yıldır sönmeyi reddeden bir adam.
                </span>
              </p>
              <p className="text-muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>
                Onu öldürmek Ateş&apos;i söndürür — biri yerine geçmezse.
              </p>
            </div>
          </aside>
        </div>
      </section>

      {/* ── Catalogue ───────────────────────────────────────── */}
      <section id="katalog" ref={catalogue.ref} style={{ ...catalogue.style, maxWidth: 1240, margin: '0 auto', padding: 'clamp(56px, 10vh, 110px) clamp(16px, 4vw, 40px) 0' }}>
        <h6 className="text-muted">Katlar</h6>
        <h2 className="balance" style={{ fontSize: 'clamp(28px, 4.4vw, 46px)', letterSpacing: '-0.025em', maxWidth: '20ch' }}>
          Her Kat Kendi Rengiyle Karşılar
        </h2>

        <div style={{ marginTop: 34, display: 'grid', gap: 30 }}>
          {ACTS.map((act) => (
            <div key={act.roman}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 6 }}>
                <span style={{ color: 'var(--color-accent)', fontSize: 12, letterSpacing: '0.16em', textTransform: 'uppercase' }}>{act.roman}</span>
                <span className="text-muted" style={{ fontSize: 13 }}>{act.name}</span>
                <span aria-hidden style={{ flex: 1, height: 1, background: 'linear-gradient(to right, var(--color-divider), transparent)' }} />
              </div>
              <p className="text-muted" style={{ fontSize: 13, fontStyle: 'italic', margin: '0 0 14px' }}>
                {act.question}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(270px, 100%), 1fr))', gap: 16 }}>
                {act.floors.map((f) => {
                  const t = floorTheme(f);
                  const boss = BOSS_FLOORS[f];
                  return (
                    <article
                      key={f}
                      className="dm-floor-card"
                      style={{
                        // Each card is lit by the floor it describes: its own
                        // stone in the wash behind it, its own accent on the
                        // edge. Ten cards, ten palettes — which is the claim the
                        // heading makes, shown rather than stated.
                        position: 'relative', overflow: 'hidden',
                        borderRadius: 'var(--radius-md)',
                        padding: '15px 15px 13px',
                        background: `linear-gradient(158deg, ${t.wall[1]}2e 0%, var(--color-surface) 62%)`,
                        boxShadow: `inset 0 0 0 1px ${t.accent}2b`,
                        ['--floor-accent' as string]: t.accent,
                      }}
                    >
                      {/* The accent as a lit edge down the left. */}
                      <span aria-hidden style={{
                        position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
                        background: `linear-gradient(to bottom, ${t.accent}, ${t.accent}22)`,
                      }} />
                      {/* A soft pool of the floor's own light in the corner. */}
                      <span aria-hidden style={{
                        position: 'absolute', right: -30, top: -30, width: 120, height: 120,
                        borderRadius: '50%', pointerEvents: 'none',
                        background: `radial-gradient(closest-side, ${t.light}26, transparent)`,
                      }} />

                      <div style={{ position: 'relative', display: 'flex', alignItems: 'baseline', gap: 10 }}>
                        <span style={{
                          fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 26,
                          lineHeight: 1, letterSpacing: '-0.04em', color: t.accent,
                        }}>
                          {String(f).padStart(2, '0')}
                        </span>
                        <span className="card-title" style={{ flex: 1 }}>{t.name}</span>
                        {boss && (
                          <span style={{
                            fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase',
                            padding: '3px 7px', borderRadius: 4, whiteSpace: 'nowrap',
                            color: t.accent, border: `1px solid ${t.accent}55`,
                            background: `${t.accent}14`,
                          }}>{boss}</span>
                        )}
                      </div>

                      <p className="card-body" style={{ position: 'relative', marginTop: 8, minHeight: '3.2em' }}>
                        {FLOOR_LORE[f].lore}
                      </p>

                      {/* The floor's real stone ramp, straight from shared/palette.ts */}
                      <div aria-hidden style={{ position: 'relative', display: 'flex', gap: 2, marginTop: 10 }}>
                        {[...t.wall, t.growth, t.accent].map((c, i) => (
                          <span key={i} style={{ background: c, height: 5, flex: 1, borderRadius: 2 }} />
                        ))}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Full-bleed scene ────────────────────────────────── */}
      <section style={{ marginTop: 'clamp(56px, 10vh, 110px)', position: 'relative' }}>
        <figure style={{ position: 'relative' }}>
          <div style={{ width: '100%', height: 'clamp(220px, 34vw, 460px)' }}>
            <LiveScene scene="descend" cols={24} rows={8} showLabel={false} />
          </div>
          <span aria-hidden style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to bottom, var(--color-bg) 0%, transparent 22%, transparent 72%, var(--color-bg) 100%)',
          }} />
          <figcaption style={{ position: 'absolute', left: 'clamp(16px, 4vw, 40px)', bottom: 18, marginTop: 0 }}>
            Merdiveni bul, bir alt kata in — palet seninle beraber değişir
          </figcaption>
        </figure>
      </section>

      {/* ── Core mechanic ───────────────────────────────────── */}
      <section id="telegraf" ref={mechanic.ref} style={{ ...mechanic.style, maxWidth: 1240, margin: '0 auto', padding: 'clamp(56px, 10vh, 110px) clamp(16px, 4vw, 40px) 0' }}>
        <h6 className="text-muted">Çekirdek Mekanik</h6>
        <h2 className="balance" style={{ fontSize: 'clamp(28px, 4.4vw, 46px)', letterSpacing: '-0.025em', maxWidth: '18ch' }}>
          Zemin Sana Ne Olacağını Söyler
        </h2>

        <div className="dm-mech-grid" style={{ display: 'grid', gap: 'clamp(24px, 4vw, 52px)', marginTop: 28, alignItems: 'start' }}>
          <div style={{ minWidth: 0 }}>
            <p className="text-muted" style={{ maxWidth: '50ch', fontSize: 15, lineHeight: 1.65 }}>
              Her saldırı üç parçadır: hazırlık, vuruş, toparlanma. Hazırlık boyunca
              tehlike alanı zeminde dolar — daireyse çevresi, koniyse baktığı yön.
              Hasar karar anında değil, vuruş anında ve o anki konumuna göre hesaplanır.
              Alandan çıkarsan gerçekten kurtulursun.
            </p>

            {/*
              Each row plays the thing its label describes, on the same clock as
              the canvas beside it: the wind-up fills left to right and finishes
              exactly when the telegraph does, the hit is a flash that is gone
              before you finish reading it, and the recovery drains back. A row
              that merely changed colour said "this is happening now" but
              nothing about what it was.
            */}
            <div style={{ display: 'grid', gap: 8, marginTop: 24, maxWidth: 470 }}>
              {PHASE_ROWS.map(({ key, num, label, time, note }) => {
                const on = phase.phase === key;
                const anim =
                  key === 'windup' ? 'dmPhaseFill'
                  : key === 'active' ? 'dmPhaseSnap'
                  : 'dmPhaseDrain';
                return (
                  <div
                    key={key}
                    style={{
                      position: 'relative', overflow: 'hidden',
                      display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', gap: 12,
                      alignItems: 'baseline', padding: '11px 13px',
                      borderRadius: 'var(--radius-md)',
                      transition: 'box-shadow .35s cubic-bezier(.22,1,.36,1), opacity .35s cubic-bezier(.22,1,.36,1), transform .35s cubic-bezier(.22,1,.36,1)',
                      opacity: on ? 1 : 0.42,
                      transform: on ? 'translateX(4px)' : 'translateX(0)',
                      boxShadow: on
                        ? 'inset 0 0 0 1px color-mix(in srgb, var(--color-accent) 70%, transparent)'
                        : 'inset 0 0 0 1px var(--color-divider)',
                    }}
                  >
                    {/* The moving part. Keyed on the phase counter so restarting
                        the same phase next cycle replays the animation. */}
                    {on && (
                      <span
                        key={phase.seq}
                        aria-hidden
                        style={{
                          position: 'absolute', inset: 0, transformOrigin: 'left center',
                          background: key === 'active'
                            ? 'color-mix(in srgb, var(--color-neutral-100) 22%, transparent)'
                            : 'color-mix(in srgb, var(--color-accent) 16%, transparent)',
                          animation: `${anim} ${phase.durationMs}ms linear forwards`,
                        }}
                      />
                    )}
                    <span className="text-muted" style={{ position: 'relative', fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>{num}</span>
                    <span style={{
                      position: 'relative', fontFamily: 'var(--font-heading)', fontWeight: 500,
                      animation: on && key === 'active' ? `dmPhaseKick ${phase.durationMs}ms ease-out` : undefined,
                    }}>{label}</span>
                    <span style={{ position: 'relative', color: 'var(--color-accent)', fontSize: 13 }}>{time}</span>
                    <span className="text-muted" style={{ position: 'relative', fontSize: 12 }}>{note}</span>
                  </div>
                );
              })}
            </div>

            <p className="text-muted" style={{ fontSize: 12, marginTop: 18 }}>
              Hazırlık sırasında yeterli hasar alan düşman saldırısını iptal eder ve sersemler.
            </p>
          </div>

          {/* The scene runs the real windup → active → recovery cycle */}
          <figure style={{ minWidth: 0 }}>
            <div className="elev-sm" style={{
              borderRadius: 'var(--radius-lg)', overflow: 'hidden',
              background: 'var(--color-surface)', aspectRatio: '16 / 10',
            }}>
              <LiveScene
                scene="telegraph" floor={3} monster="dark_knight" cols={21} rows={13}
                onPhase={onPhase}
                timeScale={TELEGRAPH_SLOWDOWN}
              />
            </div>
            <figcaption>
              Oyunun kendi telegraf zamanlaması, okunabilsin diye {TELEGRAPH_SLOWDOWN} kat yavaşlatılmış.
              Üç fazın birbirine oranı gerçek.
            </figcaption>
          </figure>
        </div>
      </section>

      {/* ── Classes ─────────────────────────────────────────── */}
      <section id="siniflar" ref={classSec.ref} style={{ ...classSec.style, maxWidth: 1240, margin: '0 auto', padding: 'clamp(56px, 10vh, 110px) clamp(16px, 4vw, 40px) 0' }}>
        <h6 className="text-muted">Sınıflar</h6>
        <h2 className="balance" style={{ fontSize: 'clamp(28px, 4.4vw, 46px)', letterSpacing: '-0.025em', maxWidth: '20ch' }}>
          Dört Sınıf, Dört Ayrı İniş
        </h2>

        <div style={{ marginTop: 32, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', gap: 16 }}>
          {CLASSES.map(({ key, role, art, line }) => {
            const s = CLASS_STATS[key];
            return (
              <article key={key} className="card elev-sm" style={{ padding: 16, gap: 10 }}>
                {/* Drawn live at 48x64 rather than a 16px sprite upscaled to 190. */}
                <div style={{
                  display: 'grid', placeItems: 'center', padding: '6px 0 2px',
                  // A pool of the class colour under the figure, so each card
                  // carries its own light rather than four identical grey boxes.
                  background: `radial-gradient(ellipse 60% 52% at 50% 62%, ${s.color}22, transparent 70%)`,
                  borderRadius: 'var(--radius-md)',
                }}>
                  <ClassPortrait cls={key} height={168} />
                </div>
                <span className="card-kicker">{role}</span>
                <span className="card-title" style={{ color: s.color }}>{s.label}</span>
                <p className="card-body">{line}</p>
                <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, margin: 0, marginTop: 4 }}>
                  {([['Can', s.maxHp], ['Mana', s.maxMana], ['Saldırı', s.attack], ['Savunma', s.defense], ['Hız', s.speed], ['Menzil', s.attackRange]] as const).map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-muted" style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{k}</dt>
                      <dd style={{ margin: 0, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>{v}</dd>
                    </div>
                  ))}
                </dl>
              </article>
            );
          })}
        </div>
      </section>

      {/* ── Run rhythm — the two beats the telegraph section doesn't cover ── */}
      <section ref={rhythm.ref} style={{ ...rhythm.style, maxWidth: 1240, margin: '0 auto', padding: 'clamp(56px, 10vh, 110px) clamp(16px, 4vw, 40px) 0' }}>
        <h6 className="text-muted">Zindanın Ritmi</h6>
        <h2 className="balance" style={{ fontSize: 'clamp(28px, 4.4vw, 46px)', letterSpacing: '-0.025em', maxWidth: '20ch' }}>
          Vur, Kaç, Topla, Bir Kat Daha İn
        </h2>
        <p className="text-muted" style={{ maxWidth: '54ch', marginTop: 12, fontSize: 15, lineHeight: 1.65 }}>
          Bir run on beş dakika sürer. Aynı üç şeyi yaparsın, her katta biraz daha zoruna gelir.
        </p>

        <div className="dm-rhythm-grid" style={{ display: 'grid', gap: 'clamp(18px, 3vw, 32px)', marginTop: 30 }}>
          {([
            {
              scene: 'volley' as const, floor: 6, cols: 18, rows: 10,
              kicker: 'Menzil',
              title: 'Altıncı Kattan Sonra Düşman da Ateş Eder',
              body: 'Gargoyle taş fırlatır, fantom ruh oku atar. Siperin arkasına geç, aralarındaki boşlukta ilerle — durduğun yerde kalmak artık bir seçenek değil.',
            },
            {
              scene: 'treasure' as const, floor: 4, cols: 18, rows: 10,
              kicker: 'Ganimet',
              title: 'Sandıklar Seyrek, İçindekiler Run’ı Belirler',
              body: 'İksir, altın, geçici güçlenme. Kat başına bir avuç sandık var; hangisine gideceğin, ne kadar canla ineceğini belirler.',
            },
          ]).map((c) => (
            <article key={c.scene} className="card elev-sm" style={{ padding: 0, overflow: 'hidden', gap: 0 }}>
              <div style={{ aspectRatio: '18 / 10', flexShrink: 0, width: '100%' }}>
                <LiveScene scene={c.scene} floor={c.floor} cols={c.cols} rows={c.rows} showLabel={false} />
              </div>
              <div style={{ padding: 16, display: 'grid', gap: 8 }}>
                <span className="card-kicker">{c.kicker}</span>
                <span className="card-title">{c.title}</span>
                <p className="card-body">{c.body}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ── Play ────────────────────────────────────────────── */}
      <section id="oyna" style={{ maxWidth: 1240, margin: '0 auto', padding: 'clamp(56px, 10vh, 110px) clamp(16px, 4vw, 40px) 0' }}>
        <h6 className="text-muted">Başla</h6>
        <h2 className="balance" style={{ fontSize: 'clamp(28px, 4.4vw, 46px)', letterSpacing: '-0.025em', maxWidth: '18ch' }}>
          Kurulum Yok, İsim Yeter
        </h2>
        <p className="text-muted" style={{ maxWidth: '52ch', marginTop: 12 }}>
          Sekmeyi aç, adını yaz, in. Oda kurarsan bağlantıyı paylaşman yeter — arkadaşların aynı zindanda belirir.
        </p>

        <div className="dm-play-grid" style={{ display: 'grid', gap: 'clamp(20px, 4vw, 44px)', marginTop: 28, alignItems: 'start' }}>
          <div style={{ maxWidth: 420 }}>
            {mode === 'idle' ? (
              <>
                <button className="btn btn-primary btn-block" style={{ padding: '12px 16px' }}
                        onClick={() => router.push('/game?mode=solo&name=Kahraman')}>
                  Tek Oyna — 3 Can
                </button>
                <button className="btn btn-secondary btn-block" style={{ padding: '12px 16px' }}
                        onClick={() => setMode('multiplayer')}>
                  Arkadaşlarınla Oyna
                </button>
                <p className="text-muted" style={{ fontSize: 12, marginTop: 14 }}>
                  Chrome, Safari, Edge · masaüstü ve tablet
                </p>
              </>
            ) : (
              <>
                <div className="field">
                  <label htmlFor="dm-name">İsmin</label>
                  <input id="dm-name" className="input" value={name} maxLength={12}
                         onChange={(e) => setName(e.target.value.slice(0, 12))} placeholder="Kahraman" />
                </div>
                <button className="btn btn-primary btn-block" onClick={createRoom}>Oda Kur</button>

                <div className="field" style={{ marginTop: 16 }}>
                  <label htmlFor="dm-code">Oda kodu</label>
                  <input id="dm-code" className="input" value={code} maxLength={4}
                         onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 4))}
                         placeholder="ABCD" style={{ letterSpacing: '0.25em', textTransform: 'uppercase' }} />
                </div>
                <button className="btn btn-secondary btn-block" onClick={joinRoom}>Katıl</button>

                {error && <p role="alert" style={{ color: 'var(--color-accent-300)', fontSize: 13, marginTop: 12 }}>{error}</p>}

                <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={() => { setMode('idle'); setError(''); }}>
                  ← Geri
                </button>
              </>
            )}
          </div>

          <div style={{ minWidth: 0 }}>
            <h6 className="text-muted">Kontroller</h6>
            <table className="table">
              <tbody>
                {CONTROLS.map(([k, v]) => (
                  <tr key={k}>
                    <td style={{ fontFamily: 'var(--font-heading)', fontWeight: 500, width: '45%' }}>{k}</td>
                    <td className="text-muted">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer style={{ maxWidth: 1240, margin: '0 auto', padding: 'clamp(56px, 9vh, 96px) clamp(16px, 4vw, 40px) 44px' }}>
        <hr className="hr" />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>Dungeon Mates</span>
          <span className="text-muted" style={{ fontSize: 12 }}>
            Tüm sprite&apos;lar Canvas ile prosedürel çizilir — sprite sheet yok.
          </span>
        </div>
      </footer>

      <MetaProgression open={metaOpen} onClose={() => setMetaOpen(false)} />

      {/* Layout breakpoints. Nocturne is left-aligned and asymmetric: the hero
          gives the copy the larger share and lets the art sit right. */}
      <style>{`
        .dm-hero-grid { grid-template-columns: 1fr; }
        .dm-mech-grid, .dm-play-grid, .dm-rhythm-grid, .dm-story-grid { grid-template-columns: 1fr; }
        .dm-navlinks { display: none; align-items: center; gap: 22px; }
        .dm-floor-card { transition: transform .3s cubic-bezier(.22,1,.36,1), box-shadow .3s cubic-bezier(.22,1,.36,1); }
        .dm-floor-card:hover {
          transform: translateY(-3px);
          box-shadow: inset 0 0 0 1px var(--floor-accent), 0 10px 28px rgba(0,0,0,.45);
        }
        @media (prefers-reduced-motion: reduce) { .dm-floor-card:hover { transform: none; } }
        @media (min-width: 900px) {
          .dm-hero-grid { grid-template-columns: 1.08fr 0.92fr; }
          .dm-mech-grid { grid-template-columns: 1.15fr 0.85fr; }
          .dm-play-grid { grid-template-columns: 0.9fr 1.1fr; }
          .dm-rhythm-grid { grid-template-columns: 1fr 1fr; }
          .dm-story-grid { grid-template-columns: 1.2fr 0.8fr; }
          .dm-navlinks { display: flex; }
        }
      `}</style>
    </div>
  );
}

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
 * would misrepresent a pixel-art game, so every image under /public/art is a real
 * capture of this build: the scenes come from the live game canvas and the class
 * portraits are the game's own PixelHero sprites. They are dark-grounded, which is
 * exactly what the system's `.lighten` wrapper wants.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { CLASS_STATS, type PlayerClass, floorTheme } from '../../shared/types';
import { MetaProgression } from '@/components/game/MetaProgression';
import { loadMeta, type MetaState } from '@/lib/meta-progression';
import '../styles/nocturne.css';

type Mode = 'idle' | 'multiplayer';

const ACTS = [
  { n: 'Perde I', name: 'Yüzey', floors: [1, 2, 3, 4] },
  { n: 'Perde II', name: 'Derinlikler', floors: [5, 6, 7] },
  { n: 'Perde III', name: 'Karanlığın Kalbi', floors: [8, 9, 10] },
] as const;

const FLOOR_NOTE: Record<number, string> = {
  1: 'Sıçan, balçık, yarasa. Hazırlıksız saldırırlar — telegraf yok.',
  2: 'İskelet ve örümcek. İlk koni telegrafları burada görülür.',
  3: 'Ocak Muhafızı. Yer sarsıntısı önce zeminde belirir.',
  4: 'Goblin ve mantar. Ağır saldırılar: uzun hazırlık, uzun toparlanma.',
  5: 'İkinci fazda alanı köklendirir. Ağlar hızını yer.',
  6: 'İlk menzilli düşmanlar. Gargoyle taş fırlatır.',
  7: 'Taş Muhafız. Taşlaştırma bakışı koni hâlinde gelir.',
  8: 'Alev Şövalyesi. Hücum çizgisi zeminde görünür.',
  9: 'Fantomlar duvarlardan geçer. Açık alanda durma.',
  10: "Kral Mor'Khan. Üç faz; her fazda daha hızlı.",
};

const BOSS_FLOORS: Record<number, string> = { 3: 'BOSS', 5: 'BOSS', 7: 'BOSS', 8: 'BOSS', 10: 'FİNAL' };

const CLASSES: ReadonlyArray<{
  key: PlayerClass; role: string; art: string; line: string;
}> = [
  { key: 'warrior', role: 'Ön Saf', art: '/art/class-savasci.png', line: 'Kalkan duvarı hasarı yutar. Ağır düşmanı hazırlık anında sersemletir.' },
  { key: 'mage', role: 'Alan Hasarı', art: '/art/class-buyucu.png', line: 'Buz fırtınası yavaşlatır. Yanan hedefe buz vurulursa dondurur.' },
  { key: 'archer', role: 'Menzil', art: '/art/class-okcu.png', line: 'En hızlı sınıf. Kritik yığar; ok yağmuru koridoru kapatır.' },
  { key: 'healer', role: 'Destek', art: '/art/class-sifaci.png', line: 'Takımı ayakta tutar. Ultimate ekibe üç saniye dokunulmazlık verir.' },
];

const STATS: ReadonlyArray<readonly [string, string]> = [
  ['Kat', '10'], ['Sınıf', '4'], ['Canavar', '17'], ['Oyuncu', '1–4'], ['Kurulum', 'Yok'],
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
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, letterSpacing: '-0.01em' }}>Dungeon Mates</span>
        </a>

        <div className="dm-navlinks" style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <button className="btn btn-ghost" onClick={() => go('katalog')}>Katalog</button>
          <button className="btn btn-ghost" onClick={() => go('telegraf')}>Telegraf</button>
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

            <h1 style={{
              fontSize: 'clamp(38px, 7.2vw, 82px)', lineHeight: 1.03, marginTop: 18,
              letterSpacing: '-0.03em', fontWeight: 600,
            }}>
              On Kat Aşağı.<br />
              <span style={{ color: 'var(--color-accent)' }}>Tek Çıkış En Dipte.</span>
            </h1>

            <p className="text-muted" style={{ maxWidth: '52ch', fontSize: 16, marginTop: 22, lineHeight: 1.6 }}>
              Tarayıcıda açılan co-op zindan. Düşmanlar vuracakları yeri önce zeminde
              gösterir — okuyabilirsen kaçabilirsin. Dört sınıf, on kat, bir yozlaşmış kral.
            </p>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 28 }}>
              <button className="btn btn-primary" style={{ padding: '10px 18px' }}
                      onClick={() => router.push('/game?mode=solo&name=Kahraman')}>
                Tek Başına İn
              </button>
              <button className="btn btn-secondary" style={{ padding: '10px 18px' }} onClick={() => go('oyna')}>
                Oda Kur — 4 Kişiye Kadar
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
              boxShadow: 'var(--shadow-md)',
            }}>
              <Image
                src="/art/hero-scene.png" alt="Dungeon Mates oyun içi görüntü — kat 1"
                width={1200} height={900} priority
                style={{ width: '100%', height: 'auto', imageRendering: 'pixelated' }}
              />
              {/* Accent sweep — a line of light, never a flood */}
              <span aria-hidden style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                background: 'linear-gradient(100deg, transparent 40%, color-mix(in srgb, var(--color-accent) 22%, transparent) 50%, transparent 60%)',
                animation: 'dmSweep 6.5s ease-in-out infinite',
              }} />
            </div>
            <figcaption>Kat 07 · Taş Bahçeler — oyunun kendi render&apos;ı</figcaption>
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
      <section style={{ marginTop: 'clamp(44px, 8vh, 92px)', background: 'var(--color-section)', position: 'relative', overflow: 'hidden' }}>
        <span aria-hidden style={{
          position: 'absolute', inset: '-40% 30% auto -10%', height: '180%',
          background: 'radial-gradient(closest-side, var(--color-section-glow), transparent)', opacity: .8,
        }} />
        <div style={{
          position: 'relative', maxWidth: 1240, margin: '0 auto',
          padding: 'clamp(22px, 4vw, 38px) clamp(16px, 4vw, 40px)',
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(120px, 100%), 1fr))', gap: 18,
        }}>
          {STATS.map(([k, v]) => (
            <div key={k}>
              <div style={{ fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1 }}>{v}</div>
              <div style={{ fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', opacity: .72, marginTop: 8 }}>{k}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Catalogue ───────────────────────────────────────── */}
      <section id="katalog" ref={catalogue.ref} style={{ ...catalogue.style, maxWidth: 1240, margin: '0 auto', padding: 'clamp(56px, 10vh, 110px) clamp(16px, 4vw, 40px) 0' }}>
        <h6 className="text-muted">Katalog</h6>
        <h2 style={{ fontSize: 'clamp(28px, 4.4vw, 46px)', letterSpacing: '-0.025em', maxWidth: '16ch' }}>On Kat, On Palet.</h2>

        <div style={{ marginTop: 34, display: 'grid', gap: 30 }}>
          {ACTS.map((act) => (
            <div key={act.n}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
                <span style={{ color: 'var(--color-accent)', fontSize: 12, letterSpacing: '0.16em', textTransform: 'uppercase' }}>{act.n}</span>
                <span className="text-muted" style={{ fontSize: 13 }}>{act.name}</span>
                <span aria-hidden style={{ flex: 1, height: 1, background: 'linear-gradient(to right, var(--color-divider), transparent)' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px, 100%), 1fr))', gap: 14 }}>
                {act.floors.map((f) => {
                  const t = floorTheme(f);
                  return (
                    <article key={f} className="card elev-sm" style={{ padding: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                        <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 20, color: 'var(--color-accent)' }}>
                          {String(f).padStart(2, '0')}
                        </span>
                        <span className="card-title" style={{ flex: 1 }}>{t.name}</span>
                        {BOSS_FLOORS[f] && <span className="tag tag-outline">{BOSS_FLOORS[f]}</span>}
                      </div>
                      <p className="card-body">{FLOOR_NOTE[f]}</p>
                      {/* The floor's real stone ramp, straight from shared/palette.ts */}
                      <div aria-hidden style={{ display: 'flex', borderRadius: 3, overflow: 'hidden', marginTop: 2 }}>
                        {[...t.wall, t.growth, t.accent].map((c, i) => (
                          <span key={i} style={{ background: c, height: 8, flex: 1 }} />
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
          <Image
            src="/art/wide-scene.png" alt="Zindanın geniş görünümü — kat 3, Derin Tüneller"
            width={1680} height={720}
            style={{
              width: '100%', height: 'clamp(220px, 34vw, 460px)',
              objectFit: 'cover', objectPosition: '18% 50%', imageRendering: 'pixelated',
            }}
          />
          <span aria-hidden style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to bottom, var(--color-bg) 0%, transparent 22%, transparent 72%, var(--color-bg) 100%)',
          }} />
          <figcaption style={{ position: 'absolute', left: 'clamp(16px, 4vw, 40px)', bottom: 18, marginTop: 0 }}>
            Perde III — Karanlığın Kalbi
          </figcaption>
        </figure>
      </section>

      {/* ── Core mechanic ───────────────────────────────────── */}
      <section id="telegraf" ref={mechanic.ref} style={{ ...mechanic.style, maxWidth: 1240, margin: '0 auto', padding: 'clamp(56px, 10vh, 110px) clamp(16px, 4vw, 40px) 0' }}>
        <h6 className="text-muted">Çekirdek Mekanik</h6>
        <h2 style={{ fontSize: 'clamp(28px, 4.4vw, 46px)', letterSpacing: '-0.025em', maxWidth: '18ch' }}>
          Zemin Sana Ne Olacağını Söyler.
        </h2>

        <div className="dm-mech-grid" style={{ display: 'grid', gap: 'clamp(24px, 4vw, 52px)', marginTop: 28, alignItems: 'start' }}>
          <div style={{ minWidth: 0 }}>
            <p className="text-muted" style={{ maxWidth: '50ch', fontSize: 15, lineHeight: 1.65 }}>
              Her saldırı üç parçadır: hazırlık, vuruş, toparlanma. Hazırlık boyunca
              tehlike alanı zeminde dolar — daireyse çevresi, koniyse baktığı yön.
              Hasar karar anında değil, vuruş anında ve o anki konumuna göre hesaplanır.
              Alandan çıkarsan gerçekten kurtulursun.
            </p>

            <div style={{ display: 'grid', gap: 10, marginTop: 24, maxWidth: 460 }}>
              {[
                ['Hazırlık', '0.25 – 0.65 sn', 'alan dolar'],
                ['Vuruş', '0.1 – 0.2 sn', 'hasar çözülür'],
                ['Toparlanma', '0.2 – 0.7 sn', 'karşılık ver'],
              ].map(([phase, time, note]) => (
                <div key={phase} style={{
                  display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, alignItems: 'baseline',
                  padding: '10px 0',
                  background: 'linear-gradient(to right, var(--color-divider), var(--color-divider) calc(100% - 48px), transparent) no-repeat bottom / 100% 1px',
                }}>
                  <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 500 }}>{phase}</span>
                  <span style={{ color: 'var(--color-accent)', fontSize: 13 }}>{time}</span>
                  <span className="text-muted" style={{ fontSize: 12 }}>{note}</span>
                </div>
              ))}
            </div>

            <p className="text-muted" style={{ fontSize: 12, marginTop: 18 }}>
              Hazırlık sırasında yeterli hasar alan düşman saldırısını iptal eder ve sersemler.
            </p>
          </div>

          {/* Telegraph diagram — drawn with the accent as a line, per the system */}
          <figure style={{ minWidth: 0 }}>
            <div className="elev-sm" style={{
              borderRadius: 'var(--radius-lg)', padding: 22, background: 'var(--color-surface)',
              display: 'grid', placeItems: 'center',
            }}>
              <svg viewBox="0 0 220 150" width="100%" height="auto" role="img" aria-label="Telegraf şekilleri: daire ve koni">
                {/* circle telegraph */}
                <circle cx="62" cy="76" r="42" fill="color-mix(in srgb, var(--color-accent) 12%, transparent)" />
                <circle cx="62" cy="76" r="42" fill="none" stroke="var(--color-accent)" strokeWidth="1.5" />
                <circle cx="62" cy="76" r="27" fill="color-mix(in srgb, var(--color-accent) 22%, transparent)" />
                <rect x="57" y="71" width="10" height="10" fill="var(--color-accent-200)" />
                <text x="62" y="136" textAnchor="middle" fill="currentColor" opacity="0.55" fontSize="10" fontFamily="var(--font-body)">Daire</text>

                {/* cone telegraph */}
                <path d="M162 76 L206 44 A54 54 0 0 1 206 108 Z" fill="color-mix(in srgb, var(--color-accent) 14%, transparent)" stroke="var(--color-accent)" strokeWidth="1.5" />
                <rect x="157" y="71" width="10" height="10" fill="var(--color-accent-200)" />
                <text x="176" y="136" textAnchor="middle" fill="currentColor" opacity="0.55" fontSize="10" fontFamily="var(--font-body)">Koni</text>
              </svg>
            </div>
            <figcaption>Server telegrafı yayınlar; hasar aynı şekle karşı çözülür.</figcaption>
          </figure>
        </div>
      </section>

      {/* ── Classes ─────────────────────────────────────────── */}
      <section id="siniflar" ref={classSec.ref} style={{ ...classSec.style, maxWidth: 1240, margin: '0 auto', padding: 'clamp(56px, 10vh, 110px) clamp(16px, 4vw, 40px) 0' }}>
        <h6 className="text-muted">Sınıflar</h6>
        <h2 style={{ fontSize: 'clamp(28px, 4.4vw, 46px)', letterSpacing: '-0.025em', maxWidth: '22ch' }}>
          Dördü De Aynı Zindana İner. Aynı Şekilde Değil.
        </h2>

        <div style={{ marginTop: 32, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', gap: 16 }}>
          {CLASSES.map(({ key, role, art, line }) => {
            const s = CLASS_STATS[key];
            return (
              <article key={key} className="card elev-sm" style={{ padding: 16, gap: 10 }}>
                {/* .lighten drops the sprite's dark ground into the page */}
                <div className="lighten" style={{ display: 'grid', placeItems: 'center' }}>
                  <Image src={art} alt={`${s.label} karakteri`} width={520} height={520}
                         style={{ width: '100%', maxWidth: 190, height: 'auto', imageRendering: 'pixelated' }} />
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

      {/* ── Play ────────────────────────────────────────────── */}
      <section id="oyna" style={{ maxWidth: 1240, margin: '0 auto', padding: 'clamp(56px, 10vh, 110px) clamp(16px, 4vw, 40px) 0' }}>
        <h6 className="text-muted">Başla</h6>
        <h2 style={{ fontSize: 'clamp(28px, 4.4vw, 46px)', letterSpacing: '-0.025em', maxWidth: '18ch' }}>Kurulum Yok. İsim Yeter.</h2>
        <p className="text-muted" style={{ maxWidth: '52ch', marginTop: 12 }}>
          Sekmeyi aç, adını yaz, in. Oda kurarsan bağlantıyı paylaşman yeter — arkadaşların aynı zindanda belirir.
        </p>

        <div className="dm-play-grid" style={{ display: 'grid', gap: 'clamp(20px, 4vw, 44px)', marginTop: 28, alignItems: 'start' }}>
          <div style={{ maxWidth: 420 }}>
            {mode === 'idle' ? (
              <>
                <button className="btn btn-primary btn-block" style={{ padding: '12px 16px' }}
                        onClick={() => router.push('/game?mode=solo&name=Kahraman')}>
                  Tek Başına İn — 3 Can
                </button>
                <button className="btn btn-secondary btn-block" style={{ padding: '12px 16px' }}
                        onClick={() => setMode('multiplayer')}>
                  Arkadaşlarınla İn
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
        .dm-mech-grid, .dm-play-grid { grid-template-columns: 1fr; }
        .dm-navlinks { display: none; }
        @media (min-width: 900px) {
          .dm-hero-grid { grid-template-columns: 1.08fr 0.92fr; }
          .dm-mech-grid { grid-template-columns: 1.15fr 0.85fr; }
          .dm-play-grid { grid-template-columns: 0.9fr 1.1fr; }
          .dm-navlinks { display: flex; }
        }
      `}</style>
    </div>
  );
}

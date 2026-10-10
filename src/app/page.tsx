'use client';

/*
 * Landing page — "The Descent".
 *
 * The page is built as one continuous drop into Zephara, and every set piece is
 * driven by the reader's own scroll:
 *
 *   gate        a torch catches in the dark, a pixel portcullis lifts and the
 *               camera walks through the arch into the page (once a session)
 *   hero        a pinned stage where a small window onto the live game opens
 *               until it fills the screen and swallows the headline
 *   marquee     floor names that speed up and lean with scroll velocity
 *   story       the prologue lights up word by word as it is read
 *   floors      a vertical shaft: floors stack the way they are played, a
 *               sticky gauge on the left reads out the depth
 *   mechanic    the real windup → active → recovery cycle, read out live
 *   classes     four slabs that open under the pointer
 *   play        a single giant call to go down, with magnetic controls
 *
 * Built on the Nocturne tokens (src/styles/nocturne.css) with the landing's own
 * layer on top (src/styles/landing.css). All imagery is the game's own renderer
 * running live — no screenshots, no stock.
 *
 * Route changes go through the pixel shutter (components/fx/PageTransition), so
 * pressing "Oyna" is the first frame of the descent rather than a hard cut.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AnimatePresence, MotionConfig, motion, useMotionValueEvent, useScroll, useSpring, useTransform,
} from 'framer-motion';
import { floorTheme, PROLOGUE, CALLING } from '../../shared/types';
import { LiveScene, type ScenePhase, type PhaseEvent } from '@/components/landing/LiveScene';
import { MetaProgression } from '@/components/game/MetaProgression';
import { loadMeta, type MetaState } from '@/lib/meta-progression';
import { useTransitionRouter } from '@/components/fx/PageTransition';
import { EASE_OUT_EXPO, EASE_IN_OUT } from '@/lib/motion';
import { SmoothScroll, scrollToTarget, setScrollLocked } from '@/components/landing/motion/SmoothScroll';
import { DungeonGate } from '@/components/landing/motion/DungeonGate';
import { RevealText } from '@/components/landing/motion/RevealText';
import { Magnetic } from '@/components/landing/motion/Magnetic';
import { VelocityMarquee } from '@/components/landing/motion/VelocityMarquee';
import { ScrollWords } from '@/components/landing/motion/ScrollWords';
import { HeroStage } from '@/components/landing/motion/HeroStage';
import { FloorShaft } from '@/components/landing/motion/FloorShaft';
import { ClassAccordion } from '@/components/landing/motion/ClassAccordion';
import { TiltCard } from '@/components/landing/motion/TiltCard';
import '../styles/nocturne.css';
import '../styles/landing.css';

type Mode = 'idle' | 'multiplayer';

const STATS: ReadonlyArray<{ label: string; to?: number; text?: string }> = [
  { label: 'Kat', to: 10 },
  { label: 'Sınıf', to: 4 },
  { label: 'Canavar', to: 17 },
  { label: 'Oyuncu', text: '1–4' },
  { label: 'Kurulum', text: 'Yok' },
];

/**
 * How far the telegraph demonstration is slowed for the page. The real active
 * frame is 200ms — too quick to read — so only the clock is stretched; the
 * phases keep their true proportions.
 */
const TELEGRAPH_SLOWDOWN = 4;

const PHASE_ROWS: ReadonlyArray<{ key: ScenePhase; num: string; label: string; time: string; note: string }> = [
  { key: 'windup', num: '01', label: 'Hazırlık', time: '0,25 – 0,65 sn', note: 'Tehlike alanı zeminde dolar' },
  { key: 'active', num: '02', label: 'Vuruş', time: '0,1 – 0,2 sn', note: 'Hasar o an hesaplanır' },
  { key: 'recovery', num: '03', label: 'Toparlanma', time: '0,2 – 0,7 sn', note: 'Saldırma sırası sende' },
];

const CONTROLS: ReadonlyArray<readonly [string, string]> = [
  ['W A S D', 'Hareket'], ['Fare', 'Nişan'], ['Sol Tık', 'Saldırı'],
  ['Q', 'Takla'], ['E', 'Yetenek'], ['F', 'Ultimate'], ['R', 'Etkileşim'],
];

const NAV: ReadonlyArray<readonly [string, string]> = [
  ['hikaye', 'Hikâye'], ['katalog', 'Katlar'], ['telegraf', 'Dövüş'], ['siniflar', 'Sınıflar'], ['oyna', 'Oyna'],
];

const GAME_LABEL = 'Zindana iniliyor';
const EMBER = '#ff8a3d';

/** Counts from 0 to `to` once `run` flips true. Respects reduced motion. */
function useCountUp(to: number, run: boolean, ms = 1400): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!run) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setN(to); return; }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      setN(Math.round(to * (1 - Math.pow(1 - t, 4))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, run, ms]);
  return n;
}

function StatCell({ stat, run, index }: { stat: (typeof STATS)[number]; run: boolean; index: number }) {
  const counted = useCountUp(stat.to ?? 0, run);
  return (
    <motion.div
      className="dm-stat"
      initial={{ opacity: 0, y: 40 }}
      animate={run ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 1, ease: EASE_OUT_EXPO, delay: index * 0.08 }}
    >
      <span className="dm-stat-value">{stat.text ?? String(counted).padStart(2, '0')}</span>
      <span className="dm-stat-label">{stat.label}</span>
    </motion.div>
  );
}

/** Section header: a masked headline. */
function SectionHead({ title, maxCh }: { title: string; maxCh?: number }) {
  return (
    <header className="dm-section-head">
      <RevealText as="h2" className="dm-display" text={title} style={{ maxWidth: maxCh ? `${maxCh}ch` : undefined }} />
    </header>
  );
}

export default function HomePage() {
  const { navigate } = useTransitionRouter();
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<Mode>('idle');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [metaOpen, setMetaOpen] = useState(false);
  const [meta, setMeta] = useState<MetaState | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [navHidden, setNavHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [statsRun, setStatsRun] = useState(false);
  const statsRef = useRef<HTMLElement>(null);

  // Live phase readout from the telegraph scene. `seq` remounts the fill so the
  // CSS animation restarts even when the same phase comes round again.
  const [phase, setPhase] = useState<{ phase: ScenePhase; durationMs: number; seq: number }>(
    { phase: 'idle', durationMs: 0, seq: 0 },
  );
  const onPhase = useCallback((e: PhaseEvent) => {
    setPhase((prev) => ({ phase: e.phase, durationMs: e.durationMs, seq: prev.seq + 1 }));
  }, []);

  const onReady = useCallback(() => setReady(true), []);

  useEffect(() => { setMeta(loadMeta()); }, [metaOpen]);
  // Lock only while the menu is open, and release on unmount — an unconditional
  // setScrollLocked(menuOpen) would undo the preloader's lock on mount (parent
  // effects run after children) and leave <html> overflow:hidden if the page is
  // left with the menu open.
  useEffect(() => {
    if (!menuOpen) return;
    setScrollLocked(true);
    return () => setScrollLocked(false);
  }, [menuOpen]);

  // Page-wide scroll: progress rail, depth readout, and a nav that steps aside
  // on the way down and comes back the moment the reader scrolls up.
  const { scrollY, scrollYProgress } = useScroll();
  const rail = useSpring(scrollYProgress, { stiffness: 200, damping: 40 });
  useMotionValueEvent(scrollY, 'change', (y) => {
    const prev = scrollY.getPrevious() ?? 0;
    setScrolled(y > 24);
    setNavHidden((h) => (y > 240 && y > prev + 2 ? true : y < prev - 2 ? false : h));
  });
  // Written straight into the DOM by Framer: a state here re-rendered the
  // whole page on every scroll tick.
  const depth = useTransform(scrollYProgress, (v) => `−${String(Math.round(v * 240)).padStart(3, '0')}m`);

  useEffect(() => {
    const el = statsRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setStatsRun(true); io.disconnect(); } }, { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const go = useCallback((id: string) => { setMenuOpen(false); scrollToTarget(id); }, []);

  const playSolo = useCallback(() => {
    navigate('/game?mode=solo&name=Kahraman', { label: GAME_LABEL, edge: EMBER });
  }, [navigate]);

  const createRoom = useCallback(() => {
    if (!name.trim()) { setError('Önce bir isim gir.'); return; }
    setError('');
    navigate(`/game?room=new&name=${encodeURIComponent(name.trim())}`, { label: 'Oda kuruluyor', edge: EMBER });
  }, [name, navigate]);

  const joinRoom = useCallback(() => {
    if (!name.trim()) { setError('Önce bir isim gir.'); return; }
    if (code.trim().length !== 4) { setError('Oda kodu 4 haneli.'); return; }
    setError('');
    navigate(`/game?room=${code.trim().toUpperCase()}&name=${encodeURIComponent(name.trim())}`, { label: 'Odaya katılınıyor', edge: EMBER });
  }, [name, code, navigate]);

  const floorNames = useMemo(() => Array.from({ length: 10 }, (_, i) => floorTheme(i + 1)), []);

  // Full-bleed descend scene: zooms out and un-clips as it crosses the screen.
  const descendRef = useRef<HTMLElement>(null);
  const { scrollYProgress: dp } = useScroll({ target: descendRef, offset: ['start end', 'end start'] });
  const dScale = useTransform(dp, [0, 0.55], [1.3, 1]);
  // Transform only: this was an animated clip-path inset, repainted every frame
  // on top of a live canvas.
  const dFrame = useTransform(dp, [0, 0.45], [0.86, 1]);
  const dTextX = useTransform(dp, [0, 1], ['18%', '-28%']);

  // Footer wordmark rises as the page bottoms out.
  const footRef = useRef<HTMLElement>(null);
  const { scrollYProgress: fp } = useScroll({ target: footRef, offset: ['start end', 'end end'] });
  const footY = useTransform(fp, [0, 1], ['55%', '0%']);

  return (
    <MotionConfig reducedMotion="user">
    <div className="nocturne dm-landing">
      <DungeonGate onDone={onReady} />
      <SmoothScroll />
      <div aria-hidden className="dm-grain" />

      {/* Scroll rail — the whole page as one shaft */}
      <motion.div aria-hidden className="dm-rail" style={{ scaleX: rail }} />

      {/* ── Nav ─────────────────────────────────────────────── */}
      <motion.nav
        className="dm-nav"
        data-scrolled={scrolled ? 'true' : undefined}
        animate={{ y: navHidden && !menuOpen ? '-110%' : '0%' }}
        transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
      >
        <a
          href="#top"
          className="dm-logo"
          onClick={(e) => { e.preventDefault(); setMenuOpen(false); scrollToTarget(0); }}
         
        >
          <span aria-hidden className="dm-logo-mark" />
          <span>Dungeon Mates</span>
        </a>

        <div className="dm-navlinks">
          {NAV.slice(0, 4).map(([id, label]) => (
            <button key={id} className="dm-navlink" onClick={() => go(id)}>
              <span data-text={label}>{label}</span>
            </button>
          ))}
          <button className="dm-navlink" onClick={() => setMetaOpen(true)}>
            <span data-text={`Kalıntılar${meta && meta.shards > 0 ? ` ${meta.shards}` : ''}`}>
              Kalıntılar{meta && meta.shards > 0 ? ` ${meta.shards}` : ''}
            </span>
          </button>
        </div>

        <motion.span className="dm-nav-depth" aria-hidden>{depth}</motion.span>

        <Magnetic strength={0.25}>
          <button className="dm-btn dm-btn--solid dm-btn--sm" onClick={playSolo}>
            <span className="dm-btn-label" data-text="Oyna">Oyna</span>
          </button>
        </Magnetic>

        <button
          className="dm-burger"
          aria-label={menuOpen ? 'Menüyü kapat' : 'Menüyü aç'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
          data-open={menuOpen ? 'true' : undefined}
        >
          <span /><span />
        </button>
      </motion.nav>

      {/* ── Mobile / overlay menu ───────────────────────────── */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            className="dm-menu"
            initial={{ clipPath: 'circle(0% at 100% 0%)' }}
            animate={{ clipPath: 'circle(150% at 100% 0%)' }}
            exit={{ clipPath: 'circle(0% at 100% 0%)' }}
            transition={{ duration: 0.8, ease: EASE_IN_OUT }}
          >
            <nav>
              {NAV.map(([id, label], i) => (
                <div key={id} style={{ overflow: 'hidden' }}>
                  <motion.button
                    onClick={() => go(id)}
                    initial={{ y: '110%' }}
                    animate={{ y: '0%' }}
                    exit={{ y: '110%' }}
                    transition={{ duration: 0.7, ease: EASE_OUT_EXPO, delay: 0.18 + i * 0.06 }}
                  >
                    <span className="dm-menu-num">0{i + 1}</span>{label}
                  </motion.button>
                </div>
              ))}
              <div style={{ overflow: 'hidden' }}>
                <motion.button
                  onClick={() => { setMenuOpen(false); setMetaOpen(true); }}
                  initial={{ y: '110%' }}
                  animate={{ y: '0%' }}
                  exit={{ y: '110%' }}
                  transition={{ duration: 0.7, ease: EASE_OUT_EXPO, delay: 0.18 + NAV.length * 0.06 }}
                >
                  <span className="dm-menu-num">0{NAV.length + 1}</span>Kalıntılar
                </motion.button>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      <main>
        {/* ── Hero ──────────────────────────────────────────── */}
        <HeroStage
          ready={ready}
          actions={(
            <>
              <Magnetic>
                <button className="dm-btn dm-btn--solid" onClick={playSolo}>
                  <span className="dm-btn-label" data-text="Tek Oyna">Tek Oyna</span>
                  <span aria-hidden className="dm-btn-arrow">↓</span>
                </button>
              </Magnetic>
              <Magnetic>
                <button className="dm-btn dm-btn--ghost" onClick={() => go('oyna')}>
                  <span className="dm-btn-label" data-text="Arkadaşlarınla">Arkadaşlarınla</span>
                </button>
              </Magnetic>
            </>
          )}
        />

        {/* ── Velocity marquee ─────────────────────────────── */}
        <section className="dm-marquee" aria-label="Kat isimleri">
          <VelocityMarquee>
            {floorNames.map((t, i) => (
              <span key={t.name} className="dm-marquee-item">
                <span className="dm-marquee-num" style={{ color: t.accent }}>{String(i + 1).padStart(2, '0')}</span>
                {t.name}
                <span aria-hidden className="dm-marquee-sep" style={{ background: t.accent }} />
              </span>
            ))}
          </VelocityMarquee>
        </section>

        {/* ── Stats ─────────────────────────────────────────── */}
        <section ref={statsRef} className="dm-stats" aria-label="Sayılarla">
          <div className="dm-wrap dm-stats-grid">
            {STATS.map((s, i) => <StatCell key={s.label} stat={s} run={statsRun} index={i} />)}
          </div>
        </section>

        {/* ── Story ─────────────────────────────────────────── */}
        <section id="hikaye" className="dm-section dm-wrap">
          <SectionHead title="Zephara Neden Karanlıkta?" maxCh={14} />
          <div className="dm-story-grid">
            <ScrollWords lines={PROLOGUE} className="dm-story-words" />
            <aside className="dm-story-aside">
              <TiltCard className="dm-calling" glow="rgba(255,138,61,0.16)">
                {CALLING.map((line) => <p key={line}>{line}</p>)}
                <hr className="hr" />
                <p className="dm-calling-turn">
                  Aşağıda bulacağın şey bir canavar değil.{' '}
                  <span>Altı yüz yıldır sönmeyi reddeden bir adam.</span>
                </p>
                <p className="dm-muted" style={{ fontSize: 13 }}>Onu öldürmek Ateş&apos;i söndürür — biri yerine geçmezse.</p>
              </TiltCard>
            </aside>
          </div>
        </section>

        {/* ── Floors (pinned horizontal) ─────────────────────── */}
        <FloorShaft />

        {/* ── Full-bleed descend scene ───────────────────────── */}
        <section ref={descendRef} className="dm-descend" aria-label="Bir alt kata in">
          <motion.div className="dm-descend-frame" style={{ scale: dFrame }}>
            <motion.div style={{ scale: dScale, width: '100%', height: '100%' }}>
              <LiveScene scene="descend" cols={24} rows={8} showLabel={false} />
            </motion.div>
            <span aria-hidden className="dm-descend-fade" />
          </motion.div>
          <motion.p aria-hidden className="dm-descend-type" style={{ x: dTextX }}>
            Merdiveni Bul · Bir Alt Kata İn · Her Katta Yeni Düşmanlar ·
          </motion.p>
        </section>

        {/* ── Core mechanic ─────────────────────────────────── */}
        <section id="telegraf" className="dm-section dm-wrap">
          <SectionHead title="Saldırıyı Gör, Zamanında Kaç" maxCh={14} />
          <div className="dm-mech-grid">
            <div style={{ minWidth: 0 }}>
              <motion.p
                className="dm-lead"
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 1, ease: EASE_OUT_EXPO }}
              >
                Her düşman saldırısı üç aşamadan oluşur: hazırlık, vuruş ve toparlanma. Hazırlık
                boyunca vuracağı alan zeminde kırmızıyla dolar. Hasar vuruş anında nerede durduğuna
                göre hesaplanır; alandan zamanında çıkarsan hiç hasar almazsın.
              </motion.p>

              {/* Each row plays the thing its label describes, on the same clock
                  as the canvas: wind-up fills, the hit flashes, recovery drains. */}
              <div className="dm-phases">
                {PHASE_ROWS.map(({ key, num, label, time, note }) => {
                  const on = phase.phase === key;
                  const anim = key === 'windup' ? 'dmPhaseFill' : key === 'active' ? 'dmPhaseSnap' : 'dmPhaseDrain';
                  return (
                    <div key={key} className="dm-phase" data-on={on ? 'true' : undefined}>
                      {on && (
                        <span
                          key={phase.seq}
                          aria-hidden
                          className="dm-phase-fill"
                          data-kind={key}
                          style={{ animation: `${anim} ${phase.durationMs}ms linear forwards` }}
                        />
                      )}
                      <span className="dm-phase-num">{num}</span>
                      <span className="dm-phase-label">{label}</span>
                      <span className="dm-phase-time">{time}</span>
                      <span className="dm-phase-note">{note}</span>
                    </div>
                  );
                })}
              </div>
              <p className="dm-muted" style={{ fontSize: 12, marginTop: 18 }}>
                Hazırlık sırasında yeterince hasar alan düşmanın saldırısı bozulur ve düşman kısa süre sersemler.
              </p>
            </div>

            <figure className="dm-mech-figure">
              <TiltCard className="dm-mech-frame" max={4}>
                <LiveScene
                  scene="telegraph" floor={3} monster="dark_knight" cols={21} rows={13}
                  onPhase={onPhase}
                  timeScale={TELEGRAPH_SLOWDOWN}
                />
                <span aria-hidden className="dm-corner dm-corner--tl" />
                <span aria-hidden className="dm-corner dm-corner--br" />
              </TiltCard>
              <figcaption>
                Oyunun kendi zamanlaması; rahat izlenebilsin diye {TELEGRAPH_SLOWDOWN} kat yavaşlatıldı.
                Üç aşamanın birbirine oranı oyundakiyle aynı.
              </figcaption>
            </figure>
          </div>
        </section>

        {/* ── Classes ───────────────────────────────────────── */}
        <section id="siniflar" className="dm-section dm-wrap">
          <SectionHead title="Dört Sınıf, Dört Oyun Tarzı" maxCh={14} />
          <ClassAccordion />
        </section>

        {/* ── Rhythm ────────────────────────────────────────── */}
        <section className="dm-section dm-wrap">
          <SectionHead title="Her Kat Biraz Daha Zor" maxCh={14} />
          <div className="dm-rhythm-grid">
            {([
              {
                scene: 'volley' as const, floor: 6,
                title: 'Altıncı Kattan Sonra Düşmanlar da Ateş Eder',
                body: 'Gargoyle taş fırlatır, fantom ruh oku atar. Siperin arkasına geç, aralarındaki boşlukta ilerle.',
              },
              {
                scene: 'treasure' as const, floor: 4,
                title: 'Sandıklar Az, İçindekiler Değerli',
                body: 'İksir, altın ya da geçici güçlenme. Hangisini alacağın, bir sonraki kata ne kadar canla ineceğini belirler.',
              },
            ]).map((c, i) => (
              <motion.div
                key={c.scene}
                initial={{ opacity: 0, y: 80 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '0px 0px -10% 0px' }}
                transition={{ duration: 1.1, ease: EASE_OUT_EXPO, delay: i * 0.12 }}
              >
                <TiltCard className="dm-rhythm-card">
                  <div className="dm-rhythm-scene">
                    <LiveScene scene={c.scene} floor={c.floor} cols={18} rows={10} showLabel={false} />
                  </div>
                  <div className="dm-rhythm-copy">
                    <h3>{c.title}</h3>
                    <p>{c.body}</p>
                  </div>
                </TiltCard>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ── Play ──────────────────────────────────────────── */}
        <section id="oyna" className="dm-play">
          <div className="dm-play-glow" aria-hidden />
          <div className="dm-wrap">
            <RevealText as="h2" by="char" className="dm-play-title" text="Zindana İn" stagger={0.05} />
            <div className="dm-play-grid">
              <div>
                <p className="dm-lead" style={{ maxWidth: '40ch' }}>
                  Kurulum yok, hesap yok. Tek başına başla ya da bir oda kurup dört haneli kodu arkadaşlarına gönder; aynı zindanda buluşursunuz.
                </p>

                <AnimatePresence mode="wait" initial={false}>
                  {mode === 'idle' ? (
                    <motion.div
                      key="idle"
                      className="dm-play-actions"
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -16 }}
                      transition={{ duration: 0.45, ease: EASE_OUT_EXPO }}
                    >
                      <Magnetic strength={0.4}>
                        <button className="dm-orb" onClick={playSolo}>
                          <span className="dm-orb-ring" aria-hidden />
                          <span className="dm-orb-label">Tek Oyna<small>3 can</small></span>
                        </button>
                      </Magnetic>
                      <Magnetic>
                        <button className="dm-btn dm-btn--ghost" onClick={() => setMode('multiplayer')}>
                          <span className="dm-btn-label" data-text="Arkadaşlarınla Oyna">Arkadaşlarınla Oyna</span>
                          <span aria-hidden className="dm-btn-arrow">→</span>
                        </button>
                      </Magnetic>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="multi"
                      className="dm-play-form"
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -16 }}
                      transition={{ duration: 0.45, ease: EASE_OUT_EXPO }}
                    >
                      <label className="dm-field">
                        <input value={name} maxLength={12} placeholder=" "
                               onChange={(e) => setName(e.target.value.slice(0, 12))}
                               onKeyDown={(e) => { if (e.key === 'Enter') createRoom(); }} />
                        <span>İsmin</span>
                      </label>
                      <button className="dm-btn dm-btn--solid dm-btn--block" onClick={createRoom}>
                        <span className="dm-btn-label" data-text="Oda Kur">Oda Kur</span>
                      </button>

                      <div className="dm-play-or" aria-hidden><span>ya da</span></div>

                      <label className="dm-field">
                        <input value={code} maxLength={4} placeholder=" "
                               style={{ letterSpacing: '0.35em', textTransform: 'uppercase' }}
                               onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 4))}
                               onKeyDown={(e) => { if (e.key === 'Enter') joinRoom(); }} />
                        <span>Oda Kodu</span>
                      </label>
                      <button className="dm-btn dm-btn--ghost dm-btn--block" onClick={joinRoom}>
                        <span className="dm-btn-label" data-text="Katıl">Katıl</span>
                      </button>

                      <AnimatePresence>
                        {error && (
                          <motion.p
                            role="alert"
                            className="dm-error"
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: [0, -6, 6, -3, 0] }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.4 }}
                          >
                            {error}
                          </motion.p>
                        )}
                      </AnimatePresence>

                      <button className="dm-back" onClick={() => { setMode('idle'); setError(''); }}>← Geri</button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div>
                <p className="dm-eyebrow">Kontroller</p>
                <ul className="dm-keys">
                  {CONTROLS.map(([k, v], i) => (
                    <motion.li
                      key={k}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.7, ease: EASE_OUT_EXPO, delay: i * 0.05 }}
                    >
                      <span className="dm-keys-caps">
                        {k.split(' ').map((c) => <kbd key={c}>{c}</kbd>)}
                      </span>
                      <span className="dm-muted">{v}</span>
                    </motion.li>
                  ))}
                </ul>
                <p className="dm-muted" style={{ fontSize: 12, marginTop: 16 }}>
                  Chrome, Safari, Edge · masaüstü, tablet ve telefon
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer ref={footRef} className="dm-footer">
        <div className="dm-wrap dm-footer-row">
          <span>© Dungeon Mates</span>
          <span className="dm-muted">Tüm sprite&apos;lar Canvas ile prosedürel çizilir — sprite sheet yok.</span>
          <button className="dm-back" onClick={() => scrollToTarget(0)}>Başa Dön ↑</button>
        </div>
        <div className="dm-footer-mark" aria-hidden>
          <motion.span style={{ y: footY }}>Dungeon Mates</motion.span>
        </div>
      </footer>

      <MetaProgression open={metaOpen} onClose={() => setMetaOpen(false)} />
    </div>
    </MotionConfig>
  );
}

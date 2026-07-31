'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { CLASS_STATS, type PlayerClass, floorTheme } from '../../shared/types';
import { PixelHero } from '@/components/game/PixelHero';
import { Descent } from '@/components/landing/Descent';
import { FloorStrip } from '@/components/landing/FloorStrip';
import { MetaProgression } from '@/components/game/MetaProgression';
import { loadMeta, type MetaState } from '@/lib/meta-progression';
import { useSound } from '@/hooks/useSound';

const EASE = [0.22, 1, 0.36, 1] as const;

type Mode = 'idle' | 'multiplayer';

/** What each class actually does in a fight — mechanics, not adjectives. */
const CLASS_ROLE: Record<PlayerClass, { role: string; line: string }> = {
  warrior: {
    role: 'ön saf',
    line: 'Kalkan duvarı gelen hasarı yutar. Ağır düşmanları hazırlık anında sersemletip saldırılarını iptal eder.',
  },
  mage: {
    role: 'alan hasarı',
    line: 'Buz fırtınası kalabalığı yavaşlatır. Yanan bir hedefe buz vurursan donar.',
  },
  archer: {
    role: 'menzil',
    line: 'En hızlı sınıf. Kritik yığar, ok yağmuruyla koridoru kapatır.',
  },
  healer: {
    role: 'destek',
    line: 'Takımı ayakta tutar. Ultimate tüm ekibe üç saniye dokunulmazlık verir.',
  },
};

/** Facts the reader can verify by playing — read off the actual build. */
const SPECS = [
  { k: 'kat', v: '10' },
  { k: 'sınıf', v: '4' },
  { k: 'canavar', v: '17' },
  { k: 'oyuncu', v: '1–4' },
  { k: 'kurulum', v: 'yok' },
] as const;

const CONTROLS = [
  ['WASD', 'hareket'],
  ['Fare', 'nişan'],
  ['Sol tık / Space', 'saldırı'],
  ['Q', 'takla'],
  ['E', 'yetenek'],
  ['F', 'ultimate'],
] as const;

export default function HomePage() {
  const router = useRouter();
  const sound = useSound();
  const [mode, setMode] = useState<Mode>('idle');
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  const [activeClass, setActiveClass] = useState<PlayerClass>('warrior');
  const [metaOpen, setMetaOpen] = useState(false);
  const [meta, setMeta] = useState<MetaState | null>(null);

  // Reload after the panel closes so a freshly spent shard count shows in the nav.
  useEffect(() => { setMeta(loadMeta()); }, [metaOpen]);

  const handleCreate = useCallback(() => {
    if (!playerName.trim()) {
      setError('Önce bir isim gir.');
      return;
    }
    setError('');
    router.push(`/game?room=new&name=${encodeURIComponent(playerName.trim())}`);
  }, [playerName, router]);

  const handleJoin = useCallback(() => {
    if (!playerName.trim()) {
      setError('Önce bir isim gir.');
      return;
    }
    if (roomCode.trim().length !== 4) {
      setError('Oda kodu 4 haneli.');
      return;
    }
    setError('');
    router.push(`/game?room=${roomCode.trim().toUpperCase()}&name=${encodeURIComponent(playerName.trim())}`);
  }, [playerName, roomCode, router]);

  const scrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const classEntries = useMemo(
    () => Object.entries(CLASS_STATS) as [PlayerClass, (typeof CLASS_STATS)[PlayerClass]][],
    [],
  );

  const surface = floorTheme(1);

  return (
    <main className="relative">
      {/* ── Top rail ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#04070d]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-3 sm:px-8">
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="font-pixel text-[10px] text-zinc-100 transition-colors hover:text-dm-accent sm:text-xs"
          >
            DUNGEON<span className="text-dm-accent">MATES</span>
          </button>

          <nav className="ml-auto hidden items-center gap-6 sm:flex">
            <button onClick={() => scrollTo('inis')} className="font-mono text-[11px] uppercase tracking-widest text-zinc-500 transition-colors hover:text-zinc-200">
              iniş
            </button>
            <button onClick={() => scrollTo('siniflar')} className="font-mono text-[11px] uppercase tracking-widest text-zinc-500 transition-colors hover:text-zinc-200">
              sınıflar
            </button>
            <button onClick={() => setMetaOpen(true)} className="font-mono text-[11px] uppercase tracking-widest text-zinc-500 transition-colors hover:text-zinc-200">
              kalıntılar{meta && meta.shards > 0 ? ` · ${meta.shards}` : ''}
            </button>
          </nav>

          <button
            onClick={() => scrollTo('oyna')}
            className="ml-auto rounded border border-dm-accent/40 bg-dm-accent/10 px-3 py-1.5 font-pixel text-[9px] text-dm-accent transition-colors hover:bg-dm-accent/20 sm:ml-0"
          >
            OYNA
          </button>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-white/[0.06]">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 pb-16 pt-16 sm:px-8 sm:pb-24 sm:pt-24 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-14">
          {/* min-w-0 on both columns: the tile canvases carry an intrinsic width and
              grid items will not shrink below min-content without it. */}
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-zinc-600">
              Zephara · yüzeyin altı
            </p>

            <h1 className="mt-5 font-pixel text-[19px] leading-[1.7] text-zinc-50 sm:text-[26px] sm:leading-[1.65]">
              On kat aşağı.<br />
              <span style={{ color: surface.accent }}>Tek çıkış</span><br />
              en dipte.
            </h1>

            <p className="mt-6 max-w-md font-body text-[15px] leading-relaxed text-zinc-400">
              Tarayıcıda açılan co-op zindan. Düşmanlar vuracakları yeri önce
              zeminde gösterir — okuyabilirsen kaçabilirsin. Dört sınıf, on kat,
              bir yozlaşmış kral.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                onClick={() => router.push('/game?mode=solo&name=Kahraman')}
                className="rounded border border-dm-gold/45 bg-dm-gold/[0.12] px-5 py-2.5 font-pixel text-[10px] text-dm-gold transition-colors hover:bg-dm-gold/20"
              >
                TEK BAŞINA İN
              </button>
              <button
                onClick={() => scrollTo('oyna')}
                className="rounded border border-white/[0.12] px-5 py-2.5 font-pixel text-[10px] text-zinc-300 transition-colors hover:border-white/30 hover:text-white"
              >
                ODA KUR
              </button>
            </div>

            {/* Specs read as an instrument panel, not marketing stat cards */}
            <dl className="mt-10 flex flex-wrap gap-x-7 gap-y-3 border-t border-white/[0.06] pt-5">
              {SPECS.map((s) => (
                <div key={s.k}>
                  <dt className="font-mono text-[9px] uppercase tracking-[0.18em] text-zinc-600">{s.k}</dt>
                  <dd className="mt-0.5 font-mono text-sm font-medium tabular-nums text-zinc-300">{s.v}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Real tiles from the game's own renderer, stacked as a shaft */}
          <div className="relative min-w-0">
            <div className="overflow-hidden rounded-lg border border-white/[0.07]">
              {[1, 4, 7, 10].map((f, i) => (
                <motion.div
                  key={f}
                  className="h-[74px] border-b border-black/40 last:border-b-0 sm:h-[92px]"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.1 + i * 0.12, ease: EASE }}
                >
                  <FloorStrip floor={f} />
                </motion.div>
              ))}
            </div>
            <p className="mt-3 text-right font-mono text-[9px] uppercase tracking-[0.18em] text-zinc-700">
              kat 1 · 4 · 7 · 10 — oyunun kendi çizimi
            </p>
          </div>
        </div>
      </section>

      {/* ── The descent ──────────────────────────────────────── */}
      <Descent />

      {/* ── Classes ──────────────────────────────────────────── */}
      <section id="siniflar" className="border-t border-white/[0.06]">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-600">Sınıflar</p>
          <h2 className="mt-4 font-pixel text-[13px] leading-relaxed text-zinc-100 sm:text-lg">
            Dördü de aynı zindana iner.<br />Aynı şekilde değil.
          </h2>

          <div className="mt-10 grid gap-8 lg:grid-cols-[260px_1fr] lg:gap-12">
            <div className="flex gap-2 lg:flex-col">
              {classEntries.map(([cls, stats]) => {
                const on = cls === activeClass;
                return (
                  <button
                    key={cls}
                    onClick={() => setActiveClass(cls)}
                    className={`flex-1 rounded border px-3 py-3 text-left transition-all lg:flex-none ${
                      on ? 'border-white/20 bg-white/[0.05]' : 'border-white/[0.06] hover:border-white/[0.12]'
                    }`}
                    aria-pressed={on}
                  >
                    <span
                      className="block font-pixel text-[10px]"
                      style={{ color: on ? stats.color : '#a1a1aa' }}
                    >
                      {stats.label}
                    </span>
                    <span className="mt-1 hidden font-mono text-[9px] uppercase tracking-widest text-zinc-600 lg:block">
                      {CLASS_ROLE[cls].role}
                    </span>
                  </button>
                );
              })}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeClass}
                className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-6 sm:p-8"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.28, ease: EASE }}
              >
                <div className="flex items-start gap-5">
                  <div className="shrink-0">
                    <PixelHero playerClass={activeClass} size="lg" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-pixel text-xs" style={{ color: CLASS_STATS[activeClass].color }}>
                      {CLASS_STATS[activeClass].label}
                    </h3>
                    <p className="mt-3 max-w-prose font-body text-sm leading-relaxed text-zinc-400">
                      {CLASS_ROLE[activeClass].line}
                    </p>
                  </div>
                </div>

                {/* The same numbers the server uses, straight from CLASS_STATS */}
                <dl className="mt-7 grid grid-cols-3 gap-x-6 gap-y-3 border-t border-white/[0.06] pt-5 sm:grid-cols-6">
                  {([
                    ['can', CLASS_STATS[activeClass].maxHp],
                    ['mana', CLASS_STATS[activeClass].maxMana],
                    ['saldırı', CLASS_STATS[activeClass].attack],
                    ['savunma', CLASS_STATS[activeClass].defense],
                    ['hız', CLASS_STATS[activeClass].speed],
                    ['menzil', CLASS_STATS[activeClass].attackRange],
                  ] as const).map(([k, v]) => (
                    <div key={k}>
                      <dt className="font-mono text-[9px] uppercase tracking-[0.18em] text-zinc-600">{k}</dt>
                      <dd className="mt-0.5 font-mono text-sm tabular-nums text-zinc-300">{v}</dd>
                    </div>
                  ))}
                </dl>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* ── Play ─────────────────────────────────────────────── */}
      <section id="oyna" className="border-t border-white/[0.06]">
        <div className="mx-auto max-w-lg px-5 py-20 sm:px-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-600">Başla</p>
          <h2 className="mt-4 font-pixel text-[13px] leading-relaxed text-zinc-100 sm:text-base">
            Kurulum yok. İsim yeter.
          </h2>

          <div className="mt-8 rounded-lg border border-white/[0.07] bg-white/[0.02] p-6">
            <AnimatePresence mode="wait">
              {mode === 'idle' ? (
                <motion.div
                  key="idle"
                  className="flex flex-col gap-3"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <button
                    onClick={() => router.push('/game?mode=solo&name=Kahraman')}
                    className="group flex items-center justify-between rounded border border-dm-gold/35 bg-dm-gold/[0.08] px-4 py-4 text-left transition-colors hover:bg-dm-gold/[0.15]"
                  >
                    <span>
                      <span className="block font-pixel text-[10px] text-dm-gold">Tek başına in</span>
                      <span className="mt-1.5 block font-body text-xs text-zinc-500">3 can, anında başlar</span>
                    </span>
                    <span className="font-mono text-lg text-dm-gold/60 transition-transform group-hover:translate-x-0.5">→</span>
                  </button>

                  <button
                    onClick={() => setMode('multiplayer')}
                    className="group flex items-center justify-between rounded border border-dm-accent/30 bg-dm-accent/[0.06] px-4 py-4 text-left transition-colors hover:bg-dm-accent/[0.12]"
                  >
                    <span>
                      <span className="block font-pixel text-[10px] text-dm-accent">Arkadaşlarınla in</span>
                      <span className="mt-1.5 block font-body text-xs text-zinc-500">4 kişiye kadar, oda koduyla</span>
                    </span>
                    <span className="font-mono text-lg text-dm-accent/60 transition-transform group-hover:translate-x-0.5">→</span>
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="mp"
                  className="flex flex-col gap-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <label className="flex flex-col gap-1.5">
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-600">İsmin</span>
                    <input
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value.slice(0, 12))}
                      placeholder="Kahraman"
                      maxLength={12}
                      className="rounded border border-white/10 bg-black/40 px-3 py-2.5 font-body text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-700 focus:border-dm-accent/50"
                    />
                  </label>

                  <button
                    onClick={handleCreate}
                    className="rounded border border-dm-accent/40 bg-dm-accent/[0.12] px-4 py-2.5 font-pixel text-[10px] text-dm-accent transition-colors hover:bg-dm-accent/20"
                  >
                    ODA KUR
                  </button>

                  <div className="flex items-center gap-3">
                    <span className="h-px flex-1 bg-white/[0.07]" />
                    <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-700">veya katıl</span>
                    <span className="h-px flex-1 bg-white/[0.07]" />
                  </div>

                  <div className="flex gap-2">
                    <input
                      value={roomCode}
                      onChange={(e) => setRoomCode(e.target.value.toUpperCase().slice(0, 4))}
                      placeholder="KOD"
                      maxLength={4}
                      aria-label="Oda kodu"
                      className="w-28 rounded border border-white/10 bg-black/40 px-3 py-2.5 text-center font-mono text-sm uppercase tracking-[0.25em] text-zinc-100 outline-none transition-colors placeholder:text-zinc-700 focus:border-dm-accent/50"
                    />
                    <button
                      onClick={handleJoin}
                      className="flex-1 rounded border border-white/[0.12] px-4 py-2.5 font-pixel text-[10px] text-zinc-300 transition-colors hover:border-white/30 hover:text-white"
                    >
                      KATIL
                    </button>
                  </div>

                  {error && <p role="alert" className="font-body text-xs text-red-400">{error}</p>}

                  <button
                    onClick={() => { setMode('idle'); setError(''); }}
                    className="self-start font-mono text-[10px] uppercase tracking-widest text-zinc-600 transition-colors hover:text-zinc-400"
                  >
                    ← geri
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-2.5 border-t border-white/[0.06] pt-6">
            {CONTROLS.map(([k, v]) => (
              <div key={k} className="flex items-baseline gap-2.5">
                <dt className="font-mono text-[10px] text-zinc-400">{k}</dt>
                <dd className="font-body text-xs text-zinc-600">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span className="font-pixel text-[9px] text-zinc-600">
            DUNGEON<span className="text-dm-accent/60">MATES</span>
          </span>
          <span className="font-mono text-[10px] text-zinc-700">
            Tüm sprite&apos;lar Canvas ile prosedürel çizilir — sprite sheet yok.
          </span>
        </div>
      </footer>

      <MetaProgression open={metaOpen} onClose={() => setMetaOpen(false)} />
    </main>
  );
}

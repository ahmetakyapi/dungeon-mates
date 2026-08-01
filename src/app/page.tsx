'use client';

/*
 * Landing page, built on the "Modernist" Claude Design system.
 *
 * Direction: the game presented as a catalogue. Modernist is flat, architectural
 * Swiss — light ground, Archivo throughout, zero radius, strong 2px rules, a
 * visible modular grid and everything flush left. A dark pixel dungeon printed as
 * technical plates on white paper reads like a specimen catalogue, which is a far
 * more considered frame than the usual dark-hero-with-gradient-blobs.
 *
 * One judged deviation from the system's "print photographs in black and white"
 * rule: the tile plates stay in colour. They are not photographs — the per-floor
 * palette IS the subject being catalogued, and greyscaling them would delete the
 * content. Everything else on the page holds to ink + a single vermilion, so the
 * plates are the only chromatic elements, which is how a Swiss catalogue handles
 * colour specimens anyway.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CLASS_STATS, type PlayerClass, floorTheme } from '../../shared/types';
import { FloorStrip } from '@/components/landing/FloorStrip';
import { MetaProgression } from '@/components/game/MetaProgression';
import { loadMeta, type MetaState } from '@/lib/meta-progression';
import '../styles/modernist.css';

type Mode = 'idle' | 'multiplayer';

/** Act structure from STORY.md — the descent is a sequence, so it gets numbered. */
const ACTS: Record<number, string> = {
  1: 'I — Yüzey',
  5: 'II — Derinlikler',
  8: 'III — Karanlığın Kalbi',
};

const BOSS_FLOORS = new Set([3, 5, 7, 8, 10]);

/** Which boss holds which floor — the index carries this, the plates cannot. */
const BOSS_NAME: Record<number, string> = {
  3: 'Ocak Muhafızı',
  5: 'Örümcek Kraliçe',
  7: 'Taş Muhafız',
  8: 'Alev Şövalyesi',
  10: "Kral Mor'Khan",
};

/** What the player meets on each floor. Catalogue entries, not marketing copy. */
const FLOOR_ENTRY: Record<number, { fauna: string; note: string }> = {
  1: { fauna: 'Sıçan, balçık, yarasa', note: 'Hazırlıksız saldırırlar. Telegraf yok.' },
  2: { fauna: 'İskelet, örümcek', note: 'İlk koni telegrafları burada görülür.' },
  3: { fauna: 'Goblin, hayalet', note: 'Ocak Muhafızı. Yer sarsıntısı önce zeminde belirir.' },
  4: { fauna: 'Goblin, mantar', note: 'Ağır saldırılar; uzun hazırlık, uzun toparlanma.' },
  5: { fauna: 'Örümcek sürüsü', note: 'Örümcek Kraliçe. İkinci fazda alanı köklendirir.' },
  6: { fauna: 'Gargoyle, hayalet', note: 'İlk menzilli düşmanlar. Taş fırlatırlar.' },
  7: { fauna: 'Gargoyle, kara şövalye', note: 'Taş Muhafız. Taşlaştırma bakışı koni hâlinde.' },
  8: { fauna: 'Lav balçığı, fantom', note: 'Alev Şövalyesi. Hücum çizgisi zeminde görünür.' },
  9: { fauna: 'Fantom, kara şövalye', note: 'Duvarlardan geçerler. Açık alanda durma.' },
  10: { fauna: 'Kara şövalye', note: "Mor'Khan. Üç faz; her fazda daha hızlı." },
};

const CLASS_ROLE: Record<PlayerClass, { role: string; note: string }> = {
  warrior: { role: 'Ön saf', note: 'Kalkan duvarı hasarı yutar. Ağır düşmanı hazırlık anında sersemletir.' },
  mage: { role: 'Alan hasarı', note: 'Buz fırtınası yavaşlatır. Yanan hedefe buz vurulursa dondurur.' },
  archer: { role: 'Menzil', note: 'En hızlı sınıf. Kritik yığar; ok yağmuru koridoru kapatır.' },
  healer: { role: 'Destek', note: 'Takımı ayakta tutar. Ultimate ekibe üç saniye dokunulmazlık verir.' },
};

const SPECS: ReadonlyArray<readonly [string, string]> = [
  ['Kat', '10'],
  ['Sınıf', '4'],
  ['Canavar', '17'],
  ['Oyuncu', '1–4'],
  ['Kurulum', 'Yok'],
];

const CONTROLS: ReadonlyArray<readonly [string, string]> = [
  ['WASD', 'Hareket'],
  ['Fare', 'Nişan'],
  ['Sol tık / Space', 'Saldırı'],
  ['Q', 'Takla'],
  ['E', 'Yetenek'],
  ['F', 'Ultimate'],
  ['R', 'Etkileşim'],
];

export default function HomePage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('idle');
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  const [metaOpen, setMetaOpen] = useState(false);
  const [meta, setMeta] = useState<MetaState | null>(null);

  useEffect(() => { setMeta(loadMeta()); }, [metaOpen]);

  const handleCreate = useCallback(() => {
    if (!playerName.trim()) { setError('Önce bir isim gir.'); return; }
    setError('');
    router.push(`/game?room=new&name=${encodeURIComponent(playerName.trim())}`);
  }, [playerName, router]);

  const handleJoin = useCallback(() => {
    if (!playerName.trim()) { setError('Önce bir isim gir.'); return; }
    if (roomCode.trim().length !== 4) { setError('Oda kodu 4 haneli.'); return; }
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

  return (
    <div className="modernist" style={{ minHeight: '100dvh' }}>
      {/* ── Nav ───────────────────────────────────────────── */}
      <nav className="nav" style={{ position: 'sticky', top: 0, zIndex: 40, background: 'var(--color-bg)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        <span className="nav-brand">Dungeon Mates</span>
        <button className="btn btn-ghost" onClick={() => scrollTo('katalog')}>Katalog</button>
        <button className="btn btn-ghost" onClick={() => scrollTo('siniflar')}>Sınıflar</button>
        <button className="btn btn-ghost" onClick={() => setMetaOpen(true)}>
          Kalıntılar{meta && meta.shards > 0 ? ` (${meta.shards})` : ''}
        </button>
        <button className="btn btn-primary" onClick={() => scrollTo('oyna')}>Oyna</button>
      </nav>

      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 var(--space-4)' }}>
        {/* ── Hero ────────────────────────────────────────── */}
        <header style={{ paddingTop: 'var(--space-8)', paddingBottom: 'var(--space-6)' }}>
          <h6 className="text-muted" style={{ margin: 0 }}>Zephara · Yüzeyin altı</h6>

          <h1 style={{ fontSize: 'clamp(44px, 9vw, 104px)', marginTop: 'var(--space-4)', maxWidth: '14ch' }}>
            On kat aşağı.
          </h1>
          <h1
            style={{
              fontSize: 'clamp(44px, 9vw, 104px)',
              color: 'var(--color-accent)',
              marginTop: 0,
              maxWidth: '18ch',
            }}
          >
            Tek çıkış en dipte.
          </h1>

          <p style={{ maxWidth: '58ch', fontSize: 17, marginTop: 'var(--space-6)' }}>
            Tarayıcıda açılan co-op zindan. Düşmanlar vuracakları yeri önce zeminde
            gösterir — okuyabilirsen kaçabilirsin. Dört sınıf, on kat, bir yozlaşmış kral.
          </p>

          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginTop: 'var(--space-6)' }}>
            <button className="btn btn-primary" onClick={() => router.push('/game?mode=solo&name=Kahraman')}>
              Tek başına in
            </button>
            <button className="btn btn-secondary" onClick={() => scrollTo('oyna')}>
              Oda kur
            </button>
          </div>

          <hr className="hr" style={{ marginTop: 'var(--space-8)' }} />

          {/* Specs on the modular grid — equal cells, visible structure */}
          <dl
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(120px, 100%), 1fr))',
              gap: 0,
              margin: 0,
              borderLeft: '1px solid var(--color-divider)',
            }}
          >
            {SPECS.map(([k, v]) => (
              <div key={k} style={{ borderRight: '1px solid var(--color-divider)', padding: 'var(--space-3)' }}>
                <dt style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }} className="text-muted">{k}</dt>
                <dd style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 28 }}>{v}</dd>
              </div>
            ))}
          </dl>
        </header>

        {/* ── Catalogue: the ten floors ────────────────────── */}
        <section id="katalog" style={{ paddingTop: 'var(--space-8)' }}>
          <hr className="hr" style={{ height: 2, marginBottom: 'var(--space-6)' }} />
          <h6 className="text-muted">Katalog</h6>
          <h2 style={{ maxWidth: '20ch' }}>On kat, on palet.</h2>
          <p className="text-muted" style={{ maxWidth: '56ch', fontSize: 14 }}>
            Her katın kendi taş rampası var. Aşağıdaki plakalar oyunun kendi çizim
            koduyla üretildi — aynı <code>drawTile</code>, aynı palet, aynı komşu
            maskesi. Ekran görüntüsü değil.
          </p>

          {/* Plates on a modular grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(min(420px, 100%), 1fr))',
              gap: 'var(--space-6)',
              marginTop: 'var(--space-6)',
            }}
          >
            {Array.from({ length: 10 }).map((_, i) => {
              const floor = i + 1;
              const theme = floorTheme(floor);
              const entry = FLOOR_ENTRY[floor];
              return (
                <figure key={floor}>
                  <div style={{ height: 112, border: '1px solid var(--color-divider)' }}>
                    <FloorStrip floor={floor} />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                    <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 20, color: 'var(--color-accent)' }}>
                      {String(floor).padStart(2, '0')}
                    </span>
                    <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 17 }}>
                      {theme.name}
                    </span>
                    {BOSS_FLOORS.has(floor) && <span className="tag tag-outline">Boss</span>}
                  </div>

                  {/* The floor's actual stone ramp, as a colour specimen */}
                  <div style={{ display: 'flex', marginTop: 'var(--space-2)' }}>
                    {[...theme.wall, theme.growth, theme.accent].map((c, ci) => (
                      <span key={ci} style={{ background: c, height: 14, flex: 1 }} />
                    ))}
                  </div>

                  <figcaption style={{ marginTop: 'var(--space-2)' }}>
                    {entry.fauna} — {entry.note}
                  </figcaption>
                </figure>
              );
            })}
          </div>

          {/* The same data as a table — a catalogue indexes as well as illustrates */}
          <h6 className="text-muted" style={{ marginTop: 'var(--space-8)' }}>Dizin — perde, boss, takviye dalgası</h6>
          <div style={{ overflowX: 'auto', marginTop: 'var(--space-3)' }}>
          <table className="table" style={{ minWidth: 560 }}>
            <thead>
              <tr>
                <th style={{ width: 56 }}>Kat</th>
                <th>Ad</th>
                <th>Perde</th>
                <th>Boss</th>
                <th style={{ textAlign: 'right' }}>Dalga</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 10 }).map((_, i) => {
                const floor = i + 1;
                let act = '';
                for (const key of [1, 5, 8]) if (floor >= key) act = ACTS[key];
                return (
                  <tr key={floor}>
                    <td style={{ fontFamily: 'var(--font-heading)', fontWeight: 800 }}>
                      {String(floor).padStart(2, '0')}
                    </td>
                    <td>
                      {floorTheme(floor).name}
                      {BOSS_FLOORS.has(floor) && (
                        <span className="tag tag-accent" style={{ marginLeft: 'var(--space-2)' }}>Boss</span>
                      )}
                    </td>
                    <td className="text-muted">{act}</td>
                    <td className="text-muted">{BOSS_NAME[floor] ?? '—'}</td>
                    <td className="text-muted" style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {floor >= 6 ? 2 : floor >= 2 ? 1 : 0}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </section>

        {/* ── Classes ──────────────────────────────────────── */}
        <section id="siniflar" style={{ paddingTop: 'var(--space-8)' }}>
          <hr className="hr" style={{ marginBottom: 'var(--space-6)' }} />
          <h6 className="text-muted">Sınıflar</h6>
          <h2 style={{ maxWidth: '24ch' }}>Dördü de aynı zindana iner. Aynı şekilde değil.</h2>

          <div style={{ overflowX: 'auto', marginTop: 'var(--space-4)' }}>
          <table className="table" style={{ minWidth: 620 }}>
            <thead>
              <tr>
                <th>Sınıf</th>
                <th>Rol</th>
                <th style={{ textAlign: 'right' }}>Can</th>
                <th style={{ textAlign: 'right' }}>Mana</th>
                <th style={{ textAlign: 'right' }}>Saldırı</th>
                <th style={{ textAlign: 'right' }}>Savunma</th>
                <th style={{ textAlign: 'right' }}>Hız</th>
                <th style={{ textAlign: 'right' }}>Menzil</th>
              </tr>
            </thead>
            <tbody>
              {classEntries.map(([cls, stats]) => (
                <tr key={cls}>
                  <td style={{ fontFamily: 'var(--font-heading)', fontWeight: 800 }}>{stats.label}</td>
                  <td className="text-muted">{CLASS_ROLE[cls].role}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{stats.maxHp}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{stats.maxMana}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{stats.attack}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{stats.defense}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{stats.speed}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{stats.attackRange}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))',
              gap: 'var(--space-3)',
              marginTop: 'var(--space-4)',
            }}
          >
            {classEntries.map(([cls, stats]) => (
              <div className="card" key={cls}>
                <span className="card-kicker">{CLASS_ROLE[cls].role}</span>
                <span className="card-title">{stats.label}</span>
                <p className="card-body">{CLASS_ROLE[cls].note}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Play ─────────────────────────────────────────── */}
        <section id="oyna" style={{ paddingTop: 'var(--space-8)', paddingBottom: 'var(--space-8)' }}>
          <hr className="hr" style={{ marginBottom: 'var(--space-6)' }} />
          <h6 className="text-muted">Başla</h6>
          <h2>Kurulum yok. İsim yeter.</h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))',
              gap: 'var(--space-6)',
              marginTop: 'var(--space-4)',
              alignItems: 'start',
            }}
          >
            <div>
              {mode === 'idle' ? (
                <>
                  <button className="btn btn-primary btn-block" onClick={() => router.push('/game?mode=solo&name=Kahraman')}>
                    Tek başına in — 3 can
                  </button>
                  <button className="btn btn-secondary btn-block" onClick={() => setMode('multiplayer')}>
                    Arkadaşlarınla in — 4 kişiye kadar
                  </button>
                </>
              ) : (
                <>
                  <div className="field">
                    <label htmlFor="dm-name">İsmin</label>
                    <input
                      id="dm-name"
                      className="input"
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value.slice(0, 12))}
                      placeholder="Kahraman"
                      maxLength={12}
                    />
                  </div>

                  <button className="btn btn-primary btn-block" onClick={handleCreate}>Oda kur</button>

                  <div className="field" style={{ marginTop: 'var(--space-4)' }}>
                    <label htmlFor="dm-code">Oda kodu</label>
                    <input
                      id="dm-code"
                      className="input"
                      value={roomCode}
                      onChange={(e) => setRoomCode(e.target.value.toUpperCase().slice(0, 4))}
                      placeholder="ABCD"
                      maxLength={4}
                      style={{ textTransform: 'uppercase', letterSpacing: '0.25em' }}
                    />
                  </div>
                  <button className="btn btn-secondary btn-block" onClick={handleJoin}>Katıl</button>

                  {error && (
                    <p role="alert" style={{ color: 'var(--color-accent-700)', fontSize: 13, marginTop: 'var(--space-3)' }}>
                      {error}
                    </p>
                  )}

                  <button className="btn btn-ghost" style={{ marginTop: 'var(--space-3)' }} onClick={() => { setMode('idle'); setError(''); }}>
                    ← Geri
                  </button>
                </>
              )}
            </div>

            <div>
              <h6 className="text-muted">Kontroller</h6>
              <table className="table">
                <tbody>
                  {CONTROLS.map(([k, v]) => (
                    <tr key={k}>
                      <td style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, width: '48%' }}>{k}</td>
                      <td className="text-muted">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      {/* ── Closing poster ───────────────────────────────────
          The system reserves one place for the accent to run as a field:
          the closing banner. Type stays display-grade and the red carries it. */}
      <section style={{ background: 'var(--color-accent)', color: 'var(--color-bg)', padding: 'var(--space-8) var(--space-4)' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(34px, 6.5vw, 72px)', maxWidth: '16ch', color: 'var(--color-bg)' }}>
            Kral hâlâ tahtta.
          </h2>
          <button
            className="btn"
            style={{ background: 'var(--color-bg)', color: 'var(--color-accent)', marginTop: 'var(--space-4)' }}
            onClick={() => router.push('/game?mode=solo&name=Kahraman')}
          >
            Zindana in
          </button>
        </div>
      </section>

      <footer style={{ maxWidth: 1120, margin: '0 auto', padding: 'var(--space-6) var(--space-4)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800 }}>Dungeon Mates</span>
          <span className="text-muted" style={{ fontSize: 13 }}>
            Tüm sprite&apos;lar Canvas ile prosedürel çizilir — sprite sheet yok.
          </span>
        </div>
      </footer>

      <MetaProgression open={metaOpen} onClose={() => setMetaOpen(false)} />
    </div>
  );
}

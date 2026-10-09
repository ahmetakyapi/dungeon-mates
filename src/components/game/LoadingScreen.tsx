'use client';

import { useState, useEffect } from 'react';
import { ACTS } from '../../../shared/types';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import { MaskReveal, SplitReveal } from '@/components/fx/RevealText';
import { EASE_OUT_EXPO, EASE_IN_OUT, prefersReducedMotion } from '@/lib/motion';

type LoadingScreenProps = {
  message: string;
  subMessage?: string;
  floor?: number;
};

const GAME_TIPS: Record<number, readonly string[]> = {
  0: [
    'Zephara bir zamanlar yerin altındaki en görkemli şehirdi.',
    'Kral Mor\'Khan halkını korumak istedi. Ama bedeli çok ağır oldu.',
    'Canavarlar bir zamanlar Zephara\'nın vatandaşlarıydı.',
    'Kapılar ancak tüm düşmanlar temizlenince açılır — eski güvenlik sistemi hâlâ çalışıyor.',
    'Takım halinde hareket et — yalnız kalanı Zephara yutar.',
    'Sandıklar eski sakinlerin eşyalarını içeriyor.',
    'Her katta tehlike büyüyor — hazırlıklı ol.',
    'Merdiveni bulmak için tüm odaları temizle.',
  ],
  1: [
    'Yıkık Kapılar — Zephara\'nın çökmüş girişi. Haşereler her yerde.',
    'Fareler sürü halinde saldırır — bölüp avla.',
    'Balçıklar eski lağım sisteminin kalıntıları.',
    'Bu kat Zephara\'nın dış halkası — gerçek şehir aşağıda.',
  ],
  2: [
    'Sessiz Sokaklar — Evlerin kapıları hâlâ açık, sahipleri çoktan gitti.',
    'İskeletler eski muhafızların kalıntıları — hâlâ nöbet tutuyorlar.',
    'Örümcekler Zephara\'nın dokumacılarıydı bir zamanlar.',
    'Yarasalar keşif birliğinin son kalıntıları.',
  ],
  3: [
    'Derin Tüneller — Madencilerin çekiç sesleri kesileli yüzyıllar oldu.',
    'Goblinler işçi kastının yozlaşmış torunları.',
    'Mantarlar zehir saçıyor — mesafe koru.',
    'Tünellerin duvarlarında eski yazıtlar var. Kim okuyabilir ki artık?',
  ],
  4: [
    'Terkedilmiş Pazar — Eski ticaret merkezi. Tezgahlar devrilmiş.',
    'Gölgeler hareket ediyor — tuzaklara dikkat et.',
    'Pazarın altında daha karanlık bir şey var.',
    'Zephara\'nın tüccarları bir zamanlar zenginlik içindeydi.',
  ],
  5: [
    'Örümcek Kraliçe\'nin İni — MID-BOSS katı!',
    'Kraliçe ağ fırlatır — hareket etmeyi bırakma.',
    'Yavru örümcekleri önce temizle, sonra kraliçeye odaklan.',
    'Örümcek Kraliçe Zephara\'nın eski dokumacılarının lideriydi.',
  ],
  6: [
    'Yıkık Kütüphane — Zephara\'nın bilgi merkezi. Kitaplar çürümüş ama ruhlar hâlâ okuyor.',
    'Hayaletler duvarlardan geçer — arkana dikkat et.',
    'Eski yazıtlar Mor\'Khan\'ın ritüelini anlatıyor. Bir zamanlar iyi bir kraldı.',
    'Kütüphanedeki sandıklar değerli loot içerir.',
  ],
  7: [
    'Taş Bahçeler — Petrified bitki kalıntıları ve gargoiller.',
    'Gargoiller taş gibi dayanıklı — savaşçı önde gitsin.',
    'Fantom düşmanlar görünmez olabilir — dikkatli ol.',
    'Zephara\'nın bahçeleri bir zamanlar şehrin gururuydu.',
  ],
  8: [
    'Lav Nehirleri — Magma arasında yürü, lav balçıklarına dikkat.',
    'Lav balçıkları patlayınca alan hasarı verir — mesafe koru.',
    'Karanlık şövalyeler en güçlü düşmanlar — birlikte saldırın.',
    'Sıcaklık arttıkça Mor\'Khan\'ın gücü de artıyor.',
  ],
  9: [
    'Ruhlar Tapınağı — Son normal kat. En güçlü düşmanlar burada.',
    'Tüm canavar türleri burada — stratejik ol.',
    'İksir biriktir, final boss savaşına hazırlan.',
    'Tapınağın altında Taht Salonu var. Dönüşü yok.',
  ],
  10: [
    'Taht Salonu — Kral Mor\'Khan\'ın son sığınağı.',
    'Mor\'Khan minyon çağırır — önce onları temizle.',
    'Kralın charge saldırısından kaç — çok hasar verir.',
    'Mor\'Khan bir zamanlar halkını seven bir kraldı. Şimdi sadece acı var.',
  ],
} as const;

const FLOOR_NAMES: Record<number, string> = {
  1: 'Yıkık Kapılar',
  2: 'Sessiz Sokaklar',
  3: 'Derin Tüneller',
  4: 'Terkedilmiş Pazar',
  5: 'Örümcek Kraliçe\'nin İni',
  6: 'Yıkık Kütüphane',
  7: 'Taş Bahçeler',
  8: 'Lav Nehirleri',
  9: 'Ruhlar Tapınağı',
  10: 'Taht Salonu',
} as const;

/** Metres per floor — the depth counter reads like a descent gauge. */
const METERS_PER_FLOOR = 24;
/** The screen is up for ~2s; the bar finishes just before it lifts. */
const FILL_MS = 1500;
const BAR_BLOCKS = 24;
const TIP_ROTATE_MS = 4200;

type Act = { numeral: string; name: string; tint: string };

const ACT_TINT: Record<number, string> = { 1: '#8b5cf6', 2: '#22d3ee', 3: '#f97316' };

/**
 * The story's three acts, each with its own light. Names come from
 * shared/lore.ts so this screen can't drift from the rest of the game.
 */
function actFor(floor: number | undefined): Act {
  const f = floor ?? 1;
  const act = ACTS.find((a) => a.floors.includes(f)) ?? ACTS[0];
  const numeral = act.roman.replace('Perde ', '');
  return { numeral, name: act.name, tint: f === 10 ? '#ef4444' : ACT_TINT[act.id] ?? '#8b5cf6' };
}

/** Counts from the floor above to this one's depth: "−096m". */
function DepthCounter({ floor, tint }: { floor: number; tint: string }) {
  const from = (floor - 1) * METERS_PER_FLOOR;
  const to = floor * METERS_PER_FLOOR;
  const mv = useMotionValue(from);
  const text = useTransform(mv, (v) => `−${Math.round(v).toString().padStart(3, '0')}m`);
  useEffect(() => {
    if (prefersReducedMotion()) { mv.set(to); return; }
    const c = animate(mv, to, { duration: 1.6, delay: 0.25, ease: EASE_OUT_EXPO });
    return () => c.stop();
  }, [mv, to]);
  return (
    <motion.span className="font-mono tabular-nums" style={{ color: tint }}>
      {text}
    </motion.span>
  );
}

/** Ten ticks down the side, one per floor; the marker slides to this one. */
function DepthRuler({ floor, tint }: { floor: number; tint: string }) {
  return (
    <div className="pointer-events-none absolute left-4 top-1/2 hidden -translate-y-1/2 flex-col gap-3 sm:flex lg:left-8" aria-hidden>
      {Array.from({ length: 10 }).map((_, i) => {
        const f = i + 1;
        const passed = f < floor;
        const here = f === floor;
        return (
          <motion.div
            key={f}
            className="flex items-center gap-2"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 + i * 0.03, duration: 0.5, ease: EASE_OUT_EXPO }}
          >
            <span
              className="block h-[2px] transition-all"
              style={{
                width: here ? 22 : 10,
                background: here ? tint : passed ? `${tint}88` : 'rgba(255,255,255,0.12)',
                boxShadow: here ? `0 0 8px ${tint}` : 'none',
              }}
            />
            <span
              className="font-mono text-[9px] tabular-nums"
              style={{ color: here ? tint : 'rgba(255,255,255,0.2)' }}
            >
              {String(f).padStart(2, '0')}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}

export function LoadingScreen({ message, subMessage, floor }: LoadingScreenProps) {
  const [dotCount, setDotCount] = useState(0);
  const floorTips = floor && GAME_TIPS[floor] ? GAME_TIPS[floor] : GAME_TIPS[0];
  // Random start chosen after mount so server and client agree on first paint.
  const [tipIndex, setTipIndex] = useState(0);
  useEffect(() => {
    setTipIndex(Math.floor(Math.random() * floorTips.length));
    const id = window.setInterval(() => setTipIndex((i) => (i + 1) % floorTips.length), TIP_ROTATE_MS);
    return () => window.clearInterval(id);
  }, [floorTips]);

  useEffect(() => {
    const interval = window.setInterval(() => setDotCount((prev) => (prev + 1) % 4), 380);
    return () => window.clearInterval(interval);
  }, []);

  const dots = '.'.repeat(dotCount);
  const act = actFor(floor);
  const floorName = floor ? FLOOR_NAMES[floor] : undefined;
  const numeral = floor ? String(floor).padStart(2, '0') : '··';
  const tip = floorTips[tipIndex % floorTips.length];

  return (
    <motion.div
      className="fixed inset-0 z-[90] flex flex-col items-center justify-center overflow-hidden bg-[#06070d]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.45, ease: EASE_IN_OUT } }}
      transition={{ duration: 0.3 }}
      role="status"
      aria-live="polite"
    >
      {/* Act light — a slow breathing pool behind the numeral. */}
      <motion.div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[70vmin] w-[70vmin] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[90px]"
        style={{ background: `radial-gradient(circle, ${act.tint}33 0%, transparent 65%)` }}
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: [0.9, 1.08, 0.9], opacity: 1 }}
        transition={{ scale: { duration: 4, repeat: Infinity, ease: 'easeInOut' }, opacity: { duration: 0.8 } }}
      />

      {/* Rising streaks — you are going down. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden style={{ ['--dm-streak' as string]: `${act.tint}55` }}>
        {Array.from({ length: 14 }).map((_, i) => (
          <span
            key={i}
            className="dm-streak"
            style={{
              left: `${(i * 37 + 11) % 100}%`,
              animationDuration: `${1.4 + ((i * 7) % 5) * 0.35}s`,
              animationDelay: `${-((i * 0.29) % 1.6)}s`,
              opacity: 0.25 + ((i * 3) % 4) * 0.12,
            }}
          />
        ))}
      </div>

      <div className="dm-scanlines" aria-hidden />
      <div className="dm-vignette" aria-hidden />

      {floor ? <DepthRuler floor={floor} tint={act.tint} /> : null}

      {/* Top bar — act + depth */}
      <div className="absolute inset-x-4 top-4 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.3em] text-zinc-500 sm:inset-x-8 sm:top-6 sm:text-[10px] lg:text-[11px]">
        <MaskReveal delay={0.1} duration={0.7}>
          <span>
            Perde {act.numeral} <span className="text-zinc-700">/</span>{' '}
            <span style={{ color: act.tint }}>{act.name}</span>
          </span>
        </MaskReveal>
        {floor ? (
          <MaskReveal delay={0.18} duration={0.7}>
            <span className="text-zinc-600">Derinlik </span>
            <DepthCounter floor={floor} tint={act.tint} />
          </MaskReveal>
        ) : null}
      </div>

      {/* Centre stack */}
      <div className="relative z-10 flex w-full max-w-3xl flex-col items-center px-4 text-center">
        {floor ? (
          <MaskReveal delay={0.05} duration={0.6}>
            <span className="font-mono text-[10px] uppercase tracking-[0.5em] text-zinc-400 sm:text-[11px] lg:text-xs">
              Kat
            </span>
          </MaskReveal>
        ) : null}

        {/* Big numeral: an outline ghost sits behind; the solid one rises through a mask. */}
        <div className="relative my-1 leading-none sm:my-2">
          <span
            aria-hidden
            className="dm-outline-text absolute inset-0 translate-x-[0.06em] translate-y-[0.06em] select-none font-pixel text-[min(26vw,34vh,260px)] leading-none"
            style={{ ['--dm-outline' as string]: `${act.tint}66` }}
          >
            {numeral}
          </span>
          <span className="relative block overflow-hidden font-pixel text-[min(26vw,34vh,260px)] leading-none">
            <motion.span
              className="block"
              style={{ color: '#f4f1ea', textShadow: `0 0 40px ${act.tint}66, 0 0 2px ${act.tint}` }}
              initial={{ y: '105%' }}
              animate={{ y: '0%' }}
              transition={{ delay: 0.12, duration: 1.0, ease: EASE_OUT_EXPO }}
            >
              {numeral}
            </motion.span>
          </span>
        </div>

        {floorName ? (
          <h2 className="mt-2 font-pixel text-sm text-white sm:text-lg lg:text-2xl 2xl:text-3xl" style={{ textShadow: `0 0 18px ${act.tint}55` }}>
            <SplitReveal text={floorName} delay={0.35} stagger={0.028} />
          </h2>
        ) : null}

        {/* Hairline that draws outward from the centre. */}
        <motion.div
          className="mt-5 h-px w-40 sm:w-56 lg:w-72"
          style={{ background: `linear-gradient(90deg, transparent, ${act.tint}, transparent)` }}
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ delay: 0.55, duration: 0.9, ease: EASE_OUT_EXPO }}
        />

        {/* Pixel-block progress: each block lights once on its own CSS delay. */}
        <motion.div
          className="mt-6 flex flex-col items-center gap-3"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6, ease: EASE_OUT_EXPO }}
        >
          <div
            className="flex gap-[3px]"
            aria-hidden
            style={{ ['--dm-fill-on' as string]: act.tint }}
          >
            {Array.from({ length: BAR_BLOCKS }).map((_, i) => {
              // Quick at first, settling near the end — the way a real load feels.
              const t = (i + 1) / BAR_BLOCKS;
              const delay = 250 + FILL_MS * Math.pow(t, 1.6);
              return (
                <span
                  key={i}
                  className="dm-fill-block block h-[6px] w-[6px] sm:h-2 sm:w-2"
                  style={{ animationDelay: `${Math.round(delay)}ms` }}
                />
              );
            })}
          </div>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-300 sm:text-[11px] lg:text-xs">
            {message}
            <span className="inline-block w-5 text-left">{dots}</span>
          </p>
          {subMessage && (
            <p className="font-body text-xs text-zinc-500 lg:text-sm">{subMessage}</p>
          )}
        </motion.div>
      </div>

      {/* Tip — crossfades with a little blur so the swap is felt, not seen. */}
      <motion.div
        className="absolute inset-x-4 bottom-6 mx-auto flex max-w-md flex-col items-center gap-2 text-center sm:bottom-10 lg:max-w-lg"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.7, ease: EASE_OUT_EXPO }}
      >
        <span className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.4em] text-dm-gold/80 lg:text-[10px]">
          <span className="block h-[5px] w-[5px] bg-dm-gold" aria-hidden />
          İpucu
        </span>
        <div className="relative grid min-h-[3.2em] w-full place-items-center">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.p
              key={tip}
              className="col-start-1 row-start-1 font-body text-[11px] leading-relaxed text-zinc-400 sm:text-xs lg:text-sm"
              initial={{ opacity: 0, y: 8, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -8, filter: 'blur(6px)' }}
              transition={{ duration: 0.55, ease: EASE_OUT_EXPO }}
            >
              {tip}
            </motion.p>
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}

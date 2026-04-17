'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';

const EASE = [0.22, 1, 0.36, 1] as const;

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

// Pixel particles
const PARTICLE_COUNT = 12;

type Particle = {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
};

function generateParticles(): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 2 + Math.random() * 4,
    duration: 2 + Math.random() * 3,
    delay: Math.random() * 2,
  }));
}

export function LoadingScreen({ message, subMessage, floor }: LoadingScreenProps) {
  const [dotCount, setDotCount] = useState(0);
  const particles = useMemo(generateParticles, []);

  const tip = useMemo(() => {
    const floorTips = floor && GAME_TIPS[floor] ? GAME_TIPS[floor] : GAME_TIPS[0];
    const index = Math.floor(Math.random() * floorTips.length);
    return floorTips[index];
  }, [floor]);

  // Animate dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDotCount((prev) => (prev + 1) % 4);
    }, 400);
    return () => clearInterval(interval);
  }, []);

  const dots = '.'.repeat(dotCount);

  return (
    <motion.div
      className="fixed inset-0 z-[90] flex flex-col items-center justify-center bg-dm-bg"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      {/* Particles */}
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute bg-dm-accent/30"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [0.2, 0.6, 0.2],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}

      {/* Dungeon door animation */}
      <div className="relative mb-8 flex h-28 w-20 items-end justify-center overflow-hidden sm:h-36 sm:w-24 lg:h-44 lg:w-28 2xl:h-52 2xl:w-36">
        {/* Door frame */}
        <div className="absolute inset-0 rounded-t-lg border-4 border-dm-border bg-dm-surface">
          {/* Arch top */}
          <div className="absolute -top-1 left-1/2 h-6 w-14 -translate-x-1/2 rounded-t-full border-4 border-dm-border bg-dm-bg sm:w-16 lg:w-20 2xl:w-24" />
        </div>

        {/* Left door */}
        <motion.div
          className="absolute bottom-0 left-1 top-6 w-[calc(50%-2px)] border-2 border-dm-border bg-dm-bg"
          animate={{ rotateY: [0, -60, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: EASE }}
          style={{ transformOrigin: 'left center' }}
        >
          {/* Hinges (top + bottom, brass-colored circles) */}
          <div className="absolute -left-[3px] top-2 h-2 w-2 rounded-full bg-gradient-to-br from-amber-500 to-amber-800 shadow-[inset_0_-1px_0_rgba(0,0,0,0.4)]" />
          <div className="absolute -left-[3px] bottom-2 h-2 w-2 rounded-full bg-gradient-to-br from-amber-500 to-amber-800 shadow-[inset_0_-1px_0_rgba(0,0,0,0.4)]" />
          {/* Vertical grain lines for wood texture */}
          <div className="absolute inset-y-2 left-1/4 w-px bg-dm-border/50" />
          <div className="absolute inset-y-2 left-1/2 w-px bg-dm-border/40" />
          <div className="absolute inset-y-2 left-3/4 w-px bg-dm-border/50" />
          {/* Door handle */}
          <div className="absolute right-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-dm-gold shadow-[0_0_4px_rgba(245,158,11,0.7)]" />
        </motion.div>

        {/* Right door */}
        <motion.div
          className="absolute bottom-0 right-1 top-6 w-[calc(50%-2px)] border-2 border-dm-border bg-dm-bg"
          animate={{ rotateY: [0, 60, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: EASE }}
          style={{ transformOrigin: 'right center' }}
        >
          {/* Hinges */}
          <div className="absolute -right-[3px] top-2 h-2 w-2 rounded-full bg-gradient-to-bl from-amber-500 to-amber-800 shadow-[inset_0_-1px_0_rgba(0,0,0,0.4)]" />
          <div className="absolute -right-[3px] bottom-2 h-2 w-2 rounded-full bg-gradient-to-bl from-amber-500 to-amber-800 shadow-[inset_0_-1px_0_rgba(0,0,0,0.4)]" />
          {/* Wood grain */}
          <div className="absolute inset-y-2 right-1/4 w-px bg-dm-border/50" />
          <div className="absolute inset-y-2 right-1/2 w-px bg-dm-border/40" />
          <div className="absolute inset-y-2 right-3/4 w-px bg-dm-border/50" />
          {/* Door handle */}
          <div className="absolute left-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-dm-gold shadow-[0_0_4px_rgba(245,158,11,0.7)]" />
        </motion.div>

        {/* Glow behind doors */}
        <motion.div
          className="absolute bottom-0 left-2 right-2 top-8 bg-dm-accent/10"
          animate={{ opacity: [0.05, 0.2, 0.05] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Floor indicator */}
      {floor && (
        <motion.p
          className="glow-gold mb-4 font-pixel text-lg text-dm-gold sm:text-xl lg:text-2xl xl:text-3xl 2xl:text-4xl"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: [0.8, 1.1, 1], opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5, ease: EASE }}
        >
          Kat {floor}
        </motion.p>
      )}
      {floor && FLOOR_NAMES[floor] && (
        <motion.p
          className="mt-1 font-pixel text-[9px] text-dm-accent/80 sm:text-[10px] lg:text-xs xl:text-sm 2xl:text-base"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.4, ease: EASE }}
        >
          {FLOOR_NAMES[floor]}
        </motion.p>
      )}

      {/* Loading text */}
      <p className="font-pixel text-xs text-white sm:text-sm lg:text-base xl:text-lg 2xl:text-xl">
        {message}
        <span className="inline-block w-6 text-left">{dots}</span>
      </p>

      {subMessage && (
        <p className="mt-2 font-body text-xs text-zinc-500 lg:text-sm xl:text-sm 2xl:text-base">{subMessage}</p>
      )}

      {/* Ambient glow behind the door */}
      <motion.div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-dm-accent/[0.06] blur-[100px]"
        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Tip */}
      <div className="mt-8 max-w-xs px-4 text-center sm:max-w-sm lg:max-w-md 2xl:max-w-lg">
        <p className="font-pixel text-[8px] text-dm-gold sm:text-[9px] lg:text-[11px] xl:text-[12px] 2xl:text-[14px]">İpucu</p>
        <p className="mt-2 font-body text-[11px] leading-relaxed text-zinc-400 sm:text-xs lg:text-sm xl:text-base 2xl:text-base">
          {tip}
        </p>
      </div>
    </motion.div>
  );
}

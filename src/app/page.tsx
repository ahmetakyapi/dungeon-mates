'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { PixelButton } from '@/components/ui/PixelButton';
import { PixelInput } from '@/components/ui/PixelInput';
import { PixelHero, HeroParade } from '@/components/game/PixelHero';
import { useSound } from '@/hooks/useSound';
import { CLASS_STATS, type PlayerClass } from '../../shared/types';

const EASE = [0.22, 1, 0.36, 1] as const;

type Mode = 'idle' | 'create' | 'join' | 'multiplayer';

const CLASS_DESCRIPTIONS: Record<PlayerClass, string> = {
  warrior:
    'Ön safta savaşır, yüksek savunma ve can ile düşmanları yakın dövüşte alt eder. Takımın kalkanı.',
  mage:
    'Uzak mesafeden güçlü büyüler savurur. Ateş topu ile alan hasarı verir ama canı düşüktür.',
  archer:
    'Hızlı ve çevik. Uzak mesafeden ok yağdırır, en hızlı saldırı hızına sahiptir.',
} as const;

const STAT_LABELS = [
  { key: 'maxHp', label: 'HP', max: 150, color: '#ef4444' },
  { key: 'attack', label: 'ATK', max: 25, color: '#f59e0b' },
  { key: 'defense', label: 'DEF', max: 15, color: '#3b82f6' },
  { key: 'speed', label: 'HIZ', max: 3, color: '#10b981' },
  { key: 'attackRange', label: 'MNZ', max: 8, color: '#8b5cf6' },
] as const;

const FEATURES = [
  {
    icon: '⚔️',
    title: 'Co-op Macera',
    desc: '2-4 kişi birlikte oyna, birbirinizi destekleyin',
    color: '#ef4444',
  },
  {
    icon: '🗺️',
    title: 'Rastgele Zindanlar',
    desc: 'Her oyunda rastgele üretilen farklı haritalar',
    color: '#3b82f6',
  },
  {
    icon: '🛡️',
    title: '3 Kahraman Sınıfı',
    desc: 'Savaşçı, Büyücü veya Okçu — tarzını seç',
    color: '#8b5cf6',
  },
  {
    icon: '💀',
    title: 'Boss Savaşları',
    desc: 'Her katın sonunda epik patron dövüşleri',
    color: '#f59e0b',
  },
  {
    icon: '💎',
    title: 'Loot & Seviye',
    desc: 'İksirler topla, güçlen, seviye atla',
    color: '#10b981',
  },
  {
    icon: '📱',
    title: 'Mobil Uyumlu',
    desc: 'Dokunmatik kontroller ile her cihazda oyna',
    color: '#06b6d4',
  },
] as const;

const STEPS = [
  {
    num: '01',
    icon: '🚪',
    title: 'Oda Oluştur',
    desc: 'Bir oda oluştur ve 4 haneli kodu arkadaşlarınla paylaş',
  },
  {
    num: '02',
    icon: '🎭',
    title: 'Kahraman Seç',
    desc: 'Üç sınıftan birini seç ve takımını tamamla',
  },
  {
    num: '03',
    icon: '⚔️',
    title: 'Zindana Dal',
    desc: 'Oda oda ilerle, canavarları kes, loot topla',
  },
  {
    num: '04',
    icon: '👑',
    title: "Boss'u Yen",
    desc: 'Zephara\'nın derinliklerindeki yozlaşmış kralı yen',
  },
] as const;

// --- Particles ---
function FloatingParticle({ index }: { index: number }) {
  const style = useMemo(() => {
    const left = `${(index * 17 + 5) % 100}%`;
    const size = 2 + (index % 3) * 2;
    const duration = 10 + (index % 5) * 3;
    const delay = (index * 0.9) % 5;
    const colors = [
      'rgba(139,92,246,0.25)',
      'rgba(245,158,11,0.18)',
      'rgba(16,185,129,0.18)',
    ] as const;
    return { left, size, duration, delay, color: colors[index % 3] };
  }, [index]);

  return (
    <motion.div
      className="absolute rounded-full"
      style={{
        left: style.left,
        width: style.size,
        height: style.size,
        backgroundColor: style.color,
      }}
      initial={{ y: '110vh', opacity: 0 }}
      animate={{
        y: '-10vh',
        opacity: [0, 0.6, 0.6, 0],
      }}
      transition={{
        duration: style.duration,
        delay: style.delay,
        repeat: Infinity,
        ease: 'linear',
      }}
    />
  );
}

// --- Torch ---
function Torch({ side }: { side: 'left' | 'right' }) {
  return (
    <div
      className={`absolute top-1/3 ${side === 'left' ? 'left-4 sm:left-10' : 'right-4 sm:right-10'} z-10`}
    >
      <div className="relative flex flex-col items-center">
        <motion.div
          className="absolute -top-4 h-5 w-3 rounded-full bg-orange-400 sm:-top-5 sm:h-7 sm:w-4"
          animate={{
            scale: [1, 1.3, 0.85, 1.15, 1],
            opacity: [0.8, 1, 0.6, 0.9, 0.8],
          }}
          transition={{ duration: 1.2, repeat: Infinity }}
        />
        <motion.div
          className="absolute -top-6 h-8 w-8 rounded-full bg-orange-400/15 blur-xl sm:-top-8 sm:h-14 sm:w-14"
          animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <div className="h-10 w-1.5 rounded-sm bg-zinc-600 sm:h-14 sm:w-2" />
      </div>
    </div>
  );
}

// --- Dungeon Gate ---
function DungeonGate() {
  return (
    <div className="relative mx-auto h-44 w-52 sm:h-64 sm:w-72 2xl:h-80 2xl:w-[22rem] 4xl:h-96 4xl:w-[28rem]">
      <div className="glass absolute inset-0 rounded-t-2xl">
        {/* Arch */}
        <div className="absolute -top-1.5 left-1/2 h-7 w-32 -translate-x-1/2 rounded-t-xl border border-zinc-600/50 bg-zinc-800 sm:w-44 sm:h-9 2xl:w-52 2xl:h-11 4xl:w-64 4xl:h-14" />
        <div className="absolute -top-0.5 left-1/2 z-10 -translate-x-1/2 text-lg sm:text-xl 2xl:text-2xl 4xl:text-3xl">
          💀
        </div>

        {/* Door opening */}
        <div className="absolute bottom-0 left-1/2 h-3/4 w-3/5 -translate-x-1/2 overflow-hidden rounded-t-sm bg-black/80">
          {/* Left door */}
          <motion.div
            className="absolute left-0 top-0 h-full w-1/2 border-r border-zinc-700/40 bg-zinc-900/90"
            initial={{ x: 0 }}
            animate={{ x: '-75%' }}
            transition={{ duration: 2.5, delay: 1.2, ease: EASE }}
          >
            <div className="absolute right-1.5 top-1/2 h-2.5 w-2.5 rounded-full bg-dm-gold/40" />
          </motion.div>
          {/* Right door */}
          <motion.div
            className="absolute right-0 top-0 h-full w-1/2 border-l border-zinc-700/40 bg-zinc-900/90"
            initial={{ x: 0 }}
            animate={{ x: '75%' }}
            transition={{ duration: 2.5, delay: 1.2, ease: EASE }}
          >
            <div className="absolute left-1.5 top-1/2 h-2.5 w-2.5 rounded-full bg-dm-gold/40" />
          </motion.div>

          {/* Inner glow */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-t from-dm-accent/25 via-dm-accent/8 to-transparent"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.5, delay: 2.2 }}
          />
        </div>
      </div>
    </div>
  );
}

// --- Stat Bar ---
function StatBar({
  label,
  value,
  max,
  color,
  delay,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  delay: number;
}) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="flex items-center gap-2 2xl:gap-3">
      <span className="w-8 font-pixel text-[7px] text-zinc-500 sm:text-[8px] lg:text-[9px] 2xl:text-[10px] 3xl:text-xs 4xl:text-sm 2xl:w-10 4xl:w-14">
        {label}
      </span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800/80 2xl:h-2 4xl:h-2.5">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          whileInView={{ width: `${pct}%` }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.8, delay, ease: EASE }}
        />
      </div>
      <span className="w-5 text-right font-pixel text-[7px] text-zinc-600 sm:text-[8px] lg:text-[9px] 2xl:text-[10px] 3xl:text-xs 4xl:text-sm 2xl:w-7 4xl:w-10">
        {value}
      </span>
    </div>
  );
}

// --- Section heading ---
function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-12 flex flex-col items-center gap-4 sm:mb-16">
      <motion.h2
        className="glow-purple text-center font-pixel text-base text-dm-accent sm:text-xl md:text-2xl 2xl:text-3xl 4xl:text-4xl"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.7, ease: EASE }}
      >
        {children}
      </motion.h2>
      <motion.div
        className="section-divider w-32 2xl:w-48 4xl:w-64"
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.6, delay: 0.15, ease: EASE }}
      />
    </div>
  );
}

// --- Gameplay Demo ---
function GameplayDemo() {
  const GRID_SIZE = 16;
  const [warriorPos, setWarriorPos] = useState({ x: 3, y: 6 });
  const [damageNumbers, setDamageNumbers] = useState<
    { id: number; x: number; y: number; value: number; color: string }[]
  >([]);

  const monsters = useMemo(
    () => [
      { x: 10, y: 4, emoji: '👹', hp: 80 },
      { x: 7, y: 9, emoji: '🦇', hp: 40 },
      { x: 13, y: 7, emoji: '💀', hp: 60 },
    ],
    [],
  );

  const potions = useMemo(
    () => [
      { x: 5, y: 3, emoji: '🧪' },
      { x: 12, y: 10, emoji: '💎' },
    ],
    [],
  );

  // Move warrior around
  useEffect(() => {
    const path = [
      { x: 3, y: 6 },
      { x: 5, y: 6 },
      { x: 5, y: 4 },
      { x: 7, y: 4 },
      { x: 9, y: 4 },
      { x: 10, y: 4 },
      { x: 10, y: 6 },
      { x: 10, y: 8 },
      { x: 7, y: 9 },
      { x: 7, y: 7 },
      { x: 10, y: 7 },
      { x: 13, y: 7 },
      { x: 12, y: 10 },
      { x: 8, y: 8 },
      { x: 5, y: 8 },
      { x: 3, y: 6 },
    ];
    let step = 0;
    const interval = setInterval(() => {
      step = (step + 1) % path.length;
      setWarriorPos(path[step]);
    }, 800);
    return () => clearInterval(interval);
  }, []);

  // Spawn damage numbers when warrior is near a monster
  useEffect(() => {
    const interval = setInterval(() => {
      for (const m of monsters) {
        const dist = Math.abs(warriorPos.x - m.x) + Math.abs(warriorPos.y - m.y);
        if (dist <= 2) {
          const dmg = Math.floor(Math.random() * 15) + 8;
          setDamageNumbers((prev) => [
            ...prev.slice(-6),
            {
              id: Date.now() + Math.random(),
              x: m.x,
              y: m.y,
              value: dmg,
              color: '#ef4444',
            },
          ]);
        }
      }
    }, 900);
    return () => clearInterval(interval);
  }, [warriorPos, monsters]);

  // Clean up old damage numbers
  useEffect(() => {
    const timeout = setInterval(() => {
      setDamageNumbers((prev) =>
        prev.filter((d) => Date.now() - d.id < 1200),
      );
    }, 400);
    return () => clearInterval(timeout);
  }, []);

  const cellSize = 100 / GRID_SIZE;

  return (
    <div className="relative mx-auto w-full max-w-md overflow-hidden rounded-xl border-2 border-dm-border bg-dm-bg 2xl:max-w-lg 4xl:max-w-xl" style={{ aspectRatio: '1' }}>
      {/* Dungeon grid */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            'linear-gradient(rgba(139,92,246,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.3) 1px, transparent 1px)',
          backgroundSize: `${cellSize}% ${cellSize}%`,
        }}
      />

      {/* Floor tiles — subtle dark variation */}
      <div className="absolute inset-0">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-sm bg-zinc-800/30"
            style={{
              left: `${((i * 37 + 10) % 80) + 5}%`,
              top: `${((i * 23 + 15) % 80) + 5}%`,
              width: `${cellSize * 0.7}%`,
              height: `${cellSize * 0.7}%`,
            }}
          />
        ))}
      </div>

      {/* Wall edges top */}
      <div className="absolute left-0 right-0 top-0 h-[6.25%] bg-gradient-to-b from-zinc-700/60 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-[6.25%] bg-gradient-to-t from-zinc-700/60 to-transparent" />
      <div className="absolute bottom-0 left-0 top-0 w-[6.25%] bg-gradient-to-r from-zinc-700/60 to-transparent" />
      <div className="absolute bottom-0 right-0 top-0 w-[6.25%] bg-gradient-to-l from-zinc-700/60 to-transparent" />

      {/* Potions */}
      {potions.map((p, i) => (
        <motion.div
          key={i}
          className="absolute flex items-center justify-center text-xs sm:text-sm 2xl:text-base"
          style={{
            left: `${p.x * cellSize}%`,
            top: `${p.y * cellSize}%`,
            width: `${cellSize}%`,
            height: `${cellSize}%`,
          }}
          animate={{ y: [-1, 1, -1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          {p.emoji}
        </motion.div>
      ))}

      {/* Monsters */}
      {monsters.map((m, i) => (
        <motion.div
          key={i}
          className="absolute flex items-center justify-center text-sm sm:text-base 2xl:text-lg"
          style={{
            left: `${m.x * cellSize}%`,
            top: `${m.y * cellSize}%`,
            width: `${cellSize}%`,
            height: `${cellSize}%`,
          }}
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }}
        >
          {m.emoji}
        </motion.div>
      ))}

      {/* Warrior */}
      <motion.div
        className="absolute z-10 flex items-center justify-center text-sm sm:text-base 2xl:text-lg"
        style={{
          width: `${cellSize}%`,
          height: `${cellSize}%`,
        }}
        animate={{
          left: `${warriorPos.x * cellSize}%`,
          top: `${warriorPos.y * cellSize}%`,
        }}
        transition={{ duration: 0.6, ease: EASE }}
      >
        <div className="relative">
          <span>🗡️</span>
          {/* Warrior glow */}
          <div className="absolute inset-0 rounded-full bg-dm-accent/20 blur-sm" />
        </div>
      </motion.div>

      {/* Damage numbers */}
      <AnimatePresence>
        {damageNumbers.map((d) => (
          <motion.div
            key={d.id}
            className="pointer-events-none absolute z-20 font-pixel text-[8px] font-bold sm:text-[10px] 2xl:text-xs"
            style={{
              left: `${d.x * cellSize + cellSize / 2}%`,
              top: `${d.y * cellSize}%`,
              color: d.color,
            }}
            initial={{ opacity: 1, y: 0, scale: 1.3 }}
            animate={{ opacity: 0, y: -20, scale: 0.8 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
          >
            -{d.value}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* HUD Overlay */}
      <div className="absolute left-2 top-2 z-20 flex flex-col gap-1 sm:left-3 sm:top-3">
        {/* Player HP */}
        <div className="flex items-center gap-1.5 rounded bg-black/60 px-2 py-1 backdrop-blur-sm">
          <span className="font-pixel text-[6px] text-dm-health sm:text-[7px] 2xl:text-[8px]">HP</span>
          <div className="h-1 w-12 overflow-hidden rounded-full bg-zinc-800 sm:w-16 2xl:w-20">
            <motion.div
              className="h-full rounded-full bg-dm-health"
              animate={{ width: ['85%', '70%', '85%'] }}
              transition={{ duration: 4, repeat: Infinity }}
            />
          </div>
        </div>
        {/* Player MP */}
        <div className="flex items-center gap-1.5 rounded bg-black/60 px-2 py-1 backdrop-blur-sm">
          <span className="font-pixel text-[6px] text-dm-mana sm:text-[7px] 2xl:text-[8px]">MP</span>
          <div className="h-1 w-12 overflow-hidden rounded-full bg-zinc-800 sm:w-16 2xl:w-20">
            <motion.div
              className="h-full rounded-full bg-dm-mana"
              animate={{ width: ['60%', '40%', '60%'] }}
              transition={{ duration: 6, repeat: Infinity }}
            />
          </div>
        </div>
      </div>

      {/* Floor info */}
      <div className="absolute right-2 top-2 z-20 rounded bg-black/60 px-2 py-1 backdrop-blur-sm sm:right-3 sm:top-3">
        <span className="font-pixel text-[6px] text-dm-gold sm:text-[7px] 2xl:text-[8px]">KAT 3</span>
      </div>

      {/* Score */}
      <div className="absolute bottom-2 right-2 z-20 rounded bg-black/60 px-2 py-1 backdrop-blur-sm sm:bottom-3 sm:right-3">
        <span className="font-pixel text-[6px] text-dm-xp sm:text-[7px] 2xl:text-[8px]">
          <motion.span
            animate={{ opacity: [1, 0.6, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            SKOR: 2,450
          </motion.span>
        </span>
      </div>

      {/* Minimap */}
      <div className="absolute bottom-2 left-2 z-20 h-10 w-10 rounded border border-dm-border/50 bg-black/60 backdrop-blur-sm sm:bottom-3 sm:left-3 sm:h-12 sm:w-12 2xl:h-14 2xl:w-14">
        <div className="minimap-blink absolute h-1 w-1 rounded-full bg-dm-accent" style={{ left: '30%', top: '50%' }} />
        <div className="minimap-enemy-pulse absolute h-1 w-1 rounded-full bg-dm-health" style={{ left: '60%', top: '35%' }} />
        <div className="minimap-enemy-pulse absolute h-1 w-1 rounded-full bg-dm-health" style={{ left: '45%', top: '70%' }} />
      </div>

      {/* Ambient glow inside */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-dm-accent/[0.03] via-transparent to-dm-gold/[0.02]" />
    </div>
  );
}

// ======================
// MAIN PAGE
// ======================
export default function HomePage() {
  const router = useRouter();
  const sound = useSound();
  const [mode, setMode] = useState<Mode>('idle');
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  const handleCreate = useCallback(() => {
    if (!playerName.trim()) {
      setError('Bir isim gir, kahraman!');
      return;
    }
    setError('');
    router.push(`/game?room=new&name=${encodeURIComponent(playerName.trim())}`);
  }, [playerName, router]);

  const handleJoin = useCallback(() => {
    if (!playerName.trim()) {
      setError('Bir isim gir, kahraman!');
      return;
    }
    if (!roomCode.trim() || roomCode.trim().length !== 4) {
      setError('4 haneli oda kodu gerekli!');
      return;
    }
    setError('');
    router.push(
      `/game?room=${roomCode.trim().toUpperCase()}&name=${encodeURIComponent(playerName.trim())}`,
    );
  }, [playerName, roomCode, router]);

  const handleToggleMute = useCallback(() => {
    const newMuted = sound.toggleMute() ?? false;
    setIsMuted(newMuted);
    sound.playButtonClick();
  }, [sound]);

  const scrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const particles = useMemo(() => Array.from({ length: 20 }, (_, i) => i), []);

  const classEntries = useMemo(
    () =>
      Object.entries(CLASS_STATS) as [PlayerClass, (typeof CLASS_STATS)[PlayerClass]][],
    [],
  );

  return (
    <main className="relative">
      {/* ============ HERO ============ */}
      <section
        ref={heroRef}
        className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4"
      >
        {/* Radial gradient accents */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[10%] top-[8%] h-[500px] w-[500px] rounded-full bg-dm-accent/[0.07] blur-[100px]" />
          <div className="absolute right-[5%] top-[15%] h-[400px] w-[400px] rounded-full bg-dm-gold/[0.04] blur-[80px]" />
          <div className="absolute bottom-[10%] left-[40%] h-[300px] w-[300px] rounded-full bg-dm-xp/[0.03] blur-[80px]" />
        </div>

        {/* Particles */}
        <div className="pointer-events-none absolute inset-0">
          {particles.map((i) => (
            <FloatingParticle key={i} index={i} />
          ))}
        </div>

        {/* Torches */}
        <Torch side="left" />
        <Torch side="right" />

        {/* Content */}
        <motion.div
          className="z-10 flex flex-col items-center"
          style={{ y: heroY, opacity: heroOpacity }}
        >
          {/* Badge */}
          <motion.div
            className="glass mb-6 rounded-full px-4 py-1.5 sm:mb-8 2xl:px-6 2xl:py-2 4xl:px-8 4xl:py-3"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            <span className="font-pixel text-[8px] tracking-wider text-dm-accent/80 sm:text-[10px] lg:text-xs 2xl:text-sm 4xl:text-base">
              SOLO & 2-4 KİŞİ KOOPERATİF
            </span>
          </motion.div>

          {/* Title */}
          <motion.h1
            className="glow-purple-pulse mb-3 text-center font-pixel text-2xl leading-tight text-dm-accent sm:text-4xl md:text-5xl lg:text-6xl 2xl:text-7xl 4xl:text-8xl"
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.9, ease: EASE }}
          >
            DUNGEON MATES
          </motion.h1>

          {/* Subtitle / Tagline */}
          <motion.p
            className="typewriter mb-8 overflow-hidden whitespace-nowrap border-r-2 border-dm-accent/50 font-pixel text-[9px] tracking-wider text-zinc-500 sm:mb-12 sm:text-xs lg:text-sm 2xl:text-base 4xl:text-lg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.3 }}
          >
            Co-op Zindan Macerası
          </motion.p>

          {/* Gate */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.8, ease: EASE }}
          >
            <DungeonGate />
          </motion.div>

          {/* Heroes walking toward the gate */}
          <div className="mt-6 sm:mt-8">
            <HeroParade size="md" />
          </div>

          {/* CTA */}
          <motion.div
            className="mt-8 flex flex-col gap-3 sm:mt-12 sm:flex-row sm:gap-4"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.6, ease: EASE }}
          >
            <PixelButton
              variant="primary"
              onClick={() => scrollTo('hemen-oyna')}
            >
              Maceraya Başla
            </PixelButton>
            <PixelButton
              variant="secondary"
              onClick={() => scrollTo('nasil-oynanir')}
            >
              Nasıl Oynanır?
            </PixelButton>
          </motion.div>
        </motion.div>

        {/* Fog */}
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-32">
          <div className="absolute inset-0 bg-gradient-to-t from-[#04070d] via-[#04070d]/60 to-transparent" />
        </div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-6 left-1/2 z-20 -translate-x-1/2"
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div className="flex flex-col items-center gap-1.5">
            <span className="font-pixel text-[7px] tracking-widest text-zinc-600 sm:text-[8px] lg:text-[9px] 2xl:text-[10px] 4xl:text-xs">
              AŞAĞI KAYDIR
            </span>
            <div className="flex flex-col items-center gap-0.5">
              <div className="h-1 w-1 rounded-full bg-zinc-600" />
              <div className="h-1 w-1 rounded-full bg-zinc-700" />
              <div className="h-1 w-1 rounded-full bg-zinc-800" />
            </div>
          </div>
        </motion.div>
      </section>

      {/* Divider */}
      <div className="section-divider mx-auto w-full max-w-4xl" />

      {/* ============ OYNANIS ONIZLEMESI ============ */}
      <section className="relative px-4 py-20 sm:py-28" id="demo">
        <div className="mx-auto max-w-5xl">
          <SectionHeading>Canlı Oynanış Önizlemesi</SectionHeading>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.7, ease: EASE }}
          >
            {/* Game window frame */}
            <div className="mx-auto max-w-md 2xl:max-w-lg 4xl:max-w-xl">
              {/* Title bar */}
              <div className="flex items-center gap-2 rounded-t-xl border border-b-0 border-dm-border bg-dm-surface/80 px-3 py-2 2xl:px-4 2xl:py-2.5">
                <div className="flex gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-dm-health/60 2xl:h-2.5 2xl:w-2.5" />
                  <div className="h-2 w-2 rounded-full bg-dm-gold/60 2xl:h-2.5 2xl:w-2.5" />
                  <div className="h-2 w-2 rounded-full bg-dm-xp/60 2xl:h-2.5 2xl:w-2.5" />
                </div>
                <span className="font-pixel text-[7px] text-zinc-500 sm:text-[8px] lg:text-[9px] 2xl:text-[10px] 4xl:text-xs">
                  dungeon_mates.exe
                </span>
              </div>

              {/* Game screen */}
              <GameplayDemo />

              {/* Bottom bar */}
              <div className="flex items-center justify-between rounded-b-xl border border-t-0 border-dm-border bg-dm-surface/80 px-3 py-2 2xl:px-4 2xl:py-2.5">
                <span className="font-pixel text-[6px] text-zinc-600 sm:text-[7px] lg:text-[8px] 2xl:text-[9px] 4xl:text-[10px]">
                  60 FPS
                </span>
                <span className="font-pixel text-[6px] text-dm-accent/50 sm:text-[7px] lg:text-[8px] 2xl:text-[9px] 4xl:text-[10px]">
                  OTOMATİK DEMO
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <div className="section-divider mx-auto w-full max-w-4xl" />

      {/* ============ ÖZELLİKLER ============ */}
      <section className="relative px-4 py-20 sm:py-28" id="ozellikler">
        <div className="mx-auto max-w-5xl 4xl:max-w-6xl">
          <SectionHeading>Zindanda Seni Neler Bekliyor?</SectionHeading>

          <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 2xl:gap-6 4xl:gap-8">
            {FEATURES.map((feat, i) => (
              <motion.div
                key={feat.title}
                className="glass group relative overflow-hidden rounded-xl p-4 transition-all hover:border-zinc-600/30 sm:p-6 2xl:p-8 4xl:p-10"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.5, delay: i * 0.08, ease: EASE }}
                whileHover={{ y: -4, scale: 1.02 }}
              >
                {/* Hover glow */}
                <div
                  className="pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                  style={{
                    background: `radial-gradient(circle at 50% 50%, ${feat.color}10 0%, transparent 70%)`,
                  }}
                />

                <div className="relative z-10">
                  <div className="mb-3 text-2xl sm:mb-4 sm:text-3xl 2xl:text-4xl 4xl:text-5xl">
                    {feat.icon}
                  </div>
                  <h3
                    className="mb-1.5 font-pixel text-[9px] sm:text-[11px] lg:text-xs 2xl:text-sm 3xl:text-base 4xl:text-lg"
                    style={{ color: feat.color }}
                  >
                    {feat.title}
                  </h3>
                  <p className="text-[11px] leading-relaxed text-zinc-500 sm:text-xs lg:text-sm 2xl:text-base 4xl:text-lg">
                    {feat.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <div className="section-divider mx-auto w-full max-w-4xl" />

      {/* ============ SINIF TANITIMI ============ */}
      <section className="relative px-4 py-20 sm:py-28" id="siniflar">
        {/* Grid pattern */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(139,92,246,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.5) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        <div className="relative mx-auto max-w-5xl 4xl:max-w-6xl">
          <SectionHeading>Kahramanını Seç</SectionHeading>

          <div className="grid grid-cols-1 gap-5 sm:gap-6 md:grid-cols-3 2xl:gap-8 4xl:gap-10">
            {classEntries.map(([key, stats], i) => (
              <motion.div
                key={key}
                className="glass group relative overflow-hidden rounded-2xl p-5 transition-all sm:p-7 2xl:p-9 4xl:p-12"
                style={{ borderColor: `${stats.color}15` }}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.6, delay: i * 0.12, ease: EASE }}
                whileHover={{ y: -8, scale: 1.02 }}
              >
                {/* Top glow */}
                <div
                  className="pointer-events-none absolute -top-16 left-1/2 h-32 w-32 -translate-x-1/2 rounded-full opacity-15 blur-3xl transition-opacity duration-500 group-hover:opacity-30"
                  style={{ backgroundColor: stats.color }}
                />
                {/* Bottom accent line */}
                <div
                  className="pointer-events-none absolute bottom-0 left-0 right-0 h-[2px] opacity-30 transition-opacity duration-500 group-hover:opacity-70"
                  style={{
                    background: `linear-gradient(90deg, transparent, ${stats.color}, transparent)`,
                  }}
                />

                <div className="relative z-10">
                  <div className="mb-4 flex justify-center">
                    <PixelHero playerClass={key} size="lg" animate glow />
                  </div>
                  <h3
                    className="mb-2 text-center font-pixel text-sm sm:text-base 2xl:text-lg 4xl:text-xl"
                    style={{ color: stats.color }}
                  >
                    {stats.label}
                  </h3>
                  <p className="mb-5 text-center text-xs leading-relaxed text-zinc-500 sm:text-[13px] lg:text-sm 2xl:text-base 4xl:text-lg">
                    {CLASS_DESCRIPTIONS[key]}
                  </p>
                  <div className="flex flex-col gap-1.5 2xl:gap-2">
                    {STAT_LABELS.map((s, si) => (
                      <StatBar
                        key={s.key}
                        label={s.label}
                        value={stats[s.key]}
                        max={s.max}
                        color={s.color}
                        delay={i * 0.12 + si * 0.04}
                      />
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <div className="section-divider mx-auto w-full max-w-4xl" />

      {/* ============ NASIL OYNANIR ============ */}
      <section className="relative px-4 py-20 sm:py-28" id="nasil-oynanir">
        <div className="mx-auto max-w-4xl 4xl:max-w-5xl">
          <SectionHeading>Nasıl Oynanır?</SectionHeading>

          {/* Steps */}
          <div className="relative">
            {/* Connecting line — desktop */}
            <div className="pointer-events-none absolute left-0 right-0 top-10 hidden h-[1px] bg-gradient-to-r from-transparent via-dm-accent/15 to-transparent md:block" />
            {/* Connecting line — mobile */}
            <div className="pointer-events-none absolute bottom-0 left-7 top-0 w-[1px] bg-gradient-to-b from-dm-accent/15 via-dm-accent/10 to-transparent md:hidden" />

            <div className="flex flex-col gap-8 md:flex-row md:gap-5 2xl:gap-8">
              {STEPS.map((step, i) => (
                <motion.div
                  key={step.title}
                  className="relative flex gap-4 md:flex-1 md:flex-col md:items-center md:gap-4"
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ duration: 0.5, delay: i * 0.12, ease: EASE }}
                >
                  {/* Number badge */}
                  <div className="glass relative z-10 flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl md:h-20 md:w-20 md:rounded-2xl 2xl:h-24 2xl:w-24 4xl:h-28 4xl:w-28">
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-lg md:text-2xl 2xl:text-3xl 4xl:text-4xl">{step.icon}</span>
                      <span className="font-pixel text-[7px] text-dm-accent/40 sm:text-[8px] lg:text-[9px] 2xl:text-[10px] 4xl:text-xs">
                        {step.num}
                      </span>
                    </div>
                  </div>

                  <div className="md:text-center">
                    <h3 className="mb-1 font-pixel text-[10px] text-white sm:text-xs lg:text-sm 2xl:text-base 4xl:text-lg">
                      {step.title}
                    </h3>
                    <p className="text-xs leading-relaxed text-zinc-500 sm:text-[13px] lg:text-sm 2xl:text-base 4xl:text-lg">
                      {step.desc}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="section-divider mx-auto w-full max-w-4xl" />

      {/* ============ HEMEN OYNA ============ */}
      <section
        className="relative flex min-h-[70vh] items-center justify-center px-4 py-20 sm:py-28"
        id="hemen-oyna"
      >
        {/* Ambient glow */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-dm-accent/[0.04] blur-[100px]" />
        <div className="pointer-events-none absolute left-[30%] top-[40%] h-[300px] w-[300px] rounded-full bg-dm-gold/[0.03] blur-[80px]" />

        <div className="relative z-10 w-full max-w-lg 2xl:max-w-xl 4xl:max-w-2xl">
          <SectionHeading>Hemen Oyna!</SectionHeading>

          <motion.div
            className="glass-strong overflow-hidden rounded-2xl p-6 sm:p-8 2xl:p-10 4xl:p-14"
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <AnimatePresence mode="wait">
              {mode === 'idle' && (
                <motion.div
                  key="idle"
                  className="flex flex-col gap-4"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3, ease: EASE }}
                >
                  {/* Solo + Multiplayer side by side */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:gap-5">
                    {/* Solo Play */}
                    <motion.button
                      className="group relative cursor-pointer overflow-hidden rounded-xl border-2 border-dm-gold/30 bg-gradient-to-b from-dm-gold/15 to-dm-gold/5 p-5 text-left transition-all hover:border-dm-gold/60 sm:p-6 2xl:p-8 4xl:p-10"
                      onClick={() => router.push('/game?mode=solo&name=Kahraman')}
                      whileHover={{ scale: 1.03, y: -2 }}
                      whileTap={{ scale: 0.97 }}
                    >
                      {/* Glow pulse */}
                      <motion.div
                        className="pointer-events-none absolute inset-0 rounded-xl"
                        style={{ boxShadow: '0 0 30px rgba(245, 158, 11, 0.15)' }}
                        animate={{ opacity: [0.4, 0.8, 0.4] }}
                        transition={{ duration: 2.5, repeat: Infinity }}
                      />

                      <div className="relative z-10">
                        <span className="mb-2 block text-3xl 2xl:text-4xl 4xl:text-5xl">🗡️</span>
                        <h3 className="mb-1 font-pixel text-[11px] text-dm-gold sm:text-xs lg:text-sm 2xl:text-base 4xl:text-lg">
                          Tek Başına Oyna
                        </h3>
                        <p className="text-[10px] leading-relaxed text-zinc-400 sm:text-[11px] lg:text-xs 2xl:text-sm 4xl:text-base">
                          Zindanı tek başına fethet!
                        </p>
                      </div>

                      {/* Solo badge */}
                      <div className="absolute right-2 top-2 rounded bg-dm-gold/20 px-2 py-0.5 2xl:px-3 2xl:py-1">
                        <span className="font-pixel text-[6px] text-dm-gold sm:text-[7px] lg:text-[8px] 2xl:text-[9px] 4xl:text-[10px]">
                          3 CAN
                        </span>
                      </div>
                    </motion.button>

                    {/* Multiplayer */}
                    <motion.button
                      className="group relative cursor-pointer overflow-hidden rounded-xl border-2 border-dm-accent/20 bg-gradient-to-b from-dm-accent/10 to-dm-accent/5 p-5 text-left transition-all hover:border-dm-accent/50 sm:p-6 2xl:p-8 4xl:p-10"
                      onClick={() => setMode('multiplayer')}
                      whileHover={{ scale: 1.03, y: -2 }}
                      whileTap={{ scale: 0.97 }}
                    >
                      <div className="relative z-10">
                        <span className="mb-2 block text-3xl 2xl:text-4xl 4xl:text-5xl">👥</span>
                        <h3 className="mb-1 font-pixel text-[11px] text-dm-accent sm:text-xs lg:text-sm 2xl:text-base 4xl:text-lg">
                          Arkadaşlarınla Oyna
                        </h3>
                        <p className="text-[10px] leading-relaxed text-zinc-400 sm:text-[11px] lg:text-xs 2xl:text-sm 4xl:text-base">
                          2-4 kişi birlikte oynayın
                        </p>
                      </div>

                      {/* Coop badge */}
                      <div className="absolute right-2 top-2 rounded bg-dm-accent/20 px-2 py-0.5 2xl:px-3 2xl:py-1">
                        <span className="font-pixel text-[6px] text-dm-accent sm:text-[7px] lg:text-[8px] 2xl:text-[9px] 4xl:text-[10px]">
                          2-4 KİŞİ
                        </span>
                      </div>
                    </motion.button>
                  </div>
                </motion.div>
              )}

              {mode === 'multiplayer' && (
                <motion.div
                  key="multiplayer"
                  className="flex flex-col gap-3"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3, ease: EASE }}
                >
                  <div className="flex gap-3">
                    <PixelButton
                      variant="primary"
                      fullWidth
                      onClick={() => setMode('create')}
                    >
                      Oda Oluştur
                    </PixelButton>
                    <PixelButton
                      variant="gold"
                      fullWidth
                      onClick={() => setMode('join')}
                    >
                      Odaya Katıl
                    </PixelButton>
                  </div>
                  <PixelButton
                    variant="secondary"
                    onClick={() => { setMode('idle'); setError(''); }}
                  >
                    Geri
                  </PixelButton>
                </motion.div>
              )}

              {mode === 'create' && (
                <motion.div
                  key="create"
                  className="flex flex-col gap-3"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3, ease: EASE }}
                >
                  <PixelInput
                    label="Kahraman Adın"
                    placeholder="İsmini gir..."
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    maxLength={16}
                  />
                  {error && (
                    <p className="font-pixel text-[10px] text-dm-health sm:text-xs lg:text-sm 2xl:text-base">
                      {error}
                    </p>
                  )}
                  <div className="flex gap-3">
                    <PixelButton
                      variant="secondary"
                      onClick={() => { setMode('multiplayer'); setError(''); }}
                    >
                      Geri
                    </PixelButton>
                    <PixelButton
                      variant="primary"
                      fullWidth
                      onClick={handleCreate}
                    >
                      Maceraya Başla!
                    </PixelButton>
                  </div>
                </motion.div>
              )}

              {mode === 'join' && (
                <motion.div
                  key="join"
                  className="flex flex-col gap-3"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3, ease: EASE }}
                >
                  <PixelInput
                    label="Kahraman Adın"
                    placeholder="İsmini gir..."
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    maxLength={16}
                  />
                  <PixelInput
                    label="Oda Kodu"
                    placeholder="XXXX"
                    value={roomCode}
                    onChange={(e) =>
                      setRoomCode(e.target.value.toUpperCase().slice(0, 4))
                    }
                    maxLength={4}
                  />
                  {error && (
                    <p className="font-pixel text-[10px] text-dm-health sm:text-xs lg:text-sm 2xl:text-base">
                      {error}
                    </p>
                  )}
                  <div className="flex gap-3">
                    <PixelButton
                      variant="secondary"
                      onClick={() => { setMode('multiplayer'); setError(''); }}
                    >
                      Geri
                    </PixelButton>
                    <PixelButton
                      variant="gold"
                      fullWidth
                      onClick={handleJoin}
                    >
                      Katıl!
                    </PixelButton>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="relative px-4 py-10 2xl:py-14 4xl:py-20">
        <div className="section-divider mx-auto mb-8 w-full max-w-xs" />

        <div className="flex flex-col items-center gap-2.5">
          <p className="font-pixel text-[8px] tracking-wider text-zinc-600 sm:text-[9px] lg:text-[10px] 2xl:text-xs 4xl:text-sm">
            DUNGEON MATES v0.1
          </p>
          <p className="text-[11px] text-zinc-700 sm:text-xs lg:text-sm 2xl:text-base 4xl:text-lg">
            Next.js + Socket.IO + Canvas ile yapıldı
          </p>
          <a
            href="https://ahmetakyapi.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-dm-accent/40 transition-colors hover:text-dm-accent sm:text-xs lg:text-sm 2xl:text-base 4xl:text-lg"
          >
            ahmetakyapi.com
          </a>

          {/* Mute/Unmute button */}
          <motion.button
            onClick={handleToggleMute}
            className="mt-2 flex h-8 w-8 items-center justify-center rounded-lg border border-dm-border bg-dm-surface/60 text-sm transition-colors hover:border-dm-accent/40 2xl:h-10 2xl:w-10 2xl:text-base 4xl:h-12 4xl:w-12 4xl:text-lg"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            title={isMuted ? 'Sesi Aç' : 'Sessiz'}
          >
            {isMuted ? '🔇' : '🔊'}
          </motion.button>
        </div>
      </footer>
    </main>
  );
}

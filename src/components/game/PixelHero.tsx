'use client';

import { motion } from 'framer-motion';
import type { PlayerClass } from '../../../shared/types';
import { CLASS_STATS } from '../../../shared/types';

const EASE = [0.22, 1, 0.36, 1] as const;

type PixelHeroProps = {
  playerClass: PlayerClass;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  animate?: boolean;
  glow?: boolean;
};

const SIZES = {
  sm: 2,
  md: 3,
  lg: 4,
  xl: 6,
} as const;

const GRID_W = 34;
const GRID_H = 42;

function P({
  x, y, w, h, color, scale, o,
}: {
  x: number; y: number; w: number; h: number; color: string; scale: number; o?: number;
}) {
  return (
    <div
      className="absolute"
      style={{
        left: x * scale,
        top: y * scale,
        width: w * scale,
        height: h * scale,
        backgroundColor: color,
        opacity: o ?? 1,
      }}
    />
  );
}

// ─── WARRIOR ───────────────────────────────────────────────
function WarriorSprite({ scale }: { scale: number }) {
  // Palette
  const skin = '#fcd5b4';
  const skinMid = '#f0c49e';
  const skinShd = '#dea67a';
  const skinHi = '#ffe8d0';
  const hair = '#5c3a1e';

  const steelHi = '#e5e7eb';
  const steel = '#b0b8c4';
  const steelMid = '#8b95a4';
  const steelShd = '#6b7280';
  const steelDk = '#4b5563';

  const red = '#ef4444';
  const redHi = '#f87171';
  const redMid = '#dc2626';
  const redDk = '#991b1b';
  const redDeep = '#7f1d1d';

  const gold = '#fbbf24';
  const goldHi = '#fde68a';
  const goldShd = '#d97706';
  const goldDk = '#b45309';

  const leather = '#78350f';
  const leatherDk = '#5c2d0a';

  const capeOuter = '#b91c1c';
  const capeMid = '#991b1b';
  const capeInner = '#7f1d1d';

  const bootHi = '#57534e';
  const boot = '#44403c';
  const bootDk = '#292524';

  const eye = '#1e293b';
  const eyeWhite = '#e2e8f0';

  return (
    <>
      {/* ── HELMET ── */}
      {/* Plume */}
      <P x={16} y={0} w={3} h={1} color={redHi} scale={scale} />
      <P x={15} y={1} w={5} h={1} color={red} scale={scale} />
      <P x={15} y={2} w={4} h={1} color={redMid} scale={scale} />
      <P x={16} y={1} w={2} h={1} color={redHi} scale={scale} />
      {/* Main helmet */}
      <P x={11} y={2} w={10} h={2} color={steel} scale={scale} />
      <P x={12} y={2} w={8} h={1} color={steelHi} scale={scale} />
      <P x={10} y={4} w={12} h={3} color={steel} scale={scale} />
      <P x={10} y={4} w={1} h={3} color={steelShd} scale={scale} />
      <P x={21} y={4} w={1} h={3} color={steelShd} scale={scale} />
      <P x={11} y={4} w={10} h={1} color={steelHi} scale={scale} />
      {/* Helmet center ridge */}
      <P x={15} y={3} w={2} h={3} color={steelHi} scale={scale} />
      {/* Visor slit */}
      <P x={11} y={7} w={10} h={1} color={steelDk} scale={scale} />
      {/* Nose guard */}
      <P x={15} y={6} w={2} h={2} color={steelMid} scale={scale} />
      {/* Cheek guards */}
      <P x={10} y={7} w={1} h={3} color={steelShd} scale={scale} />
      <P x={21} y={7} w={1} h={3} color={steelShd} scale={scale} />
      <P x={10} y={8} w={2} h={2} color={steelMid} scale={scale} />
      <P x={20} y={8} w={2} h={2} color={steelMid} scale={scale} />

      {/* ── FACE ── */}
      <P x={12} y={8} w={8} h={6} color={skin} scale={scale} />
      <P x={12} y={8} w={8} h={1} color={skinHi} scale={scale} />
      <P x={12} y={8} w={1} h={6} color={skinShd} scale={scale} />
      <P x={19} y={8} w={1} h={6} color={skinShd} scale={scale} />
      <P x={13} y={9} w={6} h={1} color={skinHi} scale={scale} />
      {/* Eyes */}
      <P x={13} y={10} w={2} h={2} color={eyeWhite} scale={scale} />
      <P x={14} y={10} w={1} h={2} color={eye} scale={scale} />
      <P x={17} y={10} w={2} h={2} color={eyeWhite} scale={scale} />
      <P x={18} y={10} w={1} h={2} color={eye} scale={scale} />
      {/* Eyebrows */}
      <P x={13} y={9} w={2} h={1} color={hair} scale={scale} />
      <P x={17} y={9} w={2} h={1} color={hair} scale={scale} />
      {/* Nose */}
      <P x={15} y={11} w={2} h={2} color={skinMid} scale={scale} />
      <P x={16} y={11} w={1} h={1} color={skinHi} scale={scale} />
      {/* Mouth */}
      <P x={14} y={13} w={4} h={1} color={skinShd} scale={scale} />
      <P x={15} y={13} w={2} h={1} color='#c9876b' scale={scale} />
      {/* Stubble */}
      <P x={13} y={12} w={1} h={2} color={skinMid} scale={scale} />
      <P x={18} y={12} w={1} h={2} color={skinMid} scale={scale} />

      {/* ── NECK ── */}
      <P x={14} y={14} w={4} h={2} color={skinShd} scale={scale} />
      <P x={15} y={14} w={2} h={1} color={skin} scale={scale} />

      {/* ── SHOULDER PADS ── */}
      <P x={5} y={14} w={6} h={5} color={steel} scale={scale} />
      <P x={6} y={14} w={5} h={2} color={steelHi} scale={scale} />
      <P x={5} y={14} w={1} h={5} color={steelShd} scale={scale} />
      <P x={10} y={14} w={1} h={3} color={steelShd} scale={scale} />
      <P x={6} y={18} w={4} h={1} color={steelShd} scale={scale} />
      {/* Spike on shoulder */}
      <P x={7} y={13} w={2} h={1} color={steelHi} scale={scale} />

      <P x={21} y={14} w={6} h={5} color={steel} scale={scale} />
      <P x={21} y={14} w={5} h={2} color={steelHi} scale={scale} />
      <P x={26} y={14} w={1} h={5} color={steelShd} scale={scale} />
      <P x={21} y={14} w={1} h={3} color={steelShd} scale={scale} />
      <P x={22} y={18} w={4} h={1} color={steelShd} scale={scale} />
      <P x={23} y={13} w={2} h={1} color={steelHi} scale={scale} />

      {/* ── TORSO ARMOR ── */}
      <P x={11} y={16} w={10} h={10} color={red} scale={scale} />
      <P x={12} y={16} w={8} h={2} color={redHi} scale={scale} />
      <P x={11} y={16} w={1} h={10} color={redDeep} scale={scale} />
      <P x={20} y={16} w={1} h={10} color={redDk} scale={scale} />
      {/* Chest plate */}
      <P x={13} y={18} w={6} h={5} color={redMid} scale={scale} />
      <P x={14} y={18} w={4} h={1} color={red} scale={scale} />
      <P x={14} y={19} w={4} h={3} color={redDk} scale={scale} />
      <P x={15} y={19} w={2} h={1} color={redMid} scale={scale} />
      {/* Gold chest emblem */}
      <P x={15} y={20} w={2} h={2} color={gold} scale={scale} />
      <P x={15} y={20} w={1} h={1} color={goldHi} scale={scale} />
      <P x={16} y={21} w={1} h={1} color={goldShd} scale={scale} />
      {/* Armor rivets */}
      <P x={12} y={18} w={1} h={1} color={goldShd} scale={scale} />
      <P x={19} y={18} w={1} h={1} color={goldShd} scale={scale} />
      <P x={12} y={22} w={1} h={1} color={goldShd} scale={scale} />
      <P x={19} y={22} w={1} h={1} color={goldShd} scale={scale} />

      {/* ── CAPE ── */}
      <P x={10} y={16} w={1} h={14} color={capeOuter} scale={scale} />
      <P x={10} y={20} w={1} h={6} color={capeMid} scale={scale} />
      <P x={21} y={16} w={1} h={14} color={capeInner} scale={scale} />
      <P x={21} y={20} w={1} h={6} color={capeMid} scale={scale} />
      {/* Cape bottom peek */}
      <P x={9} y={28} w={2} h={3} color={capeOuter} scale={scale} />
      <P x={21} y={28} w={2} h={3} color={capeInner} scale={scale} />

      {/* ── BELT ── */}
      <P x={11} y={25} w={10} h={2} color={leather} scale={scale} />
      <P x={11} y={25} w={10} h={1} color={leatherDk} scale={scale} />
      <P x={14} y={25} w={4} h={2} color={gold} scale={scale} />
      <P x={15} y={25} w={2} h={2} color={goldHi} scale={scale} />
      <P x={14} y={26} w={1} h={1} color={goldDk} scale={scale} />
      <P x={17} y={26} w={1} h={1} color={goldDk} scale={scale} />

      {/* ── ARMS ── */}
      <P x={6} y={19} w={4} h={7} color={redMid} scale={scale} />
      <P x={6} y={19} w={1} h={7} color={redDeep} scale={scale} />
      <P x={9} y={19} w={1} h={4} color={redDk} scale={scale} />
      <P x={7} y={19} w={2} h={2} color={red} scale={scale} />
      <P x={22} y={19} w={4} h={7} color={redMid} scale={scale} />
      <P x={25} y={19} w={1} h={7} color={redDeep} scale={scale} />
      <P x={22} y={19} w={1} h={4} color={redDk} scale={scale} />
      <P x={23} y={19} w={2} h={2} color={red} scale={scale} />
      {/* Gauntlets */}
      <P x={5} y={24} w={5} h={3} color={steel} scale={scale} />
      <P x={6} y={24} w={3} h={1} color={steelHi} scale={scale} />
      <P x={5} y={26} w={5} h={1} color={steelShd} scale={scale} />
      <P x={22} y={24} w={5} h={3} color={steel} scale={scale} />
      <P x={23} y={24} w={3} h={1} color={steelHi} scale={scale} />
      <P x={22} y={26} w={5} h={1} color={steelShd} scale={scale} />
      {/* Hands */}
      <P x={5} y={27} w={4} h={2} color={skin} scale={scale} />
      <P x={5} y={27} w={1} h={2} color={skinShd} scale={scale} />
      <P x={23} y={27} w={4} h={2} color={skin} scale={scale} />
      <P x={26} y={27} w={1} h={2} color={skinShd} scale={scale} />

      {/* ── LEGS ── */}
      <P x={11} y={27} w={5} h={7} color={redDk} scale={scale} />
      <P x={11} y={27} w={1} h={7} color={redDeep} scale={scale} />
      <P x={12} y={27} w={3} h={1} color={redMid} scale={scale} />
      <P x={16} y={27} w={5} h={7} color={redDk} scale={scale} />
      <P x={20} y={27} w={1} h={7} color={redDeep} scale={scale} />
      <P x={17} y={27} w={3} h={1} color={redMid} scale={scale} />
      {/* Leg gap */}
      <P x={15} y={28} w={2} h={5} color="transparent" scale={scale} />
      {/* Knee plates */}
      <P x={12} y={30} w={3} h={2} color={steel} scale={scale} />
      <P x={12} y={30} w={3} h={1} color={steelHi} scale={scale} />
      <P x={17} y={30} w={3} h={2} color={steel} scale={scale} />
      <P x={17} y={30} w={3} h={1} color={steelHi} scale={scale} />
      {/* Boots */}
      <P x={10} y={34} w={6} h={4} color={boot} scale={scale} />
      <P x={11} y={34} w={4} h={1} color={bootHi} scale={scale} />
      <P x={10} y={37} w={6} h={1} color={bootDk} scale={scale} />
      <P x={9} y={36} w={2} h={2} color={bootDk} scale={scale} />
      <P x={16} y={34} w={6} h={4} color={boot} scale={scale} />
      <P x={17} y={34} w={4} h={1} color={bootHi} scale={scale} />
      <P x={16} y={37} w={6} h={1} color={bootDk} scale={scale} />
      <P x={21} y={36} w={2} h={2} color={bootDk} scale={scale} />
      {/* Boot steel caps */}
      <P x={10} y={36} w={2} h={1} color={steelShd} scale={scale} />
      <P x={20} y={36} w={2} h={1} color={steelShd} scale={scale} />

      {/* ── SWORD ── */}
      {/* Blade */}
      <P x={28} y={1} w={2} h={2} color={steelHi} scale={scale} />
      <P x={28} y={3} w={3} h={14} color={steel} scale={scale} />
      <P x={28} y={3} w={1} h={14} color={steelHi} scale={scale} />
      <P x={30} y={3} w={1} h={14} color={steelShd} scale={scale} />
      <P x={29} y={3} w={1} h={14} color={steelMid} scale={scale} />
      {/* Blade edge highlight */}
      <P x={28} y={4} w={1} h={6} color="#f0f4f8" scale={scale} />
      {/* Blade tip */}
      <P x={28} y={0} w={2} h={1} color={steelHi} scale={scale} />
      <P x={29} y={0} w={1} h={1} color={steel} scale={scale} />
      {/* Blood groove */}
      <P x={29} y={5} w={1} h={8} color={steelShd} scale={scale} />
      {/* Cross guard */}
      <P x={26} y={17} w={7} h={2} color={gold} scale={scale} />
      <P x={27} y={17} w={5} h={1} color={goldHi} scale={scale} />
      <P x={26} y={18} w={1} h={1} color={goldDk} scale={scale} />
      <P x={32} y={18} w={1} h={1} color={goldDk} scale={scale} />
      {/* Grip */}
      <P x={28} y={19} w={3} h={6} color={leather} scale={scale} />
      <P x={28} y={19} w={1} h={6} color={leatherDk} scale={scale} />
      {/* Grip wrapping */}
      <P x={28} y={20} w={3} h={1} color={goldShd} scale={scale} />
      <P x={28} y={22} w={3} h={1} color={goldShd} scale={scale} />
      <P x={28} y={24} w={3} h={1} color={goldShd} scale={scale} />
      {/* Pommel */}
      <P x={27} y={25} w={5} h={2} color={gold} scale={scale} />
      <P x={28} y={25} w={3} h={1} color={goldHi} scale={scale} />
      <P x={29} y={25} w={1} h={1} color="#fff" scale={scale} o={0.4} />

      {/* ── SHIELD ── */}
      <P x={0} y={14} w={7} h={12} color={red} scale={scale} />
      <P x={1} y={13} w={5} h={1} color={redMid} scale={scale} />
      <P x={1} y={26} w={5} h={1} color={redDk} scale={scale} />
      {/* Shield border */}
      <P x={0} y={14} w={1} h={12} color={redDeep} scale={scale} />
      <P x={6} y={14} w={1} h={12} color={redDk} scale={scale} />
      <P x={0} y={14} w={7} h={1} color={redMid} scale={scale} />
      <P x={0} y={25} w={7} h={1} color={redDeep} scale={scale} />
      {/* Shield rim */}
      <P x={0} y={14} w={7} h={1} color={gold} scale={scale} />
      <P x={0} y={25} w={7} h={1} color={goldDk} scale={scale} />
      <P x={0} y={14} w={1} h={12} color={goldShd} scale={scale} />
      <P x={6} y={14} w={1} h={12} color={goldShd} scale={scale} />
      {/* Shield emblem — cross */}
      <P x={3} y={16} w={1} h={7} color={gold} scale={scale} />
      <P x={1} y={19} w={5} h={1} color={gold} scale={scale} />
      <P x={3} y={17} w={1} h={2} color={goldHi} scale={scale} />
      <P x={2} y={19} w={2} h={1} color={goldHi} scale={scale} />
      {/* Shield highlight */}
      <P x={1} y={15} w={2} h={2} color={redHi} scale={scale} o={0.5} />
    </>
  );
}

// ─── MAGE ──────────────────────────────────────────────────
function MageSprite({ scale }: { scale: number }) {
  const skin = '#fcd5b4';
  const skinMid = '#f0c49e';
  const skinShd = '#dea67a';
  const skinHi = '#ffe8d0';

  const purpleHi = '#a78bfa';
  const purple = '#8b5cf6';
  const purpleMid = '#7c3aed';
  const purpleDk = '#6d28d9';
  const purpleDeep = '#4c1d95';
  const purpleAbyss = '#3b0764';

  const gemHi = '#e9d5ff';
  const gem = '#c4b5fd';
  const gemMid = '#a78bfa';
  const gemDk = '#7c3aed';

  const gold = '#fbbf24';
  const goldHi = '#fde68a';
  const goldShd = '#d97706';

  const staff = '#78350f';
  const staffHi = '#92400e';
  const staffDk = '#5c2d0a';

  const eye = '#a78bfa';
  const eyeGlow = '#c4b5fd';

  return (
    <>
      {/* ── HAT ── */}
      {/* Tip */}
      <P x={16} y={-4} w={1} h={1} color={gemHi} scale={scale} />
      <P x={15} y={-3} w={3} h={1} color={purple} scale={scale} />
      <P x={14} y={-2} w={4} h={1} color={purple} scale={scale} />
      <P x={15} y={-3} w={1} h={1} color={purpleHi} scale={scale} />
      {/* Hat cone */}
      <P x={13} y={-1} w={6} h={2} color={purple} scale={scale} />
      <P x={14} y={-1} w={4} h={1} color={purpleHi} scale={scale} />
      <P x={12} y={1} w={8} h={2} color={purpleMid} scale={scale} />
      <P x={13} y={1} w={6} h={1} color={purple} scale={scale} />
      <P x={11} y={3} w={10} h={2} color={purpleDk} scale={scale} />
      <P x={12} y={3} w={8} h={1} color={purpleMid} scale={scale} />
      {/* Hat star emblem */}
      <P x={15} y={0} w={2} h={2} color={gem} scale={scale} />
      <P x={15} y={0} w={1} h={1} color={gemHi} scale={scale} />
      <P x={16} y={1} w={1} h={1} color={gemDk} scale={scale} />
      {/* Hat brim */}
      <P x={8} y={5} w={16} h={2} color={purpleDeep} scale={scale} />
      <P x={9} y={5} w={14} h={1} color={purpleDk} scale={scale} />
      <P x={8} y={6} w={1} h={1} color={purpleAbyss} scale={scale} />
      <P x={23} y={6} w={1} h={1} color={purpleAbyss} scale={scale} />
      {/* Brim gems */}
      <P x={10} y={5} w={1} h={1} color={gem} scale={scale} />
      <P x={16} y={5} w={1} h={1} color={gem} scale={scale} />
      <P x={21} y={5} w={1} h={1} color={gem} scale={scale} />

      {/* ── FACE ── */}
      <P x={12} y={7} w={8} h={7} color={skin} scale={scale} />
      <P x={12} y={7} w={8} h={1} color={skinHi} scale={scale} />
      <P x={12} y={7} w={1} h={7} color={skinShd} scale={scale} />
      <P x={19} y={7} w={1} h={7} color={skinShd} scale={scale} />
      <P x={13} y={8} w={6} h={1} color={skinHi} scale={scale} />
      {/* Eyes — glowing purple */}
      <P x={13} y={9} w={2} h={2} color={eye} scale={scale} />
      <P x={13} y={9} w={1} h={1} color={eyeGlow} scale={scale} />
      <P x={17} y={9} w={2} h={2} color={eye} scale={scale} />
      <P x={17} y={9} w={1} h={1} color={eyeGlow} scale={scale} />
      {/* Eye glow aura */}
      <P x={12} y={9} w={1} h={2} color={purpleHi} scale={scale} o={0.3} />
      <P x={19} y={9} w={1} h={2} color={purpleHi} scale={scale} o={0.3} />
      {/* Nose */}
      <P x={15} y={10} w={2} h={2} color={skinMid} scale={scale} />
      {/* Beard */}
      <P x={13} y={12} w={6} h={3} color="#d4d0c8" scale={scale} />
      <P x={14} y={12} w={4} h={1} color="#e8e4dc" scale={scale} />
      <P x={14} y={15} w={4} h={1} color="#c4c0b8" scale={scale} />
      <P x={15} y={16} w={2} h={1} color="#b8b4ac" scale={scale} />
      <P x={13} y={13} w={1} h={1} color="#c4c0b8" scale={scale} />
      <P x={18} y={13} w={1} h={1} color="#c4c0b8" scale={scale} />

      {/* ── COLLAR ── */}
      <P x={10} y={14} w={12} h={3} color={purpleDeep} scale={scale} />
      <P x={11} y={14} w={10} h={1} color={purpleDk} scale={scale} />
      <P x={14} y={14} w={4} h={1} color={gem} scale={scale} />
      <P x={15} y={14} w={2} h={1} color={gemHi} scale={scale} />

      {/* ── ROBE BODY ── */}
      <P x={9} y={17} w={14} h={12} color={purple} scale={scale} />
      <P x={9} y={17} w={1} h={12} color={purpleDeep} scale={scale} />
      <P x={22} y={17} w={1} h={12} color={purpleDk} scale={scale} />
      <P x={10} y={17} w={12} h={1} color={purpleHi} scale={scale} />
      {/* Robe center seam */}
      <P x={15} y={18} w={2} h={10} color={purpleDk} scale={scale} />
      <P x={15} y={18} w={1} h={10} color={purpleDeep} scale={scale} />
      {/* Rune patterns */}
      <P x={11} y={20} w={2} h={1} color={gem} scale={scale} />
      <P x={19} y={20} w={2} h={1} color={gem} scale={scale} />
      <P x={12} y={22} w={1} h={2} color={gemMid} scale={scale} />
      <P x={19} y={22} w={1} h={2} color={gemMid} scale={scale} />
      <P x={11} y={25} w={2} h={1} color={gem} scale={scale} />
      <P x={19} y={25} w={2} h={1} color={gem} scale={scale} />
      {/* Rune glow */}
      <P x={11} y={20} w={1} h={1} color={gemHi} scale={scale} o={0.5} />
      <P x={19} y={20} w={1} h={1} color={gemHi} scale={scale} o={0.5} />

      {/* ── SASH ── */}
      <P x={10} y={27} w={12} h={2} color={gold} scale={scale} />
      <P x={11} y={27} w={10} h={1} color={goldHi} scale={scale} />
      <P x={14} y={27} w={4} h={2} color={gem} scale={scale} />
      <P x={15} y={27} w={2} h={1} color={gemHi} scale={scale} />

      {/* ── SLEEVES ── */}
      <P x={5} y={17} w={4} h={8} color={purple} scale={scale} />
      <P x={5} y={17} w={1} h={8} color={purpleDeep} scale={scale} />
      <P x={8} y={17} w={1} h={4} color={purpleDk} scale={scale} />
      <P x={6} y={17} w={2} h={2} color={purpleHi} scale={scale} />
      <P x={23} y={17} w={4} h={8} color={purple} scale={scale} />
      <P x={26} y={17} w={1} h={8} color={purpleDk} scale={scale} />
      <P x={23} y={17} w={1} h={4} color={purpleDeep} scale={scale} />
      <P x={24} y={17} w={2} h={2} color={purpleHi} scale={scale} />
      {/* Sleeve trim */}
      <P x={5} y={23} w={4} h={1} color={gem} scale={scale} />
      <P x={23} y={23} w={4} h={1} color={gem} scale={scale} />
      {/* Hands */}
      <P x={5} y={24} w={4} h={3} color={skin} scale={scale} />
      <P x={5} y={24} w={1} h={3} color={skinShd} scale={scale} />
      <P x={6} y={24} w={2} h={1} color={skinHi} scale={scale} />
      <P x={23} y={24} w={4} h={3} color={skin} scale={scale} />
      <P x={26} y={24} w={1} h={3} color={skinShd} scale={scale} />
      <P x={24} y={24} w={2} h={1} color={skinHi} scale={scale} />

      {/* ── ROBE SKIRT ── */}
      <P x={8} y={29} w={16} h={5} color={purpleDk} scale={scale} />
      <P x={8} y={29} w={1} h={5} color={purpleAbyss} scale={scale} />
      <P x={23} y={29} w={1} h={5} color={purpleAbyss} scale={scale} />
      <P x={9} y={29} w={14} h={1} color={purpleMid} scale={scale} />
      {/* Skirt trim */}
      <P x={8} y={33} w={16} h={1} color={gem} scale={scale} />
      {/* Skirt split */}
      <P x={8} y={34} w={7} h={4} color={purpleDeep} scale={scale} />
      <P x={17} y={34} w={7} h={4} color={purpleDeep} scale={scale} />
      <P x={8} y={37} w={7} h={1} color={purpleAbyss} scale={scale} />
      <P x={17} y={37} w={7} h={1} color={purpleAbyss} scale={scale} />
      {/* Feet */}
      <P x={10} y={38} w={4} h={2} color={purpleAbyss} scale={scale} />
      <P x={18} y={38} w={4} h={2} color={purpleAbyss} scale={scale} />

      {/* ── STAFF ── */}
      <P x={29} y={3} w={2} h={26} color={staff} scale={scale} />
      <P x={29} y={3} w={1} h={26} color={staffHi} scale={scale} />
      <P x={30} y={3} w={1} h={26} color={staffDk} scale={scale} />
      {/* Staff crystal housing */}
      <P x={28} y={0} w={4} h={4} color={gold} scale={scale} />
      <P x={28} y={0} w={4} h={1} color={goldHi} scale={scale} />
      <P x={28} y={3} w={1} h={1} color={goldShd} scale={scale} />
      <P x={31} y={3} w={1} h={1} color={goldShd} scale={scale} />
      {/* Crystal */}
      <P x={28} y={-3} w={4} h={4} color={gem} scale={scale} />
      <P x={28} y={-3} w={2} h={2} color={gemHi} scale={scale} />
      <P x={28} y={-3} w={1} h={1} color="#fff" scale={scale} o={0.6} />
      <P x={31} y={0} w={1} h={1} color={gemDk} scale={scale} />
      <P x={29} y={-4} w={2} h={1} color={gem} scale={scale} />
      {/* Crystal glow */}
      <P x={27} y={-2} w={1} h={2} color={gem} scale={scale} o={0.3} />
      <P x={32} y={-2} w={1} h={2} color={gem} scale={scale} o={0.3} />
      <P x={29} y={-5} w={2} h={1} color={gemHi} scale={scale} o={0.3} />
      {/* Staff rings */}
      <P x={28} y={8} w={4} h={1} color={gold} scale={scale} />
      <P x={28} y={15} w={4} h={1} color={gold} scale={scale} />
      <P x={28} y={22} w={4} h={1} color={gold} scale={scale} />

      {/* ── FLOATING ORB ── */}
      <P x={1} y={13} w={4} h={4} color={gem} scale={scale} />
      <P x={0} y={14} w={1} h={2} color={gemMid} scale={scale} />
      <P x={5} y={14} w={1} h={2} color={gemMid} scale={scale} />
      <P x={2} y={12} w={2} h={1} color={gemMid} scale={scale} />
      <P x={2} y={17} w={2} h={1} color={gemDk} scale={scale} />
      {/* Orb inner light */}
      <P x={1} y={13} w={2} h={2} color={gemHi} scale={scale} />
      <P x={1} y={13} w={1} h={1} color="#fff" scale={scale} o={0.5} />
      <P x={4} y={16} w={1} h={1} color={gemDk} scale={scale} />
      {/* Orb sparkles */}
      <P x={0} y={11} w={1} h={1} color={gemHi} scale={scale} o={0.7} />
      <P x={5} y={11} w={1} h={1} color={gemHi} scale={scale} o={0.5} />
      <P x={3} y={10} w={1} h={1} color="#fff" scale={scale} o={0.4} />
      <P x={-1} y={15} w={1} h={1} color={gemHi} scale={scale} o={0.4} />
      <P x={6} y={13} w={1} h={1} color={gemHi} scale={scale} o={0.3} />
    </>
  );
}

// ─── ARCHER ────────────────────────────────────────────────
function ArcherSprite({ scale }: { scale: number }) {
  const skin = '#fcd5b4';
  const skinMid = '#f0c49e';
  const skinShd = '#dea67a';
  const skinHi = '#ffe8d0';
  const hair = '#8b5e34';

  const greenHi = '#34d399';
  const green = '#10b981';
  const greenMid = '#059669';
  const greenDk = '#047857';
  const greenDeep = '#064e3b';
  const greenAbyss = '#022c22';

  const leather = '#92400e';
  const leatherMid = '#78350f';
  const leatherDk = '#5c2d0a';
  const leatherHi = '#a16207';

  const bow = '#92400e';
  const bowDk = '#78350f';
  const bowHi = '#a16207';
  const stringColor = '#fbbf24';

  const gold = '#fbbf24';
  const goldHi = '#fde68a';
  const goldShd = '#d97706';

  const bootHi = '#57534e';
  const boot = '#44403c';
  const bootDk = '#292524';

  const eye = '#065f46';
  const eyeBright = '#34d399';

  const feather = '#10b981';
  const featherDk = '#059669';
  const featherHi = '#6ee7b7';

  const arrow = '#d1d5db';
  const arrowTip = '#9ca3af';

  return (
    <>
      {/* ── HOOD ── */}
      <P x={13} y={0} w={6} h={2} color={green} scale={scale} />
      <P x={14} y={0} w={4} h={1} color={greenHi} scale={scale} />
      <P x={12} y={2} w={8} h={2} color={green} scale={scale} />
      <P x={13} y={2} w={6} h={1} color={greenHi} scale={scale} />
      <P x={11} y={3} w={10} h={2} color={greenMid} scale={scale} />
      <P x={10} y={4} w={12} h={2} color={greenDk} scale={scale} />
      <P x={10} y={5} w={1} h={1} color={greenDeep} scale={scale} />
      <P x={21} y={5} w={1} h={1} color={greenDeep} scale={scale} />
      {/* Hood shadow inside */}
      <P x={11} y={5} w={10} h={1} color={greenDeep} scale={scale} />
      {/* Feather */}
      <P x={19} y={-2} w={1} h={3} color={feather} scale={scale} />
      <P x={20} y={-3} w={1} h={3} color={featherDk} scale={scale} />
      <P x={20} y={-4} w={1} h={1} color={featherHi} scale={scale} />
      <P x={19} y={-1} w={1} h={1} color={featherHi} scale={scale} />

      {/* ── FACE ── */}
      <P x={12} y={6} w={8} h={7} color={skin} scale={scale} />
      <P x={12} y={6} w={8} h={1} color={skinHi} scale={scale} />
      <P x={12} y={6} w={1} h={7} color={skinShd} scale={scale} />
      <P x={19} y={6} w={1} h={7} color={skinShd} scale={scale} />
      <P x={13} y={7} w={6} h={1} color={skinHi} scale={scale} />
      {/* Hair strands peeking from hood */}
      <P x={11} y={6} w={2} h={2} color={hair} scale={scale} />
      <P x={19} y={6} w={2} h={2} color={hair} scale={scale} />
      {/* Eyes — sharp emerald */}
      <P x={13} y={8} w={2} h={2} color={eye} scale={scale} />
      <P x={13} y={8} w={1} h={1} color={eyeBright} scale={scale} />
      <P x={17} y={8} w={2} h={2} color={eye} scale={scale} />
      <P x={17} y={8} w={1} h={1} color={eyeBright} scale={scale} />
      {/* Nose */}
      <P x={15} y={9} w={2} h={2} color={skinMid} scale={scale} />
      {/* Smirk */}
      <P x={14} y={11} w={4} h={1} color={skinShd} scale={scale} />
      <P x={17} y={11} w={1} h={1} color={skinMid} scale={scale} />
      {/* Mask/bandana across lower face */}
      <P x={12} y={11} w={2} h={2} color={greenDk} scale={scale} />
      <P x={18} y={11} w={2} h={2} color={greenDk} scale={scale} />

      {/* ── NECK ── */}
      <P x={14} y={13} w={4} h={1} color={skinShd} scale={scale} />

      {/* ── CLOAK/CAPE ── */}
      <P x={9} y={13} w={14} h={3} color={greenDk} scale={scale} />
      <P x={10} y={13} w={12} h={1} color={greenMid} scale={scale} />
      <P x={9} y={15} w={1} h={1} color={greenDeep} scale={scale} />
      <P x={22} y={15} w={1} h={1} color={greenDeep} scale={scale} />
      {/* Cloak clasp */}
      <P x={15} y={13} w={2} h={2} color={gold} scale={scale} />
      <P x={15} y={13} w={1} h={1} color={goldHi} scale={scale} />

      {/* ── TUNIC ── */}
      <P x={10} y={16} w={12} h={9} color={green} scale={scale} />
      <P x={10} y={16} w={1} h={9} color={greenDeep} scale={scale} />
      <P x={21} y={16} w={1} h={9} color={greenDk} scale={scale} />
      <P x={11} y={16} w={10} h={1} color={greenHi} scale={scale} />
      {/* Center seam */}
      <P x={15} y={17} w={2} h={7} color={greenDk} scale={scale} />
      {/* Chest lacing */}
      <P x={15} y={17} w={2} h={1} color={leatherMid} scale={scale} />
      <P x={16} y={18} w={1} h={1} color={leatherMid} scale={scale} />
      <P x={15} y={19} w={2} h={1} color={leatherMid} scale={scale} />
      {/* Tunic detail */}
      <P x={12} y={18} w={2} h={1} color={greenDk} scale={scale} />
      <P x={18} y={18} w={2} h={1} color={greenDk} scale={scale} />

      {/* ── QUIVER STRAP ── */}
      <P x={20} y={14} w={1} h={3} color={leatherMid} scale={scale} />
      <P x={19} y={17} w={1} h={3} color={leatherMid} scale={scale} />
      <P x={20} y={20} w={1} h={3} color={leatherMid} scale={scale} />

      {/* ── BELT ── */}
      <P x={10} y={24} w={12} h={2} color={leatherMid} scale={scale} />
      <P x={10} y={24} w={12} h={1} color={leatherDk} scale={scale} />
      <P x={14} y={24} w={4} h={2} color={gold} scale={scale} />
      <P x={15} y={24} w={2} h={1} color={goldHi} scale={scale} />
      {/* Belt pouches */}
      <P x={11} y={25} w={3} h={1} color={leather} scale={scale} />
      <P x={11} y={25} w={1} h={1} color={leatherHi} scale={scale} />
      <P x={18} y={25} w={3} h={1} color={leather} scale={scale} />
      <P x={20} y={25} w={1} h={1} color={leatherHi} scale={scale} />

      {/* ── ARMS ── */}
      <P x={6} y={16} w={4} h={7} color={green} scale={scale} />
      <P x={6} y={16} w={1} h={7} color={greenDeep} scale={scale} />
      <P x={7} y={16} w={2} h={2} color={greenHi} scale={scale} />
      <P x={22} y={16} w={4} h={7} color={green} scale={scale} />
      <P x={25} y={16} w={1} h={7} color={greenDk} scale={scale} />
      <P x={23} y={16} w={2} h={2} color={greenHi} scale={scale} />
      {/* Bracers */}
      <P x={6} y={21} w={4} h={3} color={leather} scale={scale} />
      <P x={6} y={21} w={4} h={1} color={leatherHi} scale={scale} />
      <P x={6} y={23} w={4} h={1} color={leatherDk} scale={scale} />
      {/* Bracer studs */}
      <P x={7} y={22} w={1} h={1} color={gold} scale={scale} />
      <P x={9} y={22} w={1} h={1} color={gold} scale={scale} />
      <P x={22} y={21} w={4} h={3} color={leather} scale={scale} />
      <P x={22} y={21} w={4} h={1} color={leatherHi} scale={scale} />
      <P x={22} y={23} w={4} h={1} color={leatherDk} scale={scale} />
      <P x={23} y={22} w={1} h={1} color={gold} scale={scale} />
      <P x={25} y={22} w={1} h={1} color={gold} scale={scale} />
      {/* Hands */}
      <P x={6} y={24} w={4} h={2} color={skin} scale={scale} />
      <P x={6} y={24} w={1} h={2} color={skinShd} scale={scale} />
      <P x={7} y={24} w={2} h={1} color={skinHi} scale={scale} />
      <P x={22} y={24} w={4} h={2} color={skin} scale={scale} />
      <P x={25} y={24} w={1} h={2} color={skinShd} scale={scale} />
      <P x={23} y={24} w={2} h={1} color={skinHi} scale={scale} />

      {/* ── LEGS ── */}
      <P x={10} y={26} w={5} h={7} color={leatherMid} scale={scale} />
      <P x={10} y={26} w={1} h={7} color={leatherDk} scale={scale} />
      <P x={11} y={26} w={3} h={1} color={leather} scale={scale} />
      <P x={17} y={26} w={5} h={7} color={leatherMid} scale={scale} />
      <P x={21} y={26} w={1} h={7} color={leatherDk} scale={scale} />
      <P x={18} y={26} w={3} h={1} color={leather} scale={scale} />
      {/* Knee pads */}
      <P x={11} y={29} w={3} h={2} color={leather} scale={scale} />
      <P x={11} y={29} w={3} h={1} color={leatherHi} scale={scale} />
      <P x={18} y={29} w={3} h={2} color={leather} scale={scale} />
      <P x={18} y={29} w={3} h={1} color={leatherHi} scale={scale} />
      {/* Leg wraps */}
      <P x={11} y={31} w={3} h={1} color={leatherDk} scale={scale} />
      <P x={18} y={31} w={3} h={1} color={leatherDk} scale={scale} />

      {/* ── BOOTS ── */}
      <P x={9} y={33} w={6} h={5} color={boot} scale={scale} />
      <P x={10} y={33} w={4} h={1} color={bootHi} scale={scale} />
      <P x={9} y={37} w={6} h={1} color={bootDk} scale={scale} />
      <P x={8} y={36} w={2} h={2} color={bootDk} scale={scale} />
      <P x={9} y={33} w={6} h={1} color={leatherDk} scale={scale} />
      <P x={17} y={33} w={6} h={5} color={boot} scale={scale} />
      <P x={18} y={33} w={4} h={1} color={bootHi} scale={scale} />
      <P x={17} y={37} w={6} h={1} color={bootDk} scale={scale} />
      <P x={22} y={36} w={2} h={2} color={bootDk} scale={scale} />
      <P x={17} y={33} w={6} h={1} color={leatherDk} scale={scale} />

      {/* ── BOW ── */}
      <P x={2} y={5} w={2} h={20} color={bow} scale={scale} />
      <P x={2} y={5} w={1} h={20} color={bowHi} scale={scale} />
      <P x={3} y={5} w={1} h={20} color={bowDk} scale={scale} />
      {/* Bow curves top */}
      <P x={1} y={4} w={2} h={2} color={bow} scale={scale} />
      <P x={0} y={5} w={2} h={2} color={bowDk} scale={scale} />
      <P x={0} y={4} w={1} h={1} color={bow} scale={scale} />
      {/* Bow curves bottom */}
      <P x={1} y={24} w={2} h={2} color={bow} scale={scale} />
      <P x={0} y={23} w={2} h={2} color={bowDk} scale={scale} />
      <P x={0} y={25} w={1} h={1} color={bow} scale={scale} />
      {/* Bow tips */}
      <P x={0} y={3} w={1} h={1} color={bowHi} scale={scale} />
      <P x={0} y={26} w={1} h={1} color={bowHi} scale={scale} />
      {/* String */}
      <P x={4} y={4} w={1} h={22} color={stringColor} scale={scale} />
      {/* Grip wrap */}
      <P x={2} y={13} w={2} h={4} color={leatherMid} scale={scale} />
      <P x={2} y={13} w={2} h={1} color={leatherHi} scale={scale} />
      {/* Bow limb decorations */}
      <P x={1} y={8} w={1} h={1} color={gold} scale={scale} />
      <P x={1} y={21} w={1} h={1} color={gold} scale={scale} />

      {/* ── QUIVER ── */}
      <P x={26} y={6} w={4} h={14} color={leatherMid} scale={scale} />
      <P x={26} y={6} w={4} h={1} color={leather} scale={scale} />
      <P x={29} y={6} w={1} h={14} color={leatherDk} scale={scale} />
      <P x={26} y={6} w={1} h={14} color={leatherHi} scale={scale} />
      {/* Quiver rim */}
      <P x={26} y={6} w={4} h={1} color={gold} scale={scale} />
      {/* Arrows */}
      <P x={26} y={3} w={1} h={3} color={arrow} scale={scale} />
      <P x={27} y={4} w={1} h={2} color={arrow} scale={scale} />
      <P x={28} y={3} w={1} h={3} color={arrow} scale={scale} />
      <P x={29} y={4} w={1} h={2} color={arrow} scale={scale} />
      {/* Arrow tips */}
      <P x={26} y={2} w={1} h={1} color={arrowTip} scale={scale} />
      <P x={28} y={2} w={1} h={1} color={arrowTip} scale={scale} />
      {/* Arrow fletching */}
      <P x={26} y={3} w={1} h={1} color={feather} scale={scale} />
      <P x={27} y={4} w={1} h={1} color={featherDk} scale={scale} />
      <P x={28} y={3} w={1} h={1} color={feather} scale={scale} />
      <P x={29} y={4} w={1} h={1} color={featherDk} scale={scale} />
      {/* Quiver strap buckle */}
      <P x={20} y={14} w={1} h={1} color={goldShd} scale={scale} />

      {/* ── CAPE EDGE (behind) ── */}
      <P x={9} y={16} w={1} h={12} color={greenDeep} scale={scale} />
      <P x={22} y={16} w={1} h={12} color={greenAbyss} scale={scale} />
      <P x={9} y={27} w={2} h={3} color={greenDeep} scale={scale} />
      <P x={21} y={27} w={2} h={3} color={greenAbyss} scale={scale} />
    </>
  );
}

// ─── HEALER ───────────────────────────────────────────────
function HealerSprite({ scale }: { scale: number }) {
  const skin = '#fcd5b4';
  const skinMid = '#f0c49e';
  const skinShd = '#dea67a';
  const skinHi = '#ffe8d0';

  const amberHi = '#fde68a';
  const amber = '#f59e0b';
  const amberMid = '#d97706';
  const amberDk = '#b45309';
  const amberDeep = '#92400e';
  const amberAbyss = '#78350f';

  const white = '#fefce8';
  const whiteHi = '#ffffff';
  const whiteMid = '#fef9c3';
  const whiteShd = '#fef3c7';
  const whiteDk = '#fde68a';

  const gold = '#fbbf24';
  const goldHi = '#fde68a';
  const goldShd = '#d97706';
  const goldDk = '#b45309';

  const staff = '#92400e';
  const staffHi = '#a16207';
  const staffDk = '#78350f';

  const crystalHi = '#ffffff';
  const crystal = '#fef3c7';
  const crystalMid = '#fde68a';
  const crystalDk = '#fbbf24';

  const eye = '#92400e';
  const eyeGlow = '#fbbf24';

  const hair = '#f5f0e1';

  return (
    <>
      {/* ── HALO ── */}
      <P x={12} y={-2} w={8} h={1} color={goldHi} scale={scale} o={0.5} />
      <P x={10} y={-1} w={12} h={1} color={gold} scale={scale} o={0.35} />
      <P x={10} y={-1} w={1} h={1} color={goldHi} scale={scale} o={0.25} />
      <P x={21} y={-1} w={1} h={1} color={goldHi} scale={scale} o={0.25} />
      <P x={13} y={-3} w={6} h={1} color={amberHi} scale={scale} o={0.3} />

      {/* ── HOOD/COWL ── */}
      <P x={12} y={0} w={8} h={3} color={white} scale={scale} />
      <P x={13} y={0} w={6} h={1} color={whiteHi} scale={scale} />
      <P x={11} y={2} w={10} h={2} color={whiteMid} scale={scale} />
      <P x={10} y={3} w={12} h={3} color={whiteShd} scale={scale} />
      <P x={10} y={5} w={1} h={1} color={whiteDk} scale={scale} />
      <P x={21} y={5} w={1} h={1} color={whiteDk} scale={scale} />
      {/* Hood inner shadow */}
      <P x={11} y={5} w={10} h={1} color={amberHi} scale={scale} o={0.3} />
      {/* Hood holy gem */}
      <P x={15} y={1} w={2} h={2} color={gold} scale={scale} />
      <P x={15} y={1} w={1} h={1} color={goldHi} scale={scale} />
      <P x={16} y={2} w={1} h={1} color={goldShd} scale={scale} />
      {/* Hood trim */}
      <P x={10} y={5} w={12} h={1} color={gold} scale={scale} />
      <P x={11} y={5} w={10} h={1} color={goldHi} scale={scale} o={0.5} />

      {/* ── FACE ── */}
      <P x={12} y={6} w={8} h={7} color={skin} scale={scale} />
      <P x={12} y={6} w={8} h={1} color={skinHi} scale={scale} />
      <P x={12} y={6} w={1} h={7} color={skinShd} scale={scale} />
      <P x={19} y={6} w={1} h={7} color={skinShd} scale={scale} />
      <P x={13} y={7} w={6} h={1} color={skinHi} scale={scale} />
      {/* Hair strands */}
      <P x={11} y={6} w={2} h={2} color={hair} scale={scale} />
      <P x={19} y={6} w={2} h={2} color={hair} scale={scale} />
      {/* Eyes — warm amber glow */}
      <P x={13} y={8} w={2} h={2} color={eye} scale={scale} />
      <P x={13} y={8} w={1} h={1} color={eyeGlow} scale={scale} />
      <P x={17} y={8} w={2} h={2} color={eye} scale={scale} />
      <P x={17} y={8} w={1} h={1} color={eyeGlow} scale={scale} />
      {/* Eye glow */}
      <P x={12} y={8} w={1} h={2} color={amberHi} scale={scale} o={0.25} />
      <P x={19} y={8} w={1} h={2} color={amberHi} scale={scale} o={0.25} />
      {/* Nose */}
      <P x={15} y={9} w={2} h={2} color={skinMid} scale={scale} />
      <P x={16} y={9} w={1} h={1} color={skinHi} scale={scale} />
      {/* Gentle mouth */}
      <P x={14} y={11} w={4} h={1} color={skinShd} scale={scale} />
      <P x={15} y={11} w={2} h={1} color='#e8a88a' scale={scale} />

      {/* ── NECK ── */}
      <P x={14} y={13} w={4} h={1} color={skinShd} scale={scale} />

      {/* ── COLLAR — ornate gold ── */}
      <P x={10} y={14} w={12} h={3} color={gold} scale={scale} />
      <P x={11} y={14} w={10} h={1} color={goldHi} scale={scale} />
      <P x={10} y={16} w={12} h={1} color={goldShd} scale={scale} />
      {/* Collar gem */}
      <P x={15} y={14} w={2} h={2} color={crystalHi} scale={scale} />
      <P x={15} y={14} w={1} h={1} color={crystalHi} scale={scale} />
      <P x={16} y={15} w={1} h={1} color={crystalMid} scale={scale} />
      {/* Collar wings */}
      <P x={10} y={14} w={2} h={1} color={goldDk} scale={scale} />
      <P x={20} y={14} w={2} h={1} color={goldDk} scale={scale} />

      {/* ── ROBE BODY — white-gold gradient ── */}
      <P x={9} y={17} w={14} h={12} color={white} scale={scale} />
      <P x={9} y={17} w={1} h={12} color={whiteDk} scale={scale} />
      <P x={22} y={17} w={1} h={12} color={whiteDk} scale={scale} />
      <P x={10} y={17} w={12} h={1} color={whiteHi} scale={scale} />
      {/* Robe center seam */}
      <P x={15} y={18} w={2} h={10} color={whiteShd} scale={scale} />
      {/* Holy cross pattern on chest */}
      <P x={15} y={19} w={2} h={4} color={gold} scale={scale} />
      <P x={13} y={20} w={6} h={2} color={gold} scale={scale} />
      <P x={15} y={19} w={1} h={1} color={goldHi} scale={scale} />
      <P x={18} y={20} w={1} h={1} color={goldShd} scale={scale} />
      {/* Holy symbol glint */}
      <P x={14} y={20} w={1} h={1} color={goldHi} scale={scale} o={0.7} />
      {/* Robe side runes */}
      <P x={11} y={21} w={1} h={2} color={amberHi} scale={scale} o={0.4} />
      <P x={20} y={21} w={1} h={2} color={amberHi} scale={scale} o={0.4} />
      <P x={11} y={25} w={1} h={1} color={amberHi} scale={scale} o={0.3} />
      <P x={20} y={25} w={1} h={1} color={amberHi} scale={scale} o={0.3} />

      {/* ── SASH ── */}
      <P x={10} y={27} w={12} h={2} color={amber} scale={scale} />
      <P x={11} y={27} w={10} h={1} color={amberHi} scale={scale} />
      <P x={10} y={28} w={12} h={1} color={amberMid} scale={scale} />
      {/* Sash gem */}
      <P x={14} y={27} w={4} h={2} color={gold} scale={scale} />
      <P x={15} y={27} w={2} h={1} color={goldHi} scale={scale} />

      {/* ── SLEEVES ── */}
      <P x={5} y={17} w={4} h={8} color={white} scale={scale} />
      <P x={5} y={17} w={1} h={8} color={whiteDk} scale={scale} />
      <P x={8} y={17} w={1} h={4} color={whiteShd} scale={scale} />
      <P x={6} y={17} w={2} h={2} color={whiteHi} scale={scale} />
      <P x={23} y={17} w={4} h={8} color={white} scale={scale} />
      <P x={26} y={17} w={1} h={8} color={whiteShd} scale={scale} />
      <P x={23} y={17} w={1} h={4} color={whiteDk} scale={scale} />
      <P x={24} y={17} w={2} h={2} color={whiteHi} scale={scale} />
      {/* Sleeve trim */}
      <P x={5} y={23} w={4} h={1} color={gold} scale={scale} />
      <P x={23} y={23} w={4} h={1} color={gold} scale={scale} />
      {/* Hands */}
      <P x={5} y={24} w={4} h={3} color={skin} scale={scale} />
      <P x={5} y={24} w={1} h={3} color={skinShd} scale={scale} />
      <P x={6} y={24} w={2} h={1} color={skinHi} scale={scale} />
      <P x={23} y={24} w={4} h={3} color={skin} scale={scale} />
      <P x={26} y={24} w={1} h={3} color={skinShd} scale={scale} />
      <P x={24} y={24} w={2} h={1} color={skinHi} scale={scale} />

      {/* ── ROBE SKIRT ── */}
      <P x={8} y={29} w={16} h={5} color={whiteShd} scale={scale} />
      <P x={8} y={29} w={1} h={5} color={whiteDk} scale={scale} />
      <P x={23} y={29} w={1} h={5} color={whiteDk} scale={scale} />
      <P x={9} y={29} w={14} h={1} color={white} scale={scale} />
      {/* Skirt trim */}
      <P x={8} y={33} w={16} h={1} color={gold} scale={scale} />
      {/* Skirt folds */}
      <P x={8} y={34} w={7} h={4} color={whiteDk} scale={scale} />
      <P x={17} y={34} w={7} h={4} color={whiteDk} scale={scale} />
      <P x={8} y={37} w={7} h={1} color={amberHi} scale={scale} o={0.3} />
      <P x={17} y={37} w={7} h={1} color={amberHi} scale={scale} o={0.3} />
      {/* Feet */}
      <P x={10} y={38} w={4} h={2} color={amberDeep} scale={scale} />
      <P x={18} y={38} w={4} h={2} color={amberDeep} scale={scale} />
      <P x={11} y={38} w={2} h={1} color={amberDk} scale={scale} />
      <P x={19} y={38} w={2} h={1} color={amberDk} scale={scale} />

      {/* ── HEALING STAFF ── */}
      <P x={29} y={5} w={2} h={24} color={staff} scale={scale} />
      <P x={29} y={5} w={1} h={24} color={staffHi} scale={scale} />
      <P x={30} y={5} w={1} h={24} color={staffDk} scale={scale} />
      {/* Staff cross-piece */}
      <P x={26} y={2} w={8} h={2} color={gold} scale={scale} />
      <P x={26} y={2} w={8} h={1} color={goldHi} scale={scale} />
      <P x={26} y={3} w={1} h={1} color={goldShd} scale={scale} />
      <P x={33} y={3} w={1} h={1} color={goldShd} scale={scale} />
      {/* Staff vertical top */}
      <P x={29} y={-2} w={2} h={7} color={gold} scale={scale} />
      <P x={29} y={-2} w={1} h={2} color={goldHi} scale={scale} />
      {/* Holy crystal at top */}
      <P x={28} y={-5} w={4} h={4} color={crystal} scale={scale} />
      <P x={28} y={-5} w={2} h={2} color={crystalHi} scale={scale} />
      <P x={28} y={-5} w={1} h={1} color={whiteHi} scale={scale} o={0.8} />
      <P x={31} y={-2} w={1} h={1} color={crystalDk} scale={scale} />
      <P x={29} y={-6} w={2} h={1} color={crystal} scale={scale} />
      {/* Crystal glow rays */}
      <P x={27} y={-4} w={1} h={2} color={crystalMid} scale={scale} o={0.35} />
      <P x={32} y={-4} w={1} h={2} color={crystalMid} scale={scale} o={0.35} />
      <P x={29} y={-7} w={2} h={1} color={crystalHi} scale={scale} o={0.3} />
      <P x={29} y={-1} w={2} h={1} color={crystalMid} scale={scale} o={0.2} />
      {/* Staff rings */}
      <P x={28} y={10} w={4} h={1} color={gold} scale={scale} />
      <P x={28} y={17} w={4} h={1} color={gold} scale={scale} />
      <P x={28} y={24} w={4} h={1} color={gold} scale={scale} />

      {/* ── FLOATING HEAL ORB ── */}
      <P x={1} y={12} w={4} h={4} color={crystalMid} scale={scale} />
      <P x={0} y={13} w={1} h={2} color={crystalDk} scale={scale} />
      <P x={5} y={13} w={1} h={2} color={crystalDk} scale={scale} />
      <P x={2} y={11} w={2} h={1} color={crystalDk} scale={scale} />
      <P x={2} y={16} w={2} h={1} color={amberMid} scale={scale} />
      {/* Orb inner light — cross shape */}
      <P x={2} y={13} w={2} h={1} color={crystalHi} scale={scale} />
      <P x={2} y={12} w={1} h={3} color={crystalHi} scale={scale} />
      <P x={1} y={12} w={1} h={1} color={whiteHi} scale={scale} o={0.6} />
      <P x={4} y={15} w={1} h={1} color={crystalDk} scale={scale} />
      {/* Orb sparkles */}
      <P x={0} y={10} w={1} h={1} color={crystalHi} scale={scale} o={0.6} />
      <P x={5} y={10} w={1} h={1} color={crystalHi} scale={scale} o={0.4} />
      <P x={3} y={9} w={1} h={1} color={whiteHi} scale={scale} o={0.3} />
      <P x={-1} y={14} w={1} h={1} color={crystalMid} scale={scale} o={0.35} />
      <P x={6} y={12} w={1} h={1} color={crystalMid} scale={scale} o={0.25} />

      {/* ── HOLY AURA PARTICLES ── */}
      <P x={7} y={3} w={1} h={1} color={goldHi} scale={scale} o={0.3} />
      <P x={24} y={5} w={1} h={1} color={goldHi} scale={scale} o={0.25} />
      <P x={5} y={30} w={1} h={1} color={amberHi} scale={scale} o={0.2} />
      <P x={26} y={32} w={1} h={1} color={amberHi} scale={scale} o={0.2} />
    </>
  );
}

export function PixelHero({ playerClass, size = 'md', animate = true, glow = true }: PixelHeroProps) {
  const scale = SIZES[size];
  const stats = CLASS_STATS[playerClass];
  const totalW = GRID_W * scale;
  const totalH = GRID_H * scale;

  const spriteContent = (
    <div className="relative" style={{ width: totalW, height: totalH }}>
      {playerClass === 'warrior' && <WarriorSprite scale={scale} />}
      {playerClass === 'mage' && <MageSprite scale={scale} />}
      {playerClass === 'archer' && <ArcherSprite scale={scale} />}
      {playerClass === 'healer' && <HealerSprite scale={scale} />}
    </div>
  );

  return (
    <div className="relative flex items-center justify-center">
      {/* Multi-layer glow */}
      {glow && (
        <>
          <motion.div
            className="absolute rounded-full blur-3xl"
            style={{
              width: totalW * 2,
              height: totalH * 1.5,
              backgroundColor: `${stats.color}15`,
            }}
            animate={animate ? { scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] } : undefined}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute rounded-full blur-xl"
            style={{
              width: totalW * 1.3,
              height: totalH * 1,
              backgroundColor: `${stats.color}20`,
            }}
            animate={animate ? { scale: [1, 1.15, 1], opacity: [0.4, 0.7, 0.4] } : undefined}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          />
        </>
      )}

      {/* Floating animation */}
      {animate ? (
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          {spriteContent}
        </motion.div>
      ) : (
        spriteContent
      )}

      {/* Shadow */}
      <motion.div
        className="absolute rounded-full bg-black/25 blur-md"
        style={{
          bottom: -scale * 3,
          width: totalW * 0.45,
          height: scale * 3,
        }}
        animate={animate ? { scaleX: [1, 0.8, 1], opacity: [0.5, 0.3, 0.5] } : undefined}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

export function HeroParade({ size = 'lg' }: { size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const classes: PlayerClass[] = ['warrior', 'mage', 'archer', 'healer'];

  return (
    <div className="flex items-end justify-center gap-8 sm:gap-14">
      {classes.map((cls, i) => (
        <motion.div
          key={cls}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 + i * 0.15, duration: 0.7, ease: EASE }}
        >
          <PixelHero playerClass={cls} size={size} />
        </motion.div>
      ))}
    </div>
  );
}

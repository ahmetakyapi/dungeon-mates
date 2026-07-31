// ==========================================
// Dungeon Mates — Saldırı Anatomisi
//
// Her saldırı üç fazdan oluşur: anticipation (windup) → active → recovery.
//   windup   : oyuncuya "geliyor" sinyali. Canavar hareketini keser ve telegraf
//              gösterir. Süresi ≈ insan tepki süresi (~250ms) + kaçınma aksiyonu
//              süresi + zorluk tamponu.
//   active   : hasarın çözüldüğü kısa an. Hasar KARAR anında değil ÇÖZÜM anında
//              hesaplanır — oyuncunun windup sırasında kaçması bu yüzden işe yarar.
//   recovery : canavarın açık kaldığı, oyuncuya karşı-atak penceresi veren süre.
//
// Referans: https://gdkeys.com/keys-to-combat-design-1-anatomy-of-an-attack/
// ==========================================

import type { MonsterType } from './monsters';
import { TICK_RATE } from './constants';

/** Telegraf şekli — sayı olarak kodlanır ki her tick nesne allocate edilmesin. */
export const TELEGRAPH_NONE = 0;
export const TELEGRAPH_CIRCLE = 1;
export const TELEGRAPH_CONE = 2;
export const TELEGRAPH_LINE = 3;

export type TelegraphKind =
  | typeof TELEGRAPH_NONE
  | typeof TELEGRAPH_CIRCLE
  | typeof TELEGRAPH_CONE
  | typeof TELEGRAPH_LINE;

export type AttackPhase = 'idle' | 'windup' | 'active' | 'recovery';

export type AttackProfile = {
  /** Hazırlık süresi (tick). Ne kadar uzunsa o kadar okunabilir/kaçınılabilir. */
  windupTicks: number;
  /** Hasarın çözüldüğü pencere (tick). Kısa ve net olmalı. */
  activeTicks: number;
  /** Toparlanma — oyuncunun karşı-atak penceresi (tick). */
  recoveryTicks: number;
  /** Saldırı sonrası bekleme (tick). */
  cooldownTicks: number;
  /** Menzil (tile) — bu mesafede saldırı başlatılır. */
  range: number;
  /** Telegraf şekli. */
  telegraph: TelegraphKind;
  /** Koni yarı-açısı (radyan) veya çizgi yarı-genişliği (tile). */
  arc: number;
  /**
   * Windup sırasında saldırıyı iptal etmek için gereken hasar.
   * 0 = kesintiye uğramaz (boss'lar). Yüksek = zor kesilir.
   */
  poise: number;
  /** Windup sırasındaki hareket çarpanı (0 = tam durur). */
  windupMoveMult: number;
};

const t = (seconds: number): number => Math.max(1, Math.round(seconds * TICK_RATE));

// Arketipler — canavarlar bunlardan türer.
const SWIFT: AttackProfile = {
  // Hızlı-zayıf: kısa hazırlık, telegraf yok, sık vurur. Tehdidi sayıdan gelir.
  windupTicks: t(0.25), activeTicks: t(0.1), recoveryTicks: t(0.2),
  cooldownTicks: t(0.7), range: 1.2, telegraph: TELEGRAPH_NONE, arc: 0,
  poise: 6, windupMoveMult: 0.35,
};

const STANDARD: AttackProfile = {
  // Dengeli: görülebilir hazırlık, dar koni telegrafı.
  windupTicks: t(0.4), activeTicks: t(0.15), recoveryTicks: t(0.35),
  cooldownTicks: t(0.9), range: 1.4, telegraph: TELEGRAPH_CONE, arc: Math.PI / 5,
  poise: 14, windupMoveMult: 0,
};

const HEAVY: AttackProfile = {
  // Ağır-güçlü: uzun hazırlık, geniş telegraf, uzun toparlanma.
  // Kaçınması kolay ama yakalanırsan çok acıtır — klasik risk/ödül.
  windupTicks: t(0.65), activeTicks: t(0.2), recoveryTicks: t(0.7),
  cooldownTicks: t(1.4), range: 1.8, telegraph: TELEGRAPH_CIRCLE, arc: 0,
  poise: 30, windupMoveMult: 0,
};

const CASTER: AttackProfile = {
  // Menzilli: uzaktan mermi atar, çizgi telegrafı ile nişan aldığını gösterir.
  windupTicks: t(0.55), activeTicks: t(0.1), recoveryTicks: t(0.5),
  cooldownTicks: t(1.6), range: 6.5, telegraph: TELEGRAPH_LINE, arc: 0.45,
  poise: 10, windupMoveMult: 0,
};

const BOSS_MELEE: AttackProfile = {
  // Boss temas saldırısı — kesilemez ama telegrafı net.
  windupTicks: t(0.5), activeTicks: t(0.15), recoveryTicks: t(0.45),
  cooldownTicks: t(0.9), range: 2.0, telegraph: TELEGRAPH_CONE, arc: Math.PI / 4,
  poise: 0, windupMoveMult: 0,
};

export const ATTACK_PROFILES: Record<MonsterType, AttackProfile> = {
  rat: SWIFT,
  bat: SWIFT,
  slime: { ...SWIFT, windupTicks: t(0.35), cooldownTicks: t(1.0) },
  spider: STANDARD,
  skeleton: STANDARD,
  goblin: STANDARD,
  wraith: { ...STANDARD, windupTicks: t(0.3), cooldownTicks: t(0.8) },
  mushroom: { ...HEAVY, range: 1.5 },
  // Menzilli — taş fırlatır
  gargoyle: CASTER,
  // Menzilli — ruh oku
  phantom: { ...CASTER, windupTicks: t(0.45), cooldownTicks: t(1.3), range: 7 },
  lava_slime: { ...HEAVY, range: 1.6 },
  dark_knight: HEAVY,
  boss_forge_guardian: BOSS_MELEE,
  boss_spider_queen: BOSS_MELEE,
  boss_stone_warden: { ...BOSS_MELEE, windupTicks: t(0.6), recoveryTicks: t(0.6) },
  boss_flame_knight: { ...BOSS_MELEE, windupTicks: t(0.4), cooldownTicks: t(0.75) },
  boss_demon: BOSS_MELEE,
};

/** Bu canavar mermi mi atıyor yoksa temas mı ediyor? */
export const RANGED_MONSTERS: ReadonlySet<MonsterType> = new Set<MonsterType>([
  'gargoyle',
  'phantom',
]);

/** Boss özel yeteneklerinin telegraf süresi — normal saldırılardan uzun. */
export const BOSS_ABILITY_WINDUP_TICKS = t(0.9);

/** Windup sırasında alınan hasar sonrası sersemleme süresi. */
export const STAGGER_TICKS = t(0.5);

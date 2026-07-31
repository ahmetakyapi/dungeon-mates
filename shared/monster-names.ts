// ==========================================
// Dungeon Mates — Monster Display Names
// Tek kaynak: kill feed, boss barı, ölüm özeti ve run raporu buradan okur.
// Önceden üç ayrı tablo vardı (XP→isim, HP→isim tahmini, boss tipi→isim) ve
// üçü de birbirinden bağımsız drift ediyordu.
// ==========================================

import type { MonsterType } from './monsters';

export type MonsterDisplay = { name: string; emoji: string };

export const MONSTER_NAMES: Record<MonsterType, MonsterDisplay> = {
  rat: { name: 'Sıçan', emoji: '🐀' },
  slime: { name: 'Balçık', emoji: '🟢' },
  bat: { name: 'Yarasa', emoji: '🦇' },
  spider: { name: 'Örümcek', emoji: '🕷️' },
  skeleton: { name: 'İskelet', emoji: '💀' },
  mushroom: { name: 'Zehirli Mantar', emoji: '🍄' },
  goblin: { name: 'Goblin', emoji: '👺' },
  wraith: { name: 'Hayalet', emoji: '👻' },
  lava_slime: { name: 'Lav Balçığı', emoji: '🔥' },
  gargoyle: { name: 'Gargoyle', emoji: '🗿' },
  phantom: { name: 'Fantom', emoji: '🌫️' },
  dark_knight: { name: 'Kara Şövalye', emoji: '⚔️' },
  boss_forge_guardian: { name: 'Ocak Muhafızı', emoji: '🔨' },
  boss_spider_queen: { name: 'Örümcek Kraliçe', emoji: '🕸️' },
  boss_stone_warden: { name: 'Taş Muhafız', emoji: '🗿' },
  boss_flame_knight: { name: 'Alev Şövalyesi', emoji: '🔥' },
  boss_demon: { name: "Kral Mor'Khan", emoji: '👹' },
} as const;

const FALLBACK: MonsterDisplay = { name: 'Canavar', emoji: '💀' };

export function monsterDisplay(type: string): MonsterDisplay {
  return MONSTER_NAMES[type as MonsterType] ?? FALLBACK;
}

export function isBossType(type: string): boolean {
  return type.startsWith('boss_');
}

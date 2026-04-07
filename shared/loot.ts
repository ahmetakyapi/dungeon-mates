// ==========================================
// Dungeon Mates — Loot System
// ==========================================

export type LootType = 'health_potion' | 'mana_potion' | 'damage_boost' | 'speed_boost' | 'gold';

// Loot tablosu
export const LOOT_TABLE: Record<LootType, { chance: number; value: number; label: string; color: string }> = {
  health_potion: { chance: 0.14, value: 20, label: 'Can İksiri', color: '#ef4444' },
  mana_potion: { chance: 0.10, value: 15, label: 'Mana İksiri', color: '#3b82f6' },
  damage_boost: { chance: 0.03, value: 4, label: 'Güç Artışı', color: '#f59e0b' },
  speed_boost: { chance: 0.04, value: 0.2, label: 'Hız Artışı', color: '#06b6d4' },
  gold: { chance: 0.22, value: 8, label: 'Altın', color: '#eab308' },
} as const;

// Gold değeri kat bazlı: 5 + floor * 2
export function goldValueForFloor(floor: number): number {
  return 5 + floor * 2;
}

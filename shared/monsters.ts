// ==========================================
// Dungeon Mates — Monster Types & Stats
// ==========================================

export type MonsterType = 'skeleton' | 'slime' | 'bat' | 'goblin' | 'rat' | 'spider' | 'wraith' | 'mushroom' | 'gargoyle' | 'dark_knight' | 'phantom' | 'lava_slime' | 'boss_spider_queen' | 'boss_demon' | 'boss_forge_guardian' | 'boss_stone_warden' | 'boss_flame_knight';

// --- Monster İstatistikleri ---
export const MONSTER_STATS: Record<MonsterType, {
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  xp: number;
  color: string;
  size: number;
}> = {
  skeleton: { hp: 65, attack: 18, defense: 5, speed: 1.7, xp: 10, color: '#d1d5db', size: 1 },
  slime: { hp: 45, attack: 10, defense: 2, speed: 1.0, xp: 5, color: '#4ade80', size: 0.8 },
  bat: { hp: 35, attack: 12, defense: 1, speed: 2.8, xp: 7, color: '#a78bfa', size: 0.6 },
  goblin: { hp: 80, attack: 22, defense: 7, speed: 2.0, xp: 15, color: '#84cc16', size: 0.9 },
  rat: { hp: 28, attack: 9, defense: 1, speed: 2.4, xp: 3, color: '#78716c', size: 0.5 },
  spider: { hp: 55, attack: 16, defense: 5, speed: 1.2, xp: 8, color: '#581c87', size: 0.8 },
  wraith: { hp: 75, attack: 28, defense: 4, speed: 2.4, xp: 15, color: '#a5f3fc', size: 1.0 },
  mushroom: { hp: 90, attack: 20, defense: 12, speed: 0.8, xp: 12, color: '#f472b6', size: 0.9 },
  gargoyle: { hp: 110, attack: 26, defense: 14, speed: 1.6, xp: 20, color: '#6b7280', size: 1.2 },
  dark_knight: { hp: 160, attack: 35, defense: 18, speed: 1.8, xp: 30, color: '#1e293b', size: 1.3 },
  phantom: { hp: 85, attack: 32, defense: 5, speed: 2.7, xp: 25, color: '#c4b5fd', size: 1.0 },
  lava_slime: { hp: 95, attack: 24, defense: 10, speed: 1.2, xp: 18, color: '#f97316', size: 1.0 },
  boss_forge_guardian: { hp: 1200, attack: 45, defense: 18, speed: 1.2, xp: 100, color: '#f97316', size: 1.8 },
  boss_spider_queen: { hp: 2000, attack: 55, defense: 18, speed: 1.5, xp: 150, color: '#7c3aed', size: 2.2 },
  boss_stone_warden: { hp: 1600, attack: 40, defense: 30, speed: 1.0, xp: 120, color: '#6b7280', size: 2.0 },
  boss_flame_knight: { hp: 1800, attack: 65, defense: 16, speed: 2.4, xp: 140, color: '#b91c1c', size: 1.6 },
  boss_demon: { hp: 3500, attack: 80, defense: 25, speed: 1.8, xp: 300, color: '#dc2626', size: 2.5 },
} as const;

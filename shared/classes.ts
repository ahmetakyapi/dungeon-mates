// ==========================================
// Dungeon Mates — Player Classes
// ==========================================

export type PlayerClass = 'warrior' | 'mage' | 'archer' | 'healer';

// --- Sınıf İstatistikleri ---
export const CLASS_STATS: Record<PlayerClass, {
  maxHp: number;
  maxMana: number;
  attack: number;
  defense: number;
  speed: number;
  attackRange: number;
  attackCooldown: number;
  color: string;
  label: string;
  emoji: string;
}> = {
  warrior: {
    maxHp: 120,
    maxMana: 30,
    attack: 18,
    defense: 10,
    speed: 2.2,
    attackRange: 1.5,
    attackCooldown: 500,
    color: '#ef4444',
    label: 'Savaşçı',
    emoji: '⚔️',
  },
  mage: {
    maxHp: 70,
    maxMana: 100,
    attack: 20,
    defense: 3,
    speed: 2.0,
    attackRange: 5,
    attackCooldown: 800,
    color: '#8b5cf6',
    label: 'Büyücü',
    emoji: '🔮',
  },
  archer: {
    maxHp: 90,
    maxMana: 50,
    attack: 12,
    defense: 5,
    speed: 2.8,
    attackRange: 6,
    attackCooldown: 400,
    color: '#10b981',
    label: 'Okçu',
    emoji: '🏹',
  },
  healer: {
    maxHp: 85,
    maxMana: 80,
    attack: 10,
    defense: 6,
    speed: 2.2,
    attackRange: 4,
    attackCooldown: 600,
    color: '#f59e0b',
    label: 'Şifacı',
    emoji: '✨',
  },
} as const;

// --- Yetenek Cooldown Süreleri (tick cinsinden) ---
export const ABILITY_MAX_COOLDOWNS: Record<PlayerClass, number> = {
  warrior: 240,
  mage: 300,
  archer: 200,
  healer: 360,
} as const;

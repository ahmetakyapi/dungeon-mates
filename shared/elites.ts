// ==========================================
// Dungeon Mates — Elite Affixes
//
// Elites were a flat 2.5x HP / 1.5x attack stat bump — bigger numbers, identical
// behaviour. Affixes make an elite a different fight instead of a longer one.
// ==========================================

export type EliteAffix = '' | 'armored' | 'vampiric' | 'volatile' | 'swift' | 'summoner';

export type EliteAffixDef = {
  id: EliteAffix;
  name: string;
  description: string;
  color: string;
  emoji: string;
};

export const ELITE_AFFIXES: Record<Exclude<EliteAffix, ''>, EliteAffixDef> = {
  armored: {
    id: 'armored',
    name: 'Zırhlı',
    description: 'Yüksek savunma — hasarın çoğunu emer',
    color: '#94a3b8',
    emoji: '🛡️',
  },
  vampiric: {
    id: 'vampiric',
    name: 'Vampirik',
    description: 'Verdiği hasarın bir kısmını can olarak geri alır',
    color: '#dc2626',
    emoji: '🩸',
  },
  volatile: {
    id: 'volatile',
    name: 'Kararsız',
    description: 'Öldüğünde patlar — cesedinden uzak dur',
    color: '#f97316',
    emoji: '💥',
  },
  swift: {
    id: 'swift',
    name: 'Tez',
    description: 'Çok daha hızlı hareket eder ve saldırır',
    color: '#22d3ee',
    emoji: '💨',
  },
  summoner: {
    id: 'summoner',
    name: 'Çağırıcı',
    description: 'Savaş sırasında yardım çağırır',
    color: '#a855f7',
    emoji: '🔮',
  },
} as const;

const AFFIX_POOL: Exclude<EliteAffix, ''>[] = ['armored', 'vampiric', 'volatile', 'swift', 'summoner'];

/** Affix availability ramps with depth so floor 1 stays readable. */
export function rollEliteAffix(floor: number): Exclude<EliteAffix, ''> {
  const available = floor >= 6 ? AFFIX_POOL : floor >= 3 ? AFFIX_POOL.slice(0, 4) : AFFIX_POOL.slice(0, 3);
  return available[Math.floor(Math.random() * available.length)];
}

/** Damage an exploding elite deals on death, and its radius in tiles. */
export const VOLATILE_DEATH_RADIUS = 2.6;
export const VOLATILE_DEATH_DAMAGE_MULT = 1.6;
export const VAMPIRIC_LIFESTEAL = 0.35;
export const SWIFT_SPEED_MULT = 1.55;
export const ARMORED_DEFENSE_MULT = 3.0;
export const SUMMONER_COOLDOWN_TICKS = 140;

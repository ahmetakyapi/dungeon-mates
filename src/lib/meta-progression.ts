// ==========================================
// Dungeon Mates — Meta Progression
//
// Tarayıcı formatında bir run 15-20 dakika. Tekrar oynatan şey run içi ilerleme
// değil, run'lar arası kalıcı ilerleme: her denemede bir sonrakini biraz
// kolaylaştıran kalıcı açılımlar.
//
// Tamamen client tarafında ve localStorage'da tutulur — server otoritesi oyun içi
// simülasyona ait, meta ilerleme oyuncunun kendi cihazına ait.
// ==========================================

import type { PlayerClass } from '../../shared/types';

const STORAGE_KEY = 'dungeon-mates-meta-v1';

export type RunRecord = {
  /** Unix ms */
  at: number;
  outcome: 'victory' | 'defeat';
  playerClass: PlayerClass;
  floors: number;
  kills: number;
  damage: number;
  gold: number;
  level: number;
  /** Saniye */
  time: number;
};

export type MetaUpgradeId =
  | 'vitality'
  | 'might'
  | 'fortune'
  | 'swiftness'
  | 'insight';

export type MetaUpgradeDef = {
  id: MetaUpgradeId;
  name: string;
  description: string;
  emoji: string;
  maxRank: number;
  /** Her rank için maliyet (kadim şard). */
  costPerRank: number;
};

export const META_UPGRADES: Record<MetaUpgradeId, MetaUpgradeDef> = {
  vitality: {
    id: 'vitality',
    name: 'Dayanıklılık',
    description: 'Her rank +8 başlangıç max HP',
    emoji: '❤️',
    maxRank: 5,
    costPerRank: 3,
  },
  might: {
    id: 'might',
    name: 'Kudret',
    description: 'Her rank +2 başlangıç saldırı',
    emoji: '⚔️',
    maxRank: 5,
    costPerRank: 4,
  },
  fortune: {
    id: 'fortune',
    name: 'Talih',
    description: 'Her rank +%10 altın kazancı',
    emoji: '💰',
    maxRank: 3,
    costPerRank: 5,
  },
  swiftness: {
    id: 'swiftness',
    name: 'Çeviklik',
    description: 'Her rank -%8 takla bekleme süresi',
    emoji: '💨',
    maxRank: 3,
    costPerRank: 5,
  },
  insight: {
    id: 'insight',
    name: 'Sezgi',
    description: 'Her rank +%8 XP kazancı',
    emoji: '✨',
    maxRank: 4,
    costPerRank: 4,
  },
} as const;

export type MetaState = {
  /** Harcanabilir meta para. */
  shards: number;
  /** Bugüne kadar kazanılan toplam şard (istatistik). */
  lifetimeShards: number;
  upgrades: Partial<Record<MetaUpgradeId, number>>;
  /** En iyi run'lar, en yeniden eskiye, en fazla 20 kayıt. */
  history: RunRecord[];
  bestFloor: number;
  totalRuns: number;
  victories: number;
};

const EMPTY: MetaState = {
  shards: 0,
  lifetimeShards: 0,
  upgrades: {},
  history: [],
  bestFloor: 0,
  totalRuns: 0,
  victories: 0,
};

export function loadMeta(): MetaState {
  if (typeof window === 'undefined') return { ...EMPTY };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<MetaState>;
    return {
      ...EMPTY,
      ...parsed,
      upgrades: { ...parsed.upgrades },
      history: Array.isArray(parsed.history) ? parsed.history : [],
    };
  } catch {
    // Corrupt or unavailable storage should never block play.
    return { ...EMPTY };
  }
}

export function saveMeta(state: MetaState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private mode / quota — meta progression is a nicety, not a requirement.
  }
}

/**
 * Shards earned from a finished run. Deliberately rewards depth over kill count so
 * pushing further is always worth more than farming an early floor.
 */
export function shardsForRun(record: Pick<RunRecord, 'floors' | 'outcome' | 'level'>): number {
  const depth = Math.max(0, record.floors - 1) * 2;
  const levelBonus = Math.floor(record.level / 2);
  const victoryBonus = record.outcome === 'victory' ? 15 : 0;
  return depth + levelBonus + victoryBonus;
}

export function recordRun(state: MetaState, record: RunRecord): MetaState {
  const earned = shardsForRun(record);
  return {
    ...state,
    shards: state.shards + earned,
    lifetimeShards: state.lifetimeShards + earned,
    history: [record, ...state.history].slice(0, 20),
    bestFloor: Math.max(state.bestFloor, record.floors),
    totalRuns: state.totalRuns + 1,
    victories: state.victories + (record.outcome === 'victory' ? 1 : 0),
  };
}

export function rankOf(state: MetaState, id: MetaUpgradeId): number {
  return state.upgrades[id] ?? 0;
}

export function upgradeCost(state: MetaState, id: MetaUpgradeId): number {
  const def = META_UPGRADES[id];
  return def.costPerRank * (rankOf(state, id) + 1);
}

export function canAfford(state: MetaState, id: MetaUpgradeId): boolean {
  const def = META_UPGRADES[id];
  return rankOf(state, id) < def.maxRank && state.shards >= upgradeCost(state, id);
}

export function buyUpgrade(state: MetaState, id: MetaUpgradeId): MetaState {
  if (!canAfford(state, id)) return state;
  const cost = upgradeCost(state, id);
  return {
    ...state,
    shards: state.shards - cost,
    upgrades: { ...state.upgrades, [id]: rankOf(state, id) + 1 },
  };
}

/** Bonuses to hand to the server at run start. */
export type MetaBonuses = {
  maxHp: number;
  attack: number;
  goldMult: number;
  dodgeCdrMult: number;
  xpMult: number;
};

export function metaBonuses(state: MetaState): MetaBonuses {
  return {
    maxHp: rankOf(state, 'vitality') * 8,
    attack: rankOf(state, 'might') * 2,
    goldMult: 1 + rankOf(state, 'fortune') * 0.1,
    dodgeCdrMult: 1 - rankOf(state, 'swiftness') * 0.08,
    xpMult: 1 + rankOf(state, 'insight') * 0.08,
  };
}

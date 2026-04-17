// ==========================================
// Dungeon Mates — Talent System
// ==========================================

import type { PlayerClass } from './classes';

// --- Talent Sistemi ---
export type TalentBranch = 'branch_a' | 'branch_b' | 'branch_c';

export type TalentId = string;

export type TalentDef = {
  id: TalentId;
  name: string;
  description: string;
  branch: TalentBranch;
  level: number; // hangi levelde açılır
  effects: {
    maxHp?: number;
    maxMana?: number;
    attack?: number;
    defense?: number;
    speed?: number;
    lifesteal?: number;         // 0-1 arası, hasar başına HP kazanımı
    manaCostReduction?: number; // 0-1 arası
    abilityDamageBonus?: number; // çarpan
    shieldDmgReduction?: number; // sadece warrior
    thornsDamage?: number;       // saldırana yansıyan hasar
    critChance?: number;         // 0-1 arası
    critMultiplier?: number;     // çarpan
    dodgeChance?: number;        // 0-1 arası
    manaRegen?: number;          // tick başına ek regen
    hpRegen?: number;            // tick başına ek regen
    // Faz 3 capstone — elemental infusion (0-1 şans: attack'a element ekle)
    fireInfusion?: number;
    iceInfusion?: number;
    poisonInfusion?: number;
    // Chain attack: %chance a kill refunds cooldown
    killRefund?: number;
    // Co-op aura güçlendirici (buff radius)
    auraBoost?: number;
    // Ultimate cooldown reduction (0-1, 1 = instant, 0 = base)
    ultimateCdr?: number;
  };
};

// Sınıf başına dal isimleri
export const TALENT_BRANCH_NAMES: Record<PlayerClass, Record<TalentBranch, { name: string; emoji: string; description: string }>> = {
  warrior: {
    branch_a: { name: 'Kale', emoji: '🛡️', description: 'Savunma ve dayanıklılık' },
    branch_b: { name: 'Berserker', emoji: '🔥', description: 'Saldırı ve can çalma' },
    branch_c: { name: 'Komutan', emoji: '⚔️', description: 'Takım güçlendirmeleri' },
  },
  mage: {
    branch_a: { name: 'Ateş Ustası', emoji: '🔥', description: 'Ham hasar gücü' },
    branch_b: { name: 'Buz Ustası', emoji: '❄️', description: 'Kontrol ve yavaşlatma' },
    branch_c: { name: 'Arkanist', emoji: '✨', description: 'Mana verimliliği ve cooldown' },
  },
  archer: {
    branch_a: { name: 'Keskin Nişancı', emoji: '🎯', description: 'Kritik vuruş ve menzil' },
    branch_b: { name: 'Tuzakçı', emoji: '🕸️', description: 'Debuff ve alan hasarı' },
    branch_c: { name: 'İzci', emoji: '🏃', description: 'Hız ve kaçınma' },
  },
  healer: {
    branch_a: { name: 'Kutsal Işık', emoji: '☀️', description: 'İyileştirme gücü ve menzil' },
    branch_b: { name: 'Koruyucu', emoji: '🛡️', description: 'Savunma ve dayanıklılık' },
    branch_c: { name: 'Ruh Bağı', emoji: '💫', description: 'Mana verimliliği ve destek' },
  },
} as const;

// Her sınıf, her dal, her level için talent tanımları
export const TALENT_TREE: Record<PlayerClass, TalentDef[]> = {
  warrior: [
    // Kale (branch_a)
    { id: 'w_a2', name: 'Demir Deri', description: '+15 savunma, kalkan %80 blok', branch: 'branch_a', level: 2, effects: { defense: 15, shieldDmgReduction: 0.8 } },
    { id: 'w_a3', name: 'Dikenli Zırh', description: 'Saldırana 8 hasar yansıt', branch: 'branch_a', level: 3, effects: { thornsDamage: 8 } },
    { id: 'w_a4', name: 'Kale Duvarı', description: '+40 max HP, kalkan HP rejen', branch: 'branch_a', level: 4, effects: { maxHp: 40, hpRegen: 0.04 } },
    { id: 'w_a5', name: 'Yıkılmaz', description: '+20 savunma, +30 max HP', branch: 'branch_a', level: 5, effects: { defense: 20, maxHp: 30 } },
    { id: 'w_a6', name: 'Son Kale', description: '+60 max HP, kalkan %85 blok', branch: 'branch_a', level: 6, effects: { maxHp: 60, shieldDmgReduction: 0.85 } },
    { id: 'w_a7', name: 'Efsanevi Kale', description: '+80 max HP, kalkan %90 blok, %30 aura boost', branch: 'branch_a', level: 7, effects: { maxHp: 80, shieldDmgReduction: 0.9, auraBoost: 0.3 } },
    // Berserker (branch_b)
    { id: 'w_b2', name: 'Kan Hasadı', description: '+8 saldırı, %10 can çalma', branch: 'branch_b', level: 2, effects: { attack: 8, lifesteal: 0.1 } },
    { id: 'w_b3', name: 'Öfke', description: '+12 saldırı', branch: 'branch_b', level: 3, effects: { attack: 12 } },
    { id: 'w_b4', name: 'Kanlı Bıçak', description: '%15 can çalma, +5 saldırı', branch: 'branch_b', level: 4, effects: { lifesteal: 0.15, attack: 5 } },
    { id: 'w_b5', name: 'Çılgın Savaşçı', description: '+15 saldırı, +20 max HP', branch: 'branch_b', level: 5, effects: { attack: 15, maxHp: 20 } },
    { id: 'w_b6', name: 'Ölüm Makinesi', description: '+20 saldırı, %20 can çalma', branch: 'branch_b', level: 6, effects: { attack: 20, lifesteal: 0.2 } },
    { id: 'w_b7', name: 'Kan Denizi', description: '+25 saldırı, %30 can çalma, %20 ateş bulaştırma', branch: 'branch_b', level: 7, effects: { attack: 25, lifesteal: 0.3, fireInfusion: 0.2 } },
    // Komutan (branch_c)
    { id: 'w_c2', name: 'Savaş Narası', description: '+5 saldırı, +10 savunma', branch: 'branch_c', level: 2, effects: { attack: 5, defense: 10 } },
    { id: 'w_c3', name: 'İlham', description: '+20 max HP, +10 max mana', branch: 'branch_c', level: 3, effects: { maxHp: 20, maxMana: 10 } },
    { id: 'w_c4', name: 'Taktik Üstünlük', description: '+8 saldırı, +8 savunma', branch: 'branch_c', level: 4, effects: { attack: 8, defense: 8 } },
    { id: 'w_c5', name: 'Lider', description: '+30 max HP, +15 max mana', branch: 'branch_c', level: 5, effects: { maxHp: 30, maxMana: 15 } },
    { id: 'w_c6', name: 'Savaş Lordu', description: '+15 saldırı, +15 savunma, +30 HP', branch: 'branch_c', level: 6, effects: { attack: 15, defense: 15, maxHp: 30 } },
    { id: 'w_c7', name: 'Zafer Marşı', description: '+20 saldırı, +20 savunma, %40 aura menzili, ultimate CDR %25', branch: 'branch_c', level: 7, effects: { attack: 20, defense: 20, auraBoost: 0.4, ultimateCdr: 0.25 } },
  ],
  mage: [
    // Ateş Ustası (branch_a)
    { id: 'm_a2', name: 'Alev Gücü', description: '+10 saldırı', branch: 'branch_a', level: 2, effects: { attack: 10 } },
    { id: 'm_a3', name: 'Yangın', description: '+15 saldırı, yetenek %20 bonus', branch: 'branch_a', level: 3, effects: { attack: 15, abilityDamageBonus: 0.2 } },
    { id: 'm_a4', name: 'Cehennem Ateşi', description: '+12 saldırı, yetenek %30 bonus', branch: 'branch_a', level: 4, effects: { attack: 12, abilityDamageBonus: 0.3 } },
    { id: 'm_a5', name: 'Ateş Lordu', description: '+20 saldırı', branch: 'branch_a', level: 5, effects: { attack: 20 } },
    { id: 'm_a6', name: 'Güneş Çarpması', description: '+25 saldırı, yetenek %40 bonus', branch: 'branch_a', level: 6, effects: { attack: 25, abilityDamageBonus: 0.4 } },
    { id: 'm_a7', name: 'Süpernova', description: '+30 saldırı, yetenek %60 bonus, %40 ateş bulaştırma', branch: 'branch_a', level: 7, effects: { attack: 30, abilityDamageBonus: 0.6, fireInfusion: 0.4 } },
    // Buz Ustası (branch_b)
    { id: 'm_b2', name: 'Buz Kalkanı', description: '+8 savunma, +5 saldırı', branch: 'branch_b', level: 2, effects: { defense: 8, attack: 5 } },
    { id: 'm_b3', name: 'Don', description: '+20 max HP, +8 savunma', branch: 'branch_b', level: 3, effects: { maxHp: 20, defense: 8 } },
    { id: 'm_b4', name: 'Buzul', description: '+10 saldırı, +10 savunma', branch: 'branch_b', level: 4, effects: { attack: 10, defense: 10 } },
    { id: 'm_b5', name: 'Kış Fırtınası', description: '+30 max HP, yetenek %25 bonus', branch: 'branch_b', level: 5, effects: { maxHp: 30, abilityDamageBonus: 0.25 } },
    { id: 'm_b6', name: 'Mutlak Sıfır', description: '+15 saldırı, +15 savunma, +20 HP', branch: 'branch_b', level: 6, effects: { attack: 15, defense: 15, maxHp: 20 } },
    { id: 'm_b7', name: 'Ebedi Kış', description: '+20 saldırı, +25 savunma, %40 buz bulaştırma, yetenek %30 bonus', branch: 'branch_b', level: 7, effects: { attack: 20, defense: 25, iceInfusion: 0.4, abilityDamageBonus: 0.3 } },
    // Arkanist (branch_c)
    { id: 'm_c2', name: 'Mana Akışı', description: '+30 max mana, mana regen artışı', branch: 'branch_c', level: 2, effects: { maxMana: 30, manaRegen: 0.03 } },
    { id: 'm_c3', name: 'Verimlilik', description: '%20 mana maliyet azalma, +10 saldırı', branch: 'branch_c', level: 3, effects: { manaCostReduction: 0.2, attack: 10 } },
    { id: 'm_c4', name: 'Arkan Bilgeliği', description: '+40 max mana, +8 saldırı', branch: 'branch_c', level: 4, effects: { maxMana: 40, attack: 8 } },
    { id: 'm_c5', name: 'Sonsuz Akış', description: '%30 mana azalma, mana regen artışı', branch: 'branch_c', level: 5, effects: { manaCostReduction: 0.3, manaRegen: 0.05 } },
    { id: 'm_c6', name: 'Arkan Lord', description: '+50 max mana, +15 saldırı, %35 azalma', branch: 'branch_c', level: 6, effects: { maxMana: 50, attack: 15, manaCostReduction: 0.35 } },
    { id: 'm_c7', name: 'Zaman Bükücü', description: '+60 max mana, %40 mana azalma, ultimate CDR %35, %15 öldürme refund', branch: 'branch_c', level: 7, effects: { maxMana: 60, manaCostReduction: 0.4, ultimateCdr: 0.35, killRefund: 0.15 } },
  ],
  archer: [
    // Keskin Nişancı (branch_a)
    { id: 'a_a2', name: 'Keskin Göz', description: '%15 kritik şansı', branch: 'branch_a', level: 2, effects: { critChance: 0.15 } },
    { id: 'a_a3', name: 'Zayıf Nokta', description: '+10 saldırı, kritik 2x hasar', branch: 'branch_a', level: 3, effects: { attack: 10, critMultiplier: 2.0 } },
    { id: 'a_a4', name: 'Ölümcül Nişan', description: '%25 kritik şansı, +5 saldırı', branch: 'branch_a', level: 4, effects: { critChance: 0.25, attack: 5 } },
    { id: 'a_a5', name: 'Tek Atış', description: '+15 saldırı, kritik 2.5x hasar', branch: 'branch_a', level: 5, effects: { attack: 15, critMultiplier: 2.5 } },
    { id: 'a_a6', name: 'Hayalet Okçu', description: '%35 kritik, +20 saldırı', branch: 'branch_a', level: 6, effects: { critChance: 0.35, attack: 20 } },
    { id: 'a_a7', name: 'Okçular Kralı', description: '%45 kritik, +25 saldırı, kritik 3x, %20 öldürme refund', branch: 'branch_a', level: 7, effects: { critChance: 0.45, attack: 25, critMultiplier: 3.0, killRefund: 0.2 } },
    // Tuzakçı (branch_b)
    { id: 'a_b2', name: 'Zehirli Ok', description: '+8 saldırı, yetenek %15 bonus', branch: 'branch_b', level: 2, effects: { attack: 8, abilityDamageBonus: 0.15 } },
    { id: 'a_b3', name: 'Patlayıcı Ok', description: '+12 saldırı, yetenek %25 bonus', branch: 'branch_b', level: 3, effects: { attack: 12, abilityDamageBonus: 0.25 } },
    { id: 'a_b4', name: 'Ölüm Tuzağı', description: '+10 saldırı, +20 max HP', branch: 'branch_b', level: 4, effects: { attack: 10, maxHp: 20 } },
    { id: 'a_b5', name: 'Mayın Tarlası', description: 'Yetenek %40 bonus, +8 saldırı', branch: 'branch_b', level: 5, effects: { abilityDamageBonus: 0.4, attack: 8 } },
    { id: 'a_b6', name: 'Kaos Okçusu', description: '+20 saldırı, yetenek %50 bonus', branch: 'branch_b', level: 6, effects: { attack: 20, abilityDamageBonus: 0.5 } },
    { id: 'a_b7', name: 'Zehir Ustası', description: '+25 saldırı, yetenek %70 bonus, %35 zehir bulaştırma', branch: 'branch_b', level: 7, effects: { attack: 25, abilityDamageBonus: 0.7, poisonInfusion: 0.35 } },
    // İzci (branch_c)
    { id: 'a_c2', name: 'Rüzgar Adımı', description: '+0.3 hız, %10 kaçınma', branch: 'branch_c', level: 2, effects: { speed: 0.3, dodgeChance: 0.1 } },
    { id: 'a_c3', name: 'Gölge Adım', description: '%15 kaçınma, +20 max HP', branch: 'branch_c', level: 3, effects: { dodgeChance: 0.15, maxHp: 20 } },
    { id: 'a_c4', name: 'Hayalet Koşucu', description: '+0.4 hız, +8 saldırı', branch: 'branch_c', level: 4, effects: { speed: 0.4, attack: 8 } },
    { id: 'a_c5', name: 'Rüzgar Okçusu', description: '%20 kaçınma, +10 saldırı', branch: 'branch_c', level: 5, effects: { dodgeChance: 0.2, attack: 10 } },
    { id: 'a_c6', name: 'Fırtına İzci', description: '+0.5 hız, %25 kaçınma, +15 saldırı', branch: 'branch_c', level: 6, effects: { speed: 0.5, dodgeChance: 0.25, attack: 15 } },
    { id: 'a_c7', name: 'Gölge Ustası', description: '+0.7 hız, %35 kaçınma, +20 saldırı, ultimate CDR %30', branch: 'branch_c', level: 7, effects: { speed: 0.7, dodgeChance: 0.35, attack: 20, ultimateCdr: 0.3 } },
  ],
  healer: [
    // Kutsal Işık (branch_a) — İyileştirme gücü
    { id: 'h_a2', name: 'Kutsal Dokunuş', description: '+15 max mana, iyileştirme %15 bonus', branch: 'branch_a', level: 2, effects: { maxMana: 15, abilityDamageBonus: 0.15 } },
    { id: 'h_a3', name: 'Işık Seli', description: '+25 max mana, iyileştirme %25 bonus', branch: 'branch_a', level: 3, effects: { maxMana: 25, abilityDamageBonus: 0.25 } },
    { id: 'h_a4', name: 'Kutsal Aura', description: 'HP regen artışı, +15 max mana', branch: 'branch_a', level: 4, effects: { hpRegen: 0.06, maxMana: 15 } },
    { id: 'h_a5', name: 'İlahi Güç', description: '+30 max mana, iyileştirme %35 bonus', branch: 'branch_a', level: 5, effects: { maxMana: 30, abilityDamageBonus: 0.35 } },
    { id: 'h_a6', name: 'Mucize', description: '+40 max mana, iyileştirme %50 bonus, HP regen', branch: 'branch_a', level: 6, effects: { maxMana: 40, abilityDamageBonus: 0.5, hpRegen: 0.08 } },
    { id: 'h_a7', name: 'İlahi Kutsama', description: '+50 max mana, iyileştirme %70 bonus, HP regen +0.12, %40 aura', branch: 'branch_a', level: 7, effects: { maxMana: 50, abilityDamageBonus: 0.7, hpRegen: 0.12, auraBoost: 0.4 } },
    // Koruyucu (branch_b) — Savunma
    { id: 'h_b2', name: 'İnanç Kalkanı', description: '+10 savunma, +15 max HP', branch: 'branch_b', level: 2, effects: { defense: 10, maxHp: 15 } },
    { id: 'h_b3', name: 'Kutsal Zırh', description: '+15 savunma, +20 max HP', branch: 'branch_b', level: 3, effects: { defense: 15, maxHp: 20 } },
    { id: 'h_b4', name: 'Şifa Bariyeri', description: '+10 savunma, HP regen artışı', branch: 'branch_b', level: 4, effects: { defense: 10, hpRegen: 0.05 } },
    { id: 'h_b5', name: 'Aziz Duvarı', description: '+20 savunma, +30 max HP', branch: 'branch_b', level: 5, effects: { defense: 20, maxHp: 30 } },
    { id: 'h_b6', name: 'Yenilmez Şifacı', description: '+25 savunma, +40 max HP, dikenli 5', branch: 'branch_b', level: 6, effects: { defense: 25, maxHp: 40, thornsDamage: 5 } },
    { id: 'h_b7', name: 'Meleksi Koruyucu', description: '+35 savunma, +60 max HP, dikenli 10, ultimate CDR %25', branch: 'branch_b', level: 7, effects: { defense: 35, maxHp: 60, thornsDamage: 10, ultimateCdr: 0.25 } },
    // Ruh Bağı (branch_c) — Mana ve destek
    { id: 'h_c2', name: 'Ruh Akışı', description: '+20 max mana, mana regen artışı', branch: 'branch_c', level: 2, effects: { maxMana: 20, manaRegen: 0.04 } },
    { id: 'h_c3', name: 'Enerji Köprüsü', description: '%15 mana maliyet azalma, +5 saldırı', branch: 'branch_c', level: 3, effects: { manaCostReduction: 0.15, attack: 5 } },
    { id: 'h_c4', name: 'Ruh Bağlantısı', description: '+30 max mana, mana regen artışı', branch: 'branch_c', level: 4, effects: { maxMana: 30, manaRegen: 0.06 } },
    { id: 'h_c5', name: 'Manevi Güç', description: '%25 mana azalma, +8 saldırı', branch: 'branch_c', level: 5, effects: { manaCostReduction: 0.25, attack: 8 } },
    { id: 'h_c6', name: 'Ruh Ustası', description: '+40 max mana, %30 mana azalma, regen', branch: 'branch_c', level: 6, effects: { maxMana: 40, manaCostReduction: 0.3, manaRegen: 0.08 } },
    { id: 'h_c7', name: 'Ruh Efendisi', description: '+50 max mana, %40 mana azalma, %10 öldürme refund, %40 aura', branch: 'branch_c', level: 7, effects: { maxMana: 50, manaCostReduction: 0.4, killRefund: 0.1, auraBoost: 0.4, manaRegen: 0.1 } },
  ],
} as const;

// ==========================================
// Dungeon Mates — Kat Temaları / Renk Paleti
//
// Önceden zemin (#3e3e5c) ve duvar (#5038a0) renkleri SpriteRenderer içinde
// sabit kodluydu; 10 katın tamamı aynı görünüyordu (tek fark tam ekran bir
// multiply tint'ti, o da sadece 5/7/8/9/10'da). Artık her katın kendi taş
// rampası, yosun/aksan rengi ve ışık sıcaklığı var.
//
// Her tema 4 basamaklı bir taş rampası taşır: koyu → temel → açık → vurgu.
// Sprite'lar bu rampadan okur, böylece bir katın tamamı tek bir renk ailesinde
// kalır ve dithering/gölgeleme tutarlı olur.
// ==========================================

export type FloorTheme = {
  /** Kat adı — yükleme ekranı ve kat geçişi ile aynı olmalı. */
  name: string;
  /** Zemin taş rampası: [koyu, temel, açık, vurgu] */
  floor: readonly [string, string, string, string];
  /** Duvar taş rampası: [koyu/gölge, temel, açık/üst yüz, vurgu] */
  wall: readonly [string, string, string, string];
  /** Harç / derz rengi. */
  mortar: string;
  /** Yosun, kök, kir gibi organik detay rengi. */
  growth: string;
  /** Katın imza aksan rengi (dekor, sızıntı, parıltı). */
  accent: string;
  /** Meşale/ortam ışığının sıcaklığı. */
  light: string;
};

const THEMES: Record<number, FloorTheme> = {
  // 1 — Yıkık Kapılar: soğuk gri taş, ilk izlenim net ve okunaklı olmalı
  1: {
    name: 'Yıkık Kapılar',
    floor: ['#2b2f3d', '#3a4052', '#4a5167', '#5a627c'],
    wall: ['#343a4a', '#454d61', '#59627a', '#6d7791'],
    mortar: '#252a36',
    growth: '#4b6b4f',
    accent: '#7c8aa8',
    light: '#ffb85c',
  },
  // 2 — Sessiz Sokaklar: hafif sıcaklık, terk edilmiş şehir dokusu
  2: {
    name: 'Sessiz Sokaklar',
    floor: ['#2e2c38', '#3f3c4c', '#514d61', '#635e76'],
    wall: ['#3a3644', '#4c4759', '#605a70', '#756e88'],
    mortar: '#272531',
    growth: '#55704f',
    accent: '#8b7fa6',
    light: '#ffb04f',
  },
  // 3 — Demircinin Ocağı: topraklı kahve, dar ve boğucu
  3: {
    name: 'Demircinin Ocağı',
    floor: ['#302820', '#42372c', '#544639', '#665648'],
    wall: ['#3a2f25', '#4d3f32', '#615040', '#77644f'],
    mortar: '#241d17',
    growth: '#5c6b3a',
    accent: '#a3794a',
    light: '#ffa640',
  },
  // 4 — Terkedilmiş Pazar: ahşap ve kumaş, daha sıcak
  4: {
    name: 'Terkedilmiş Pazar',
    floor: ['#352a24', '#493a30', '#5d4b3d', '#725d4c'],
    wall: ['#40332a', '#564437', '#6c5645', '#836a56'],
    mortar: '#2a211a',
    growth: '#6b7040',
    accent: '#c08a4a',
    light: '#ffbe63',
  },
  // 5 — Dokuyucunun Evi: hastalıklı mor-yeşil, ağ dokusu
  5: {
    name: 'Dokuyucunun Evi',
    floor: ['#241f30', '#332b42', '#423755', '#524569'],
    wall: ['#2c2440', '#3c3255', '#4d406c', '#614f86'],
    mortar: '#1c1826',
    growth: '#5d7a4a',
    accent: '#9d6bc4',
    light: '#c88cff',
  },
  // 6 — Yıkık Kütüphane: tozlu kehribar, kağıt ve deri
  6: {
    name: 'Yıkık Kütüphane',
    floor: ['#33291f', '#47392b', '#5b4a38', '#705c46'],
    wall: ['#3d3226', '#524334', '#685544', '#806a55'],
    mortar: '#2b2118',
    growth: '#6d6b3c',
    accent: '#d9a45c',
    light: '#ffca78',
  },
  // 7 — Taş Bahçeler: yosunlu gri-yeşil, doğa taşı geri alıyor
  7: {
    name: 'Taş Bahçeler',
    floor: ['#252e28', '#334035', '#425043', '#526152'],
    wall: ['#2d382f', '#3d4b3f', '#4e5f50', '#617563'],
    mortar: '#1f2721',
    growth: '#4f8a4a',
    accent: '#7fae72',
    light: '#c9ff9c',
  },
  // 8 — Lav Nehirleri: koyu bazalt + turuncu kor
  8: {
    name: 'Lav Nehirleri',
    floor: ['#221a1a', '#312424', '#402f2d', '#513b36'],
    wall: ['#2a1e1c', '#3b2926', '#4d3630', '#63453b'],
    mortar: '#1a1312',
    growth: '#7a4a2a',
    accent: '#ff7a3c',
    light: '#ff8a3d',
  },
  // 9 — Ruhlar Tapınağı: soluk camgöbeği, hayaletsi ve soğuk
  9: {
    name: 'Ruhlar Tapınağı',
    floor: ['#1f2a2e', '#2c3a40', '#3a4c53', '#4a6068'],
    wall: ['#26333a', '#34454e', '#455a64', '#58717d'],
    mortar: '#1a2327',
    growth: '#3f6e6a',
    accent: '#7fd4d8',
    light: '#a8f0ff',
  },
  // 10 — Taht Salonu: derin kızıl + altın, final ağırlığı
  10: {
    name: 'Taht Salonu',
    floor: ['#2a1c22', '#3b262e', '#4d323b', '#5f404a'],
    wall: ['#33212a', '#472d38', '#5b3a47', '#724a59'],
    mortar: '#1f151a',
    growth: '#6b3a44',
    accent: '#d4af37',
    light: '#ffd27a',
  },
} as const;

const FALLBACK = THEMES[1];

export function floorTheme(floor: number): FloorTheme {
  return THEMES[floor] ?? FALLBACK;
}

/** Toplam kat sayısı — tema tablosunun boyutundan türetilir. */
export const THEMED_FLOOR_COUNT = Object.keys(THEMES).length;

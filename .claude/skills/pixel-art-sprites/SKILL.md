---
name: pixel-art-sprites
description: Activate when working on SpriteRenderer.ts, adding new monster/player sprites, modifying visual effects, decor elements, or any procedural pixel art drawing code.
---

# Procedural Pixel Art Sprites

Tum sprite'lar Canvas API ile runtime'da cizilir — sprite sheet veya gorsel dosya YOK.
`SpriteRenderer.ts` (~2600 satir) tum cizim mantigi.

## Cizim Felsefesi

- `fillRect()` ile piksel piksel sekil olustur
- `arc()` ile yuvarlak unsurlar (kafa, kalkan)
- `beginPath()` + `lineTo()` ile acili unsurlar (kuzgun kanat, ok)
- Renk: `MONSTER_STATS[type].color` veya sinif bazli sabit renkler
- Boyut: `MONSTER_STATS[type].size` carpani (1.0 = standart, 2.5 = boss)

## Mevcut Canavar Sprite Metodlari

| Metod | Kullanan Tipler |
|---|---|
| `drawSkeleton()` | skeleton, gargoyle |
| `drawSlime()` | slime, lava_slime |
| `drawBat()` | bat |
| `drawGoblin()` | goblin, dark_knight |
| `drawRat()` | rat |
| `drawSpider()` | spider |
| `drawWraith()` | wraith, phantom |
| `drawMushroom()` | mushroom |
| `drawBossDemon()` | boss_demon, boss_spider_queen |

Yeni tipler mevcut draw metodlarini yeniden kullanir. Boyut farki `MONSTER_STATS.size` ile gelir.

## Kahraman Sprite Metodlari

| Metod | Sinif | Ozellikler |
|---|---|---|
| `drawWarrior()` | Savasci | Kilic, kalkan, agir zirah |
| `drawMage()` | Buyucu | Asa, cupra, isik efekti |
| `drawArcher()` | Okcu | Yay, hafif zirah, ok |

Parametreler: `(ctx, x, y, facing, frame, attacking)`
- `facing`: 'left' | 'right' — `scale(-1, 1)` ile yon cevirme
- `frame`: animasyon karesi (0, 1, 2...) — yurume dongüsü
- `attacking`: true ise saldiri pozu

## Animasyon Sistemi

```
Yurume: 2-3 frame, bacak pozisyonu degisir
  frame 0: durus
  frame 1: sol bacak ileri
  frame 2: sag bacak ileri

Saldiri: 1-2 frame, silah uzanir
  attacking=true: kol/silah on tarafa uzanir

Boss: Ozel animasyon (sarj, alan hasari, spawn)
```

Frame sayaci `GameRenderer.ts`'te tutulur, entity state'ten gelir.

## Dekor Sprite'lari

| Eleman | Yontem | Ozel Efekt |
|---|---|---|
| Mesale | fillRect + animasyonlu alev | Isik dairesi (radialGradient) |
| Sandik (kapali) | fillRect kutu | Altin parlama (globalAlpha pulse) |
| Sandik (acik) | Kapak yukari | Parlama yok |
| Merdiven | fillRect basamaklar | Mavi beacon (tum odalar temizlendiginde) |
| Kapi (kapali) | Kalin fillRect | — |
| Kapi (acik) | Ince fillRect | — |

## Renk Paleti

```
Oyuncu sinif renkleri:
  Savasci: #ef4444 (kirmizi)
  Buyucu: #8b5cf6 (mor)
  Okcu: #22c55e (yesil)

Canavar renkleri (MONSTER_STATS.color):
  skeleton: #d4d4d8, slime: #22c55e, bat: #7c3aed
  goblin: #16a34a, wraith: #a78bfa, boss_demon: #dc2626
  gargoyle: #6b7280, dark_knight: #1e293b
  phantom: #c4b5fd, lava_slime: #f97316
  boss_spider_queen: #7c3aed

UI renkleri (dm-* token):
  dm-accent: #8b5cf6, dm-gold: #f59e0b
  dm-health: kirmizi, dm-mana: mavi
```

## Yeni Benzersiz Sprite Ekleme

Mevcut metodu yeniden kullanmak yerine yeni cizim istiyorsan:

```
1. SpriteRenderer.ts'te yeni metod: drawNewMonster(ctx, x, y, facing, frame, attacking)
2. Govde: 4-6 fillRect ile ana sekil (8-12px genislik referans)
3. Detay: 2-3 fillRect ile goz, agiz, ozel unsur
4. Animasyon: frame % 2 ile bacak/kol pozisyonu degistir
5. Yon: facing === 'left' ise ctx.scale(-1, 1) + x offset
6. Saldiri: attacking ise silah/kol uzat
7. drawMonster() switch case'ine ekle
```

## Pixel Art Kurallari

```typescript
// ZORUNLU — her frame basinda
ctx.imageSmoothingEnabled = false;

// Koordinatlar HER ZAMAN integer
const x = Math.round(worldX);
const y = Math.round(worldY);

// Alt piksel render YASAK — bulanik goruntü olusturur
// 0.5 offset KULLANMA
```

## Particle Efektleri

| Tip | Renk | Kullanim |
|---|---|---|
| blood | Kirmizi | Canavar hasari |
| gold_sparkle | Altin | Altin toplama |
| heal | Yesil | Can iksiri |
| mana | Mavi | Mana kullanimi |
| dust | Gri | Ortam tozu |
| fire | Turuncu | Ates efektleri |
| ice | Acik mavi | Buz firtinasi |

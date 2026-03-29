---
name: monster-ai-design
description: Activate when working on Monster.ts, monster AI behaviors, boss encounters, difficulty scaling, or adding new monster types. Also relevant for GameRoom.ts monster spawning and DungeonGenerator.ts floor config.
---

# Monster AI Design

## 14 Canavar Tipi

| Tip | AI Pattern | HP | Saldiri | Hiz | Boyut | Kat |
|---|---|---|---|---|---|---|
| rat | Suru (flock) | 20 | 5 | 2.0 | 0.6 | 1-4 |
| slime | Yavas takip | 25 | 7 | 0.8 | 1.0 | 1-4 |
| bat | Hizli, dusuk HP | 15 | 6 | 2.5 | 0.7 | 1-5 |
| skeleton | Standart takip | 40 | 10 | 1.5 | 1.0 | 2-6 |
| spider | Orta hiz | 30 | 9 | 1.8 | 0.9 | 2-7 |
| goblin | Agresif takip | 35 | 12 | 2.0 | 0.9 | 3-8 |
| wraith | Faz gecisi (duvar) | 30 | 14 | 1.8 | 1.0 | 3-7 |
| mushroom | Yavas, zehir | 45 | 8 | 0.6 | 1.1 | 3-6 |
| gargoyle | skeleton AI, buyuk | 55 | 16 | 1.4 | 1.2 | 6-8 |
| dark_knight | goblin AI, tank | 80 | 22 | 1.6 | 1.3 | 7-9 |
| phantom | wraith AI, hizli | 40 | 20 | 2.5 | 1.0 | 7-9 |
| lava_slime | slime AI, ates | 50 | 15 | 1.0 | 1.0 | 8-9 |
| boss_spider_queen | Boss AI, mid-boss | 350 | 28 | 1.3 | 2.2 | 5 |
| boss_demon (Mor'Khan) | Boss AI, final | 500 | 35 | 1.5 | 2.5 | 10 |

## AI State Machine

Her canavar basit state machine ile calisir:

```
IDLE → (oyuncu algilandi) → CHASE → (menzilde) → ATTACK → (vuruş sonrasi) → CHASE
                                                      ↓ (HP dusuk)
                                                    FLEE (bazi tipler)
```

Algilama: `DETECTION_RANGE = 7 tile`

## Ozel Davranislar

**Suru (Flock) — rat:**
- 2-3 birim birlikte hareket eder
- `flock()` metodu ile konum hesaplama

**Faz Gecisi — wraith, phantom:**
- Duvar collision skip flag'i
- Faz gecisi sirasinda hasar ALMAZ
- Toggle suresi: ~60 tick

**Boss AI — boss_demon, boss_spider_queen:**
```
CHARGE (hizli kosu) → AREA_DAMAGE (cevresel hasar) → SUMMON (minion cagir)
```
- `BOSS_CHARGE_RANGE = 6 tile`
- `BOSS_SUMMON_COOLDOWN = 200 tick` (10 saniye)
- Sarj sirasinda hiz 2x
- Minion spawn: 2-3 kucuk canavar

## Zorluk Olcekleme

### Kat Bazli Multiplier (DungeonGenerator.ts)

| Kat | HP Multi | Saldiri Multi | Oda Sayisi |
|---|---|---|---|
| 1 | 1.0x | 1.0x | 5-7 |
| 5 | 1.8x | 1.4x | 7-9 (mid-boss) |
| 10 | 3.5x | 2.2x | 10-12 (final boss) |

### Oyuncu Sayisi Etkisi

Oyuncu sayisi arttikca: zindan boyutu buyur, canavar sayisi artar, zorluk carpani yukselir.

## Canavar Havuzu (GameRoom.ts)

```typescript
MONSTER_POOL_BY_FLOOR: Record<number, WeightedMonster[]>
```

Her kat icin agirlikli canavar listesi. Ust katlarda guclu tipler daha yuksek agirlik alir.
Kat 6+: gargoyle, dark_knight, phantom, lava_slime eklenir.

## Boss Karsilasmalari

**Kat 5 — Orumcek Kralice (mid-boss):**
- `boss_spider_queen` spawn
- Yenildiginde otomatik sonraki kata gecis (merdiven yok)
- BossIntro: "Aglarama hos geldiniz..."

**Kat 10 — Mor'Khan (final boss):**
- `boss_demon` spawn
- Yenildiginde zafer fazina gecis
- BossIntro: "Ben... onlari koruyacaktim."

## Yeni Canavar Ekleme Checklist

```
1. shared/types.ts
   - MonsterType union'a yeni tip ekle
   - MONSTER_STATS'a HP, attack, defense, speed, xp, color, size ekle

2. server/entities/Monster.ts
   - AI davranis switch case ekle (mevcut pattern'i yeniden kullanabilirsin)

3. server/GameRoom.ts
   - MONSTER_POOL_BY_FLOOR'a uygun katlara weight ile ekle
   - Boss ise: boss spawn logic'i guncelle

4. src/game/renderer/SpriteRenderer.ts
   - drawMonster() switch case ekle
   - Yeni sprite metodu yaz VEYA mevcut birini yeniden kullan

5. src/components/game/HUD.tsx
   - XP_TO_NAME record'larina Turkce isim ekle (2 YERDE!)

6. src/components/game/LoadingScreen.tsx
   - GAME_TIPS'e uygun ipucu ekle (opsiyonel)
```

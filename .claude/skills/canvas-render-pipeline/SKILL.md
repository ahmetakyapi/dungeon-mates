---
name: canvas-render-pipeline
description: Activate when working on GameRenderer.ts, SpriteRenderer.ts, ParticleSystem.ts, Camera.ts, or any Canvas 2D rendering code. Covers render budget, object pooling, pixel art rules, hit feel, and movement interpolation.
---

# Canvas 2D Render Pipeline

## Frame Budget

Hedef: 16ms/frame (60 FPS). Quality sistemi FPS izler — manual switch ekleme.

| Katman | Tahmini Maliyet | Optimizasyon |
|---|---|---|
| Floor + Decor | ~2ms | Offscreen buffer, sadece viewport icini ciz |
| Monsters + Players | ~4ms | Sprite cache, sadece gorunenleri render et |
| Particles | ~3ms | Pool-based (768 sabit), priority: combat > ambient |
| Fog of War | ~2ms | Offscreen buffer, sadece degisen tile'lari guncelle |
| UI (HP bar, isim) | ~1ms | Basit fillRect, font cache |

## Render Sirasi (BOZMA)

```
Floor → Decor → Loot → Monsters → Projectiles → Players → Particles → Fog → UI
```

## Allocation Yasagi (Render Loop)

Render dongusunde YASAK:
```typescript
// YASAK — her frame'de allocation
new Array(), new Object(), [...spread], .map(), .filter()
Object.keys(), Object.values(), Object.entries()
String template literal (hot path'te)
```

Alternatif: onceden ayrilmis diziler, for-loop, index ile erisim.

## Pixel Art Kurallari

```typescript
ctx.imageSmoothingEnabled = false; // ZORUNLU — her frame basinda
// Koordinatlar integer olmali
const x = Math.round(worldX - cameraX);
const y = Math.round(worldY - cameraY);
```

- Mantiksal cozunurluk: masaustu 480x270, mobil 280x210
- Offscreen buffer kullan — pixelation artifact onler
- `clearRect` kullan, `fillRect(black)` ile silme

## Hit Feel Sistemi

**Freeze Frame (Hitstop):**
```
freezeFrame(ms) → dunya durur, particle'lar devam eder
- Canavar olum: 50ms
- Boss hit: 35ms
- Boss olum: 80ms
- Agir hasar (>20% maxHP): 60ms
```

**Camera Punch:**
```
camera.punch(dirX, dirY, amount, decayRate)
- Vurus yonune dogru kamera sarsintisi
- punchDecay ile her frame azalir
- scrollX/scrollY getter'larinda eklenir
```

**Screen Flash:**
```
Canavar oldurme: beyaz flash, intensity 0.12
fillRect ile tam ekran, globalAlpha ile fade
```

## Movement Interpolation

Server 20 tick/sn gonderiyor, client 60fps render ediyor.
Arayi kapatmak icin lerp kullanilir:

```typescript
// prevEntityPositions Map'te onceki pozisyonlar saklanir
const LERP_FACTOR = 0.35;
renderX = prevX + (currentX - prevX) * LERP_FACTOR;
renderY = prevY + (currentY - prevY) * LERP_FACTOR;
```

Her frame'de `prevEntityPositions` guncellenir. Yeni entity → lerp atla, direkt pozisyon.

## Camera Sistemi (Camera.ts ~290 satir)

- **Shake**: `shake(intensity, durationMs)` — rastgele offset
- **Punch**: `punch(dirX, dirY, amount, decay)` — yonlu vuruş
- **Look-ahead**: oyuncunun hareket yonune dogru kayma
- **Zoom**: quality tier'a gore ayarlanir
- `scrollX` / `scrollY` getter'lari: base + shake + punch

## Particle System (ParticleSystem.ts ~1100 satir)

- Havuz: 768 parcacik sabit
- Oncelik: combat > ambient — ambient'i once geri donustur
- `emit(type, x, y, count)` — havuzdan al, kullan, geri birak
- Efekt tipleri: blood, gold_sparkle, heal, mana, dust, fire, ice
- Yeni efekt eklerken havuz boyutunu ARTIRMA — geri donusum iyilestir

## Quality Tiers

| Tier | Particle | Shadow | Fog Detail |
|---|---|---|---|
| Low | 256 | Yok | Basit |
| Medium | 512 | Basit | Normal |
| High | 768 | Detayli | Tam |

FPS izleme otomatik — kendi switch mekanizmani ekleme.

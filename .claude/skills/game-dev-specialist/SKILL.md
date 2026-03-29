---
name: game-dev-specialist
description: Activate when working on Canvas rendering, particle systems, sprite drawing, monster AI, collision detection, game loop optimization, WebSocket game state, camera system, hit feel, audio engine, or any performance-sensitive game code in this project.
---

# Game Development Specialist

Browser tabanlı co-op dungeon crawler. 40 kaynak dosya, ~18.000 satır TypeScript.
Tüm sprite'lar prosedürel Canvas API ile çizilir — sprite sheet yok.

## Kritik Dosya Haritası

| Dosya | Satır | Sorumluluk |
|---|---|---|
| `src/game/renderer/GameRenderer.ts` | ~2200 | Ana canvas render pipeline, freeze frame, movement interpolation |
| `src/game/renderer/SpriteRenderer.ts` | ~2600 | 14 canavar + 3 sınıf prosedürel sprite çizimi |
| `src/game/renderer/ParticleSystem.ts` | ~1100 | Pool-based particle engine (768 havuz) |
| `src/game/renderer/Camera.ts` | ~290 | Kamera: shake, zoom, look-ahead, directional punch |
| `src/game/audio/SoundManager.ts` | ~780 | Web Audio synthesizer, per-floor müzik, ambient katmanları |
| `src/game/input/InputManager.ts` | ~300 | Keyboard + gamepad input |
| `src/game/input/TouchControls.ts` | ~590 | Mobil joystick + butonlar |
| `server/GameRoom.ts` | ~1120 | Oyun döngüsü, 20 tick/sn, oda yönetimi |
| `server/entities/Monster.ts` | ~740 | 14 canavar AI (skeleton, slime, bat, goblin, rat, spider, wraith, mushroom, gargoyle, dark_knight, phantom, lava_slime, boss_spider_queen, boss_demon) |
| `server/dungeon/DungeonGenerator.ts` | ~525 | BSP tree zindan üretimi, 10 kat config |
| `shared/types.ts` | ~260 | Server-client köprü dosyası |

## Render Pipeline — Katman Sırası (BOZMA)

```
Floor → Decor → Loot → Monsters → Projectiles → Players → Particles → Fog → UI
```

Kurallar:
- `imageSmoothingEnabled = false` — pixel art zorunlu
- Offscreen buffer kullan — pixelation artifact önler
- Mantıksal çözünürlük: masaüstü 480×270, mobil 280×210
- Canvas context'i her frame yeniden alma — bir kez al, sakla
- `clearRect` kullan, `fillRect(black)` ile silme

## Hit Feel Sistemi (Yeni)

GameRenderer'da freeze frame + Camera'da directional punch:
- `freezeFrame(ms)` → canavar ölümü: 50ms, boss hit: 35ms, boss ölüm: 80ms, ağır hasar: 60ms
- `camera.punch(dirX, dirY, amount, decayRate)` → vuruş yönüne kamera sarsıntısı
- Monster kill'de beyaz ekran flash (0.12 intensity)
- Movement interpolation: `prevEntityPositions` Map, lerp factor 0.35

## Particle System

- Havuz boyutu sabit: 768 parçacık
- Öncelik: combat > ambient — ambient'i önce geri dönüştür
- Render döngüsünde `new` ile nesne oluşturma YASAK
- Yeni efekt eklerken havuz boyutunu artırma, geri dönüşüm mantığını iyileştir

## Ses Motoru (SoundManager)

- Per-floor müzik: `playFloorMusic(floor)` — tempo 60→84 BPM, katmanlı sentez
  - Bass: tüm katlar | Melodi: kat 3+ | Dissonans: kat 5+ | Perküsyon: kat 7+
- Ambient: `startAmbience(floor)` — su damlaları, rüzgar (3+), fısıltılar (6+), kalp atışı (9+)
- Saldırı ses çeşitliliği: ±10% frekans randomizasyon
- Ayak sesi: `playFootstep()` — 220ms cooldown, bandpass-filtered noise

## Monster AI — 14 Tip

| Tip | Davranış | Eklenen |
|---|---|---|
| skeleton, slime, bat, goblin, rat, spider, wraith, mushroom | Orijinal AI | v1 |
| gargoyle | skeleton AI, büyük boyut | v2 |
| dark_knight | goblin AI, yüksek HP/saldırı | v2 |
| phantom | wraith AI, hızlı | v2 |
| lava_slime | slime AI, ateş temalı | v2 |
| boss_spider_queen | boss AI, kat 5 mid-boss | v2 |
| boss_demon (Mor'Khan) | boss AI, kat 10 final boss | v1 |

Yeni canavar ekleme sırası:
1. `shared/types.ts` → `MonsterType` union + `MONSTER_STATS`
2. `server/entities/Monster.ts` → AI davranış case
3. `server/GameRoom.ts` → `MONSTER_POOL_BY_FLOOR` + gerekirse boss logic
4. `src/game/renderer/SpriteRenderer.ts` → `drawMonster` switch case
5. `src/components/game/HUD.tsx` → `XP_TO_NAME` kayıtları (2 yerde)
6. `src/components/game/LoadingScreen.tsx` → `GAME_TIPS` (opsiyonel)

## WebSocket / Tick Protokolü

- Server tick: 20 FPS (50ms), client input: ~22 FPS (45ms throttle)
- Saldırı / yetenek / etkileşim → one-shot socket event (kayıp önleme)
- Her tick'te FULL state broadcast — delta encoding yok
- **Server authoritative**: client combat sonucu ASLA hesaplamaz
- Transport: `polling` first → `websocket` upgrade (mobil güvenilirlik)
- Ping: 10s interval, 20s timeout

## Performans Kırmızı Çizgiler

- Render döngüsünde allocation yok (`new`, spread, `map`, `filter` — tümü yasak)
- Object pool pattern'ını bozma
- Quality sistemi (Low/Medium/High) FPS izleme ile çalışıyor — kendi kalite switch'i ekleme
- `useGameLoop.ts`'deki `requestAnimationFrame` tek döngüdür — ikinci açma
- `useGameSocket.ts` dışında socket instance oluşturma
- `useEffect`'te socket listener → cleanup zorunlu (`return () => socket.off`)

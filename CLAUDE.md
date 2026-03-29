# Dungeon Mates (Pixel Zindan) — Claude Code Proje Kılavuzu

## Proje Özeti

"Dungeon Mates" — browser tabanlı 2-4 oyuncu co-op pixel-art dungeon crawler.
Zephara adlı düşmüş şehirde yozlaşmış Kral Mor'Khan'ı yenmek için 10 kat zindan.

- 40 kaynak dosya, ~18.000 satır TypeScript
- 14 canavar türü, 3 oynanabilir sınıf (Savaşçı, Büyücü, Okçu)
- Tüm sprite'lar prosedürel Canvas API ile çizilir — sprite sheet yok
- Server-authoritative mimari, client sadece render eder

## Stack

| Katman | Teknoloji |
|---|---|
| Framework | Next.js 14 (App Router) |
| Gerçek Zaman | Socket.IO 4.7 (polling-first, websocket upgrade) |
| Render | HTML5 Canvas (prosedürel sprite, 480×270 / 280×210 mobil) |
| UI | React 18 + Framer Motion |
| Stil | Tailwind CSS 3.4 (dm-* custom token'lar) |
| Ses | Web Audio API synthesizer (per-floor müzik, ambient katmanlar) |
| Dil | TypeScript 5.4 (strict: true) |
| ID | nanoid |

## Geliştirme Komutları

```bash
npm run dev           # Client :3002 + Server :3001 (birlikte)
npm run build         # Frontend production build
npm run build:server  # Backend TypeScript compile
npm run start:server  # Production server
npx tsc --noEmit      # Type check — HER değişiklik sonrası çalıştır
```

## Proje Yapısı

```
shared/types.ts                    ← Tek köprü dosyası (server ↔ client)
server/
  index.ts                         ← Socket.IO giriş noktası
  GameRoom.ts (~1120)              ← Oyun döngüsü, 20 tick/sn, oda yönetimi
  entities/Monster.ts (~740)       ← 14 canavar AI
  entities/Player.ts               ← Oyuncu entity
  entities/Projectile.ts           ← Mermi entity
  dungeon/DungeonGenerator.ts (~525) ← BSP zindan üretimi, 10 kat config
src/
  app/
    page.tsx                       ← Landing (Server Component, SEO)
    game/page.tsx (~925)           ← Oyun orkestrasyonu (Client Component)
    layout.tsx, globals.css
  components/game/                 ← 18 UI bileşeni (hepsi 'use client')
    HUD.tsx (~1630)                ← Minimap, sağlık, mana, skor, boss bar
    StoryIntro.tsx                 ← Hikaye intro + 10 kat açıklaması
    BossIntro.tsx                  ← Mid-boss (kat 5) + final boss (kat 10) sinematik
    FloorTransition.tsx            ← 10 kat geçiş ekranı + lore
    WaitingScreen.tsx              ← Bağlantı bekleme + retry/back
    LoadingScreen.tsx              ← 10 kat ismi + ipuçları
    ... (ClassSelect, ChatBox, TutorialOverlay, GameOverScreen, vb.)
  components/ui/                   ← PixelButton, PixelInput
  hooks/
    useGameSocket.ts (~390)        ← Tek socket instance, reconnect, visibility handler
    useGameLoop.ts (~296)          ← requestAnimationFrame, wake lock
    useSound.ts (~98)              ← SoundManager wrapper
  game/
    renderer/
      GameRenderer.ts (~2200)      ← Ana render pipeline, freeze frame, interpolation
      SpriteRenderer.ts (~2600)    ← Prosedürel sprite çizimi (EN BÜYÜK DOSYA)
      ParticleSystem.ts (~1100)    ← Pool-based (768 parçacık)
      Camera.ts (~290)             ← Shake, zoom, look-ahead, punch
    audio/SoundManager.ts (~780)   ← Synthesizer, per-floor müzik, ambient
    input/InputManager.ts (~300)   ← Keyboard + gamepad
    input/TouchControls.ts (~590)  ← Mobil joystick + butonlar
```

## Oyun Akışı

```
Bağlantı → Lobby → Sınıf Seçimi → Hikaye İntro → Tutorial
  → Oyun (10 kat) → Kat Geçişi → Boss İntro (kat 5, 10) → Zafer/Yenilgi
```

## Hikaye: Zephara

- Zephara: düşmüş bir şehir, Kral Mor'Khan İlk Ateş'i kontrol etmeye çalışırken yozlaştı
- 3 perde yapısı: Yüzey (kat 1-4), Derinlikler (kat 5-7, mid-boss), Karanlığın Kalbi (kat 8-10, final boss)
- Mid-boss: Örümcek Kraliçe (kat 5), Final boss: Mor'Khan (kat 10)
- 10 kat isimleri: Yıkık Kapılar, Sessiz Sokaklar, Derin Tüneller, Terkedilmiş Pazar, Örümcek Kraliçe'nin İni, Yıkık Kütüphane, Taş Bahçeler, Lav Nehirleri, Ruhlar Tapınağı, Taht Salonu

## Kritik Kurallar

### Mimari
- **Server authoritative** — client combat sonucu ASLA hesaplamaz
- **Tek socket**: `useGameSocket.ts` dışında socket instance oluşturma
- **Köprü dosyası**: `shared/types.ts` — server ve client'ın tek paylaşım noktası
- **`server/` kodunu `src/` içinden import etme** — sadece `shared/types.ts` kullan

### Performans
- Render döngüsünde allocation yok (`new`, spread, `map`, `filter` yasak)
- Particle pool pattern'ını bozma (768 sabit havuz)
- `requestAnimationFrame` tek döngü — ikinci açma
- Canvas context'i frame başı yeniden alma — cache'le

### TypeScript
- `strict: true` — `as unknown as T` kullanma
- Magic string/number yasak — types.ts'deki enum/union kullan
- Yeni entity ID → `nanoid()`

### Socket.IO
- Transport: polling-first → websocket upgrade (mobil güvenilirlik)
- `useEffect`'te listener → cleanup zorunlu (`return () => socket.off`)
- Reconnect: 10 deneme, 15s timeout, visibility change handler

## Commit Formatı

```
<tip>: <kısa açıklama>

Tip'ler: feat, fix, style, refactor, docs, chore, perf
Örnek: feat: add floor 5 mid-boss encounter
```

## Aktif Skills

- `game-dev-specialist` — Canvas render, sprite, particle, monster AI, ses motoru, hit feel
- `nextjs-app-router` — Next.js 14, server/client component, Tailwind, build
- `context-management` — Büyük dosya stratejisi, agent kullanımı, bağımlılık haritası

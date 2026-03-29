---
name: nextjs-app-router
description: Activate when working on Next.js pages, layouts, API routes, server/client components, metadata, fonts, Tailwind styling, or any file inside src/app/ or src/components/ in this project.
---

# Next.js 14 App Router — Proje Kuralları

## Sayfa Yapısı

```
src/app/
  page.tsx          ← Landing (Server Component — SEO)
  layout.tsx        ← Root layout, font tanımları, metadata
  globals.css       ← Global stiller, Tailwind base, CSS animasyonları
  game/
    page.tsx        ← Oyun sayfası ('use client' zorunlu, ~925 satır)
```

## 'use client' Kuralı

**Zorunlu `'use client'`:**
- `src/app/game/page.tsx` — Canvas, Socket.IO, tüm oyun state'i
- `src/components/game/*.tsx` — 18 bileşen, hepsi client component
- `src/hooks/*.ts` — useGameSocket, useGameLoop, useSound
- `src/game/**/*.ts` — renderer, audio, input

**Server Component kalması gerekenler:**
- `src/app/page.tsx` — Landing page (SEO, metadata)
- `src/app/layout.tsx` — Font yükleme, root metadata

## Oyun Bileşenleri (src/components/game/)

| Bileşen | Sorumluluk |
|---|---|
| `HUD.tsx` (~1630 satır) | Sağlık, mana, minimap, skor, boss HP bar |
| `ClassSelect.tsx` | 3 sınıf seçimi (warrior, mage, archer) |
| `StoryIntro.tsx` | Oyun başı hikaye animasyonu + kat intro'ları |
| `BossIntro.tsx` | Mid-boss (kat 5) ve final boss (kat 10) sinematik |
| `FloorTransition.tsx` | Kat geçiş ekranı, 10 kat lore + istatistik |
| `LoadingScreen.tsx` | Kat yükleme, 10 kat isim + ipuçları |
| `WaitingScreen.tsx` | Bağlantı bekleme, retry/back butonları |
| `GameOverScreen.tsx` | Zafer/yenilgi, Zephara hikayesi |
| `TutorialOverlay.tsx` | 4 slide tutorial (kontroller, sınıflar, zindan, ipuçları) |
| `ChatBox.tsx` | Oyun içi sohbet |
| `VirtualJoystick.tsx` | Mobil dokunmatik kontroller |

## game/page.tsx Ana Akış

```
WaitingScreen (bağlantı) → Lobby → ClassSelect → StoryIntro → TutorialOverlay
  → Playing (Canvas + HUD) → FloorTransition (kat geçişi)
  → BossIntro (kat 5 veya 10) → Boss Phase → Victory/Defeat
```

Ses entegrasyonu:
- `playFloorMusic(floor)` + `startAmbience(floor)` → phase='playing' ve kat geçişlerinde
- `stopAmbience()` → boss, victory, defeat, unmount

## Environment Variables

| Değişken | Taraf | Kullanım |
|---|---|---|
| `NEXT_PUBLIC_WS_URL` | Client | Socket.IO bağlantı URL'i |
| `PORT` | Server | Socket.IO sunucu portu |
| `ALLOWED_ORIGINS` | Server | CORS origin listesi |

## Tailwind Custom Tokens

Proje `dm-*` prefix ile özel renk token'ları kullanır:
- `dm-bg`, `dm-surface`, `dm-border` — arkaplan/yüzey
- `dm-accent` — mor vurgu (#8b5cf6)
- `dm-gold` — altın (#f59e0b)
- `dm-health` — kırmızı, `dm-mana` — mavi
- `pixel-border` — utility class (pixel art border efekti)
- `glow-purple`, `glow-gold` — CSS glow efektleri

## Build Komutları

```bash
npm run dev           # Client :3002 + Server :3001 (birlikte başlar)
npm run build         # Frontend production build
npm run build:server  # Backend TypeScript compile
npm run start:server  # Production server
npx tsc --noEmit      # Type check (değişiklik sonrası mutlaka çalıştır)
```

## Yaygın Hatalar

- `useGameSocket`'i Server Component içinde import etme → runtime hatası
- `'use client'` → dosyanın en üstünde, import'lardan önce
- Framer Motion → Server Component'te kullanma
- Canvas bileşenleri → `dynamic(() => import(...), { ssr: false })` gerekebilir
- `next/image` → pixel art için `unoptimized` prop şart

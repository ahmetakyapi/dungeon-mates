# Dungeon Mates — Claude Code Proje Kılavuzu

## Commit yazarı

Commitler her zaman `Ahmet Akyapı <ahmetakyapii@gmail.com>` adına atılır;
yazarı yalnızca "Claude" olan commit atılmaz. Claude, mesajın sonundaki
`Co-Authored-By: Claude …` satırıyla ortak yazar olarak görünür. Oturum
başında, ilk committen önce:

```bash
git config user.name "Ahmet Akyapı"
git config user.email "ahmetakyapii@gmail.com"
```

Bu kural sahibinin tüm repolarında geçerli (9 Ekim 2026).

## Proje

Tarayıcıda 2-4 oyunculu (solo da açık) co-op pixel-art zindan oyunu: Zephara'nın
10 katına inip Kral Karanmir'e ulaşmak. Arayüz Türkçe.

- Next.js 14 App Router + React 18 + Framer Motion + Tailwind 3.4 (`dm-*` renkleri) · Lenis yalnız landing'de
- Socket.IO 4.7 sunucusu (`server/`, tsx) — **server authoritative**, istemci yalnız çizer
- Canvas 2D, tüm sprite'lar prosedürel (sprite sheet yok) · Web Audio synthesizer (sample yok)
- TypeScript strict, ID'ler `nanoid`

## Komutlar

```bash
npm run dev            # server :3001 (tsx watch) + client :3002 (next dev --turbo)
npm run build          # Next production build
npm run build:server   # tsc -p tsconfig.server.json → dist/server
npm run start:server   # node dist/server/index.js
npx tsc --noEmit       # tip kontrolü — her değişiklikten sonra
npm run check:<ad>     # combat · smoke · decals · hazards · revive · shop · modifiers · audio · boss
```

`check:*` betikleri `scripts/` altında, sunucusuz çalışır; `check:smoke` ayrıca
çalışan bir sunucu ister (`npm run dev:server`, port farklıysa `DM_SERVER=`).
İstemci sunucuyu `NEXT_PUBLIC_WS_URL`'den bulur (varsayılan `http://localhost:3001`).

## Yapı

```
shared/        Server ↔ client'ın TEK ortak noktası. types.ts hepsini yeniden dışa aktarır.
               constants (TICK_RATE 20), classes, monsters, combat, lore, palette, shop, talents…
server/        index.ts (Socket.IO), GameRoom.ts (oyun döngüsü, oda),
               entities/ (Player, Monster, MonsterAI, BossAI, Projectile), dungeon/DungeonGenerator.ts (BSP)
src/app/       page.tsx (landing), game/page.tsx (oyun orkestrasyonu), layout, OG görselleri
src/components/game/     Oyun içi ekranlar ve HUD
src/components/landing/  Landing bölümleri; motion/ (DungeonGate açılışı, SmoothScroll…)
src/components/fx/       Sayfa geçişleri
src/hooks/     useGameSocket (tek socket), useGameLoop (tek rAF), useSound
src/game/      renderer/ (GameRenderer, SpriteRenderer, ParticleSystem, Camera, DecalSystem…),
               audio/SoundManager, input/ (InputManager, TouchControls)
```

Canvas mantıksal çözünürlüğü masaüstünde 480×270, mobilde 360×240 (`GameRenderer.ts`).

## Oyun ve Hikâye

- **Sınıflar (4)**: Savaşçı, Büyücü, Okçu, Şifacı — `shared/classes.ts`.
- **Canavarlar**: 12 normal + 5 boss — `shared/monsters.ts` (`MonsterType`).
- **Bosslar**: kat 3 Demirci Koruyucu, 5 Selvira (Örümcek Kraliçe), 7 Taş Muhafız,
  8 Alev Şövalyesi, 10 Karanmir (final). Eşleme `GameRoom.ts` → `bossTypeMap`.
- **Anlatının tek kaynağı `shared/lore.ts`**: perdeler (Yüzey 1-4, Derinlikler 5-7,
  Ateşin Kalbi 8-10), kat adları, boss replikleri, prolog/epilog, tüccar. Kat adı,
  boss adı ya da hikâye metni bileşene elle yazılmaz, oradan okunur. Kralın adı
  **Karanmir**, enerjinin adı **Ateş-i Kadim** (eski "Mor'Khan" / "İlk Ateş" adları
  kaldırıldı). Evrenin uzun anlatımı `STORY.md`.

## Kritik Kurallar

### Mimari
- **Server authoritative** — combat sonucu istemcide ASLA hesaplanmaz.
- **Tek socket**: `useGameSocket.ts` dışında socket oluşturma.
- **`src/` içinden `server/` import etme** — yalnız `shared/`.

### Performans
- Render döngüsünde allocation yok (`new`, spread, `map`, `filter` yasak).
- Particle havuzunu bozma (`ParticleSystem.ts` → `MAX_PARTICLES` sabit havuz + free list).
- Tek `requestAnimationFrame` döngüsü (`useGameLoop`) — ikincisini açma.
- Canvas context'i her karede yeniden alma — cache'le.

### TypeScript
- `as unknown as T` kullanma (mevcut iki istisna: `useGameLoop.ts` TouchControls, `lib/haptics.ts`).
- Magic string/number yerine `shared/`'daki union/sabitler.
- Yeni entity ID → `nanoid()`.

### Socket.IO
- Transport polling-first → websocket upgrade (mobil güvenilirlik); istemci ve sunucu aynı sırada.
- İstemci: 10 reconnect denemesi, 15 sn timeout, `visibilitychange` handler.
- `useEffect` içindeki her listener cleanup'ta kaldırılır (`socket.off`).

### Landing
- İlk ziyarette piksel zindan kapısı açılışı (`DungeonGate.tsx`, sayaç yok): saf CSS
  keyframe, oturumda bir kez (sessionStorage), reduced-motion'da hiç oynamaz.
- Bölüm başlıklarının üstüne eyebrow/kicker satırı konmaz; `.dm-eyebrow` yalnız işlevsel
  etiketlerde (perde numarası, sınıf rolü, "Kontroller").
- Başlıklar Title Case, sonda nokta yok (soru işareti kalır), tek kelimelik başlık yok
  ("İn." kaldırıldı). Küçük etiketler sans, normal harf, ≥12px.
- Katlar dikey kuyu (`FloorShaft.tsx`: yapışkan derinlik göstergesi + alt alta katlar).
  Yatay kayan sabit galeri başka projelerde var, buraya geri getirme. Özel imleç yok.
- Kaydırmaya bağlı efektler yalnız transform/opacity; her karede `clip-path` (hero penceresi
  tek istisna) ve kaydırmada sayfa state'i güncellemek yok — sayılar `useTransform` ile DOM'a.

## Commit Formatı

```
<tip>: <kısa açıklama>      # tip: feat, fix, style, refactor, docs, chore, perf
```

## Skill'ler

`.claude/skills/` altında, ilgili dosyada çalışırken kendiliğinden devreye girer:
`game-dev-specialist`, `canvas-render-pipeline`, `pixel-art-sprites`, `monster-ai-design`,
`multiplayer-netcode`, `procedural-audio`, `nextjs-app-router`, `nextjs-anti-patterns`,
`nextjs-game-integration`, `game-production`, `context-management`.
Skill metinlerindeki sayılar ve adlar (ör. "14 canavar", "Mor'Khan") eskimiş olabilir —
çelişkide kod ve `shared/` geçerlidir.

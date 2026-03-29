---
name: game-production
description: Activate when planning multi-file changes, adding new game content (monsters, floors, sounds, UI), reviewing code quality, or managing the development workflow of this project.
---

# Game Production Pipeline

## Icerik Ekleme Pipeline'lari

### Yeni Canavar

```
1. shared/types.ts        → MonsterType union + MONSTER_STATS
2. server/entities/Monster.ts → AI davranis switch case
3. server/GameRoom.ts     → MONSTER_POOL_BY_FLOOR (uygun katlara weight)
4. src/game/renderer/SpriteRenderer.ts → drawMonster() switch case
5. src/components/game/HUD.tsx → XP_TO_NAME kayitlari (2 YERDE!)
6. src/components/game/LoadingScreen.tsx → GAME_TIPS (opsiyonel)
```

### Yeni Kat

```
1. server/dungeon/DungeonGenerator.ts → FLOOR_CONFIG'e kat ekle
2. server/GameRoom.ts     → MONSTER_POOL_BY_FLOOR + maxFloors guncelle
3. src/components/game/FloorTransition.tsx → FLOOR_LORE + FLOOR_QUOTES
4. src/components/game/StoryIntro.tsx → FLOOR_INTROS
5. src/components/game/LoadingScreen.tsx → FLOOR_NAMES + GAME_TIPS
6. src/game/audio/SoundManager.ts → Muzik/ambient katman ayarlari
```

### Yeni Ses

```
1. src/game/audio/SoundManager.ts → Yeni metod (oscillator + gain + envelope)
2. src/hooks/useSound.ts  → useCallback wrapper + useMemo return
3. src/app/game/page.tsx   → Uygun useEffect veya event handler'da cagir
```

### Yeni Socket Event

```
1. shared/types.ts        → ServerEvents / ClientEvents interface
2. server/GameRoom.ts     → socket.emit() veya io.to().emit()
3. src/hooks/useGameSocket.ts → socket.on() + state + cleanup
4. src/app/game/page.tsx   → Yeni state'i UI'a bagla
```

### Yeni UI Bileseni

```
1. src/components/game/YeniBilesen.tsx → 'use client' + bileseni yaz
2. src/app/game/page.tsx   → import + state + render (uygun fazda)
```

## Kalite Kontrol Listesi (Commit Oncesi)

```bash
# 1. Type check — SIFIR HATA olmali
npx tsc --noEmit

# 2. Kontrol
grep -rn "console.log" src/ server/ --include="*.ts" --include="*.tsx"  # Olmamali
grep -rn "// @ts-ignore" src/ server/ --include="*.ts" --include="*.tsx"  # Olmamali
grep -rn "as any" src/ server/ --include="*.ts" --include="*.tsx"  # Minimize et
```

### Kod Kalite Kurallari

- [ ] Magic number yok — named constant kullan
- [ ] useEffect cleanup var (socket listener, timer, event listener)
- [ ] Render dongusunde allocation yok (GameRenderer, SpriteRenderer, ParticleSystem)
- [ ] 'use client' dosyanin ilk satiri
- [ ] server/ → src/ import yok (sadece shared/types.ts kopru)
- [ ] Yeni entity ID icin `nanoid()` kullanildi

## Agent Paralellestirme Stratejisi

Bu projede 3-4 paralel agent cok etkili:

### Cakismayan Dosya Gruplari

```
Agent 1 (Ses):     SoundManager.ts + useSound.ts
Agent 2 (Render):  GameRenderer.ts + Camera.ts + SpriteRenderer.ts
Agent 3 (Server):  GameRoom.ts + Monster.ts + DungeonGenerator.ts
Agent 4 (UI):      components/game/*.tsx
```

### Kurallar

- shared/types.ts degisiyorsa → ONCE types'i degistir, SONRA agent'lari baslat
- Her agent'a bagimsiz dosya grubu ver (cakisma olmasin)
- Agent sonrasi → `npx tsc --noEmit` ile entegrasyon dogrula
- Entegrasyon noktalari (game/page.tsx, useSound.ts) → agent'lar bittikten sonra elle bagla

## Commit Formati

```
<tip>: <kisa aciklama>

Tipler: feat, fix, style, refactor, docs, chore, perf
Ornekler:
  feat: add floor 5 mid-boss encounter
  fix: mobile connection stuck on loading screen
  perf: reduce particle allocation in render loop
  refactor: extract minimap into sub-components
```

## Hikaye/Lore Tutarliligi

Yeni icerik eklerken mevcut lore'a uygunluk kontrol et:

| Terim | Aciklama | Kullanim |
|---|---|---|
| Zephara | Dusmüs sehir | Tum hikaye bunun etrafinda |
| Mor'Khan | Yozlasmis kral, final boss | Kat 10, trajik karakter |
| Ilk Ates | Guc kaynagi, Mor'Khan'i yozlastiran | Hikayenin cekirdegi |
| Orumcek Kralice | Mid-boss | Kat 5, "Zephara'nin Dokumacisi" |

### 3 Perde Yapisi

```
Perde I  (Kat 1-4): Yuzey — Yikik Kapilar, Sessiz Sokaklar, Derin Tuneller, Terkedilmis Pazar
Perde II (Kat 5-7): Derinlikler — Orumcek Kralice'nin Ini, Yikik Kutuphane, Tas Bahceler
Perde III(Kat 8-10): Karanligin Kalbi — Lav Nehirleri, Ruhlar Tapinagi, Taht Salonu
```

## Build & Deploy

```bash
npm run dev           # Gelistirme (client :3002 + server :3001)
npm run build         # Frontend production build
npm run build:server  # Backend TypeScript compile
npm run start:server  # Production server

# Deploy oncesi:
# - Environment variables kontrol (NEXT_PUBLIC_WS_URL, PORT, ALLOWED_ORIGINS)
# - npx tsc --noEmit
# - npm run build basarili mi?
```

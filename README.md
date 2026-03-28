<p align="center">
  <img src="https://img.shields.io/badge/Next.js-14-black?logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/Socket.IO-4.7-white?logo=socket.io&logoColor=white" alt="Socket.IO" />
  <img src="https://img.shields.io/badge/TypeScript-5.4-blue?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind-3.4-38bdf8?logo=tailwind-css&logoColor=white" alt="Tailwind" />
  <img src="https://img.shields.io/badge/Framer_Motion-11-ff69b4?logo=framer&logoColor=white" alt="Framer Motion" />
</p>

<h1 align="center">Dungeon Mates</h1>

<p align="center">
  <strong>Co-op Zindan Macerası</strong><br/>
  <em>2–4 kişilik gerçek zamanlı multiplayer pixel art dungeon crawler</em>
</p>

<p align="center">
  Arkadaşlarınla birlikte zindanın derinliklerine dal.<br/>
  Prosedürel olarak üretilen karanlık zindanlarda canavarlarla savaş, loot topla, boss'ları yen.
</p>

---

## Oyun Hakkında

**Dungeon Mates**, tarayıcı tabanlı bir co-op dungeon crawler oyunudur. Herhangi bir indirme veya kurulum gerektirmeden, oda kodu ile arkadaşlarını davet edip birlikte oynayabilirsin. Her oyun benzersizdir — zindanlar prosedürel olarak üretilir, canavar dağılımları rastgeledir ve zorluk oyuncu sayısına göre dinamik olarak ölçeklenir.

### Nasıl Oynanır

1. **Oda Oluştur** — 4 haneli benzersiz oda kodu al
2. **Arkadaşlarını Davet Et** — Kodu paylaş, odaya katılsınlar
3. **Sınıfını Seç** — Savaşçı, Büyücü veya Okçu
4. **Zindana Dal** — 5 kat, her katta canavarlar, son katta boss

### Kontroller

| Eylem | Masaüstü | Mobil |
|-------|----------|-------|
| Hareket | WASD / Ok Tuşları | Sol Joystick |
| Saldırı | Space | Saldırı Butonu |
| Yetenek | E | Yetenek Butonu |
| Etkileşim | R (Sandık / Merdiven) | Etkileşim Butonu |
| Sprint | Shift | — |
| Sohbet | Enter | — |

---

## Kahraman Sınıfları

<table>
  <tr>
    <td align="center"><strong>Savaşçı</strong></td>
    <td align="center"><strong>Büyücü</strong></td>
    <td align="center"><strong>Okçu</strong></td>
  </tr>
  <tr>
    <td align="center">120 HP / 15 ATK / 10 DEF</td>
    <td align="center">70 HP / 20 ATK / 3 DEF</td>
    <td align="center">90 HP / 12 ATK / 5 DEF</td>
  </tr>
  <tr>
    <td>Yakın mesafe tank. <strong>Kalkan Duvarı</strong> (E) ile hasarı %70 azaltır. Kızıl pelerin, boynuzlu miğfer, armalı kalkan.</td>
    <td>Alan hasarcı. <strong>Buz Fırtınası</strong> (E) ile çevre hasarı + yavaşlatma. Asa kristali, takımyıldızı desenli cüppesi.</td>
    <td>Uzak menzilli DPS. <strong>Ok Yağmuru</strong> (E) ile 5 ok yelpaze atış. Runik yay, ok sadağı, kukuletalı pelerin.</td>
  </tr>
</table>

---

## Canavar Ansiklopedisi

Oyunda 9 farklı canavar tipi bulunur. Her biri benzersiz AI davranışına, sprite tasarımına ve zorluk seviyesine sahiptir.

| Canavar | HP | Saldırı | Özellik |
|---------|---:|--------:|---------|
| **Fare** | 12 | 4 | Sürülerde (2–3) gelir, hızlı ve düzensiz hareket |
| **Slime** | 20 | 5 | Sıçrar, 3 renk varyantı (yeşil / buz / ateş) |
| **Yarasa** | 15 | 6 | Çok hızlı, düzensiz uçuş paterni |
| **İskelet** | 30 | 8 | Kılıçlı, kalkanlı, çene tıkırdaması |
| **Örümcek** | 25 | 7 | Ağ fırlatır → oyuncuyu yavaşlatır |
| **Mantar** | 45 | 8 | Zehir aurası, yavaşlatma, dayanıklı |
| **Hayalet** | 35 | 14 | Duvarlardan geçer, faz değiştirir (dokunulmaz) |
| **Goblin** | 40 | 10 | Savaş boyalı, dikenli sopalı, düşük HP'de kaçar |
| **Boss Demon** | 300 | 25 | Şarj saldırısı, alan hasarı, minion çağırır |

### Kat Bazlı Zorluk

- **Kat 1** — Fare, Slime, Yarasa _(giriş)_
- **Kat 2** — + İskelet, Örümcek
- **Kat 3** — + Goblin, Hayalet, Mantar
- **Kat 4** — Tüm tipler, zor ağırlıklı
- **Kat 5** — Boss Demon + minion ordusu

---

## Dinamik Zorluk Sistemi

Oyun, oyuncu sayısına göre otomatik olarak ölçeklenir:

| Özellik | Solo | 2 Kişi | 3 Kişi | 4 Kişi |
|---------|:----:|:------:|:------:|:------:|
| Harita Boyutu | 48×48 | 56×56 | 64×64 | 72×72 |
| Canavar Çarpanı | 0.7x | 1.0x | 1.5x | 2.0x |
| Canavar HP | 1.0x | 1.35x | 1.70x | 2.05x |
| Boss HP | 300 | 450 | 600 | 750 |
| Loot Çarpanı | 1.5x | 1.0x | 1.2x | 1.4x |
| XP Kazanımı | %100 | %75 | %60 | %50 |
| Kat Arası İyileşme | %40 | %30 | %25 | %20 |

---

## Teknik Mimari

```
Tarayıcı (Next.js)          WebSocket           Sunucu (Node.js)
┌──────────────────┐       (Socket.IO)       ┌──────────────────┐
│  React UI        │ ◄──────────────────────►│  GameRoom        │
│  Canvas Renderer │    gerçek zamanlı       │  Monster AI      │
│  Input Manager   │    20 tick/sn           │  Collision       │
│  Sound Engine    │                         │  Dungeon Gen     │
│  Particle System │                         │  Loot System     │
└──────────────────┘                         └──────────────────┘
         │                                           │
     shared/types.ts  ◄── Ortak tip tanımları ──►  shared/types.ts
```

### Sunucu Otoritesi

Tüm oyun mantığı sunucu tarafında çalışır. Client sadece input gönderir ve state render eder — **hile önleme** için server-authoritative mimari.

- **Tick Rate**: 20 FPS (50ms aralık)
- **Input Throttle**: Client ~22fps (45ms) ile input gönderir
- **One-shot Actions**: Saldırı / yetenek / etkileşim ayrı socket event olarak gönderilir (kayıp önleme)
- **State Broadcast**: Her tick'te tam oyun durumu tüm client'lara yayınlanır

### Render Pipeline

Oyun HTML5 Canvas üzerinde pixel-art tarzında render edilir:

1. **Mantıksal Çözünürlük** — 480×270 (masaüstü), 280×210 (mobil)
2. **Offscreen Buffer** — Piksel artifact'larını önlemek için
3. **Render Katmanları** — Zemin → Çevre Dekor → Loot → Canavarlar → Mermiler → Oyuncular → Parçacıklar → Sis → UI
4. **Dinamik Aydınlatma** — Entity bazlı ışık (meşale, oyuncu, canavar, loot)
5. **Fog of War** — 3 durumlu (gizli / keşif / görünür)
6. **Kalite Otomatiği** — FPS izleme ile otomatik kalite ayarlama (Low / Medium / High)

### Prosedürel Sprite Sistemi

Oyundaki tüm sprite'lar **prosedürel olarak çizilir** — sprite sheet kullanılmaz. Her karakter, canavar, tile ve efekt piksel piksel Canvas API ile oluşturulur:

- **~2.600 satır** sprite render kodu
- Her canavar için benzersiz animasyon (yürüme, saldırı, ölüm, özel efektler)
- Frame bazlı animasyon sistemi (8 FPS anim tick)
- Offscreen sprite cache ile performans optimizasyonu
- Hasar flash, nefes alma, pelerin dalgalanma gibi detaylar

### Parçacık Sistemi

Pool bazlı parçacık motoru (768 öncelik önbellekli parçacık):

- **30+ efekt** — Hit spark, kan, büyü patlaması, ateş izi, zehir bulutu, ağ atışı, hayalet faz, boss slam...
- **Öncelik sistemi** — Ambient parçacıklar (düşük) combat'tan önce geri dönüştürülür
- **Fizik** — Yerçekimi, sürtünme, açı bazlı hız

### Zindan Üretimi

**BSP (Binary Space Partition)** algoritması ile prosedürel zindan üretimi:

- Dengeli oda dağılımından rastgele şekilli, birbirine bağlı odalar üretir
- Oda boyutları: 7×7 – 13×13 tile arası
- Koridorlarla bağlantı, kapı yerleştirme
- Boss odası, başlangıç odası, sandık ve merdiven yerleştirme
- Harita boyutu oyuncu sayısına göre dinamik

### Ses Motoru

Web Audio API tabanlı retro ses sentezleyici:

- Prosedürel ses efektleri (dalga formu sentezi)
- Sınıf bazlı saldırı sesleri (kılıç, ateş topu, ok)
- Cooldown / debounce sistemi (ses üstüste binmez)

---

## Proje Yapısı

```
dungeon-mates/
├── shared/
│   └── types.ts                 # Ortak tip tanımları, sabitler, istatistikler
├── server/
│   ├── index.ts                 # Socket.IO sunucu giriş noktası
│   ├── GameRoom.ts              # Oda yönetimi, oyun döngüsü, combat
│   ├── entities/
│   │   ├── Player.ts            # Oyuncu entity, sınıf yetenekleri
│   │   ├── Monster.ts           # Canavar AI, 9 farklı davranış
│   │   └── Projectile.ts        # Mermi fiziği, çarpışma
│   └── dungeon/
│       └── DungeonGenerator.ts  # BSP zindan üretici
└── src/
    ├── app/
    │   ├── page.tsx             # Landing page
    │   ├── game/page.tsx        # Ana oyun sayfası (tüm fazlar)
    │   ├── layout.tsx           # Root layout, fontlar, metadata
    │   └── globals.css          # Global stiller, animasyonlar
    ├── components/
    │   ├── game/
    │   │   ├── HUD.tsx              # HP, mana, minimap, combo sayacı
    │   │   ├── ClassSelect.tsx      # Sınıf seçim ekranı
    │   │   ├── TutorialOverlay.tsx  # Oyun içi tutorial
    │   │   ├── GameOverScreen.tsx   # Bitiş istatistikleri
    │   │   ├── ChatBox.tsx          # Oyun içi sohbet
    │   │   ├── WaitingScreen.tsx    # Sunucu bekleme ekranı
    │   │   ├── VirtualJoystick.tsx  # Mobil dokunmatik kontroller
    │   │   └── ...                  # +11 diğer bileşen
    │   └── ui/
    │       ├── PixelButton.tsx      # Pixel-art buton
    │       └── PixelInput.tsx       # Pixel-art input
    ├── hooks/
    │   ├── useGameSocket.ts     # WebSocket bağlantı & event yönetimi
    │   ├── useGameLoop.ts       # Oyun döngüsü (requestAnimationFrame)
    │   └── useSound.ts          # Ses efekt yönetimi
    └── game/
        ├── renderer/
        │   ├── GameRenderer.ts      # Ana canvas render (~2.100 satır)
        │   ├── SpriteRenderer.ts    # Prosedürel sprite çizim (~2.600 satır)
        │   └── ParticleSystem.ts    # Parçacık motoru (~1.100 satır)
        ├── audio/
        │   └── SoundManager.ts      # Web Audio sentezleyici
        └── input/
            └── InputManager.ts      # Klavye + gamepad girdi yönetimi
```

**Toplam**: 38 kaynak dosya, ~15.000+ satır TypeScript

---

## Kurulum

### Gereksinimler

- Node.js 18+
- npm 9+

### Yerel Geliştirme

```bash
# Repo'yu klonla
git clone https://github.com/ahmetakyapi/dungeon-mates.git
cd dungeon-mates

# Bağımlılıkları kur
npm install

# Geliştirme sunucusunu başlat (client + server aynı anda)
npm run dev
```

Tarayıcıda aç: **http://localhost:3002**

Sunucu otomatik olarak `localhost:3001` üzerinde çalışır.

### Environment Variables

```env
NEXT_PUBLIC_WS_URL=http://localhost:3001   # WebSocket sunucu URL'i
PORT=3001                                   # Sunucu portu
ALLOWED_ORIGINS=*                           # CORS izinleri (production'da domain belirt)
```

---

## Deploy

### Frontend — Vercel

```bash
npm run build
```

Vercel'de environment variable olarak `NEXT_PUBLIC_WS_URL` değerini backend sunucu adresine ayarla.

### Backend — Render / Railway / VPS

```bash
npm run build:server
npm run start:server
```

> **Render Free Tier**: Sunucu uykuya geçebilir (~30–50sn). Oyun, sunucu uyanana kadar animasyonlu bekleme ekranı gösterir (ipuçları, ilerleme çubuğu, zindan animasyonu).

Environment variable olarak `ALLOWED_ORIGINS` değerini frontend domain'ine ayarla.

---

## Teknoloji Yığını

| Katman | Teknoloji | Amaç |
|--------|-----------|------|
| Framework | Next.js 14 (App Router) | SSR, routing, build |
| Gerçek Zaman | Socket.IO 4.7 | WebSocket multiplayer |
| Render | HTML5 Canvas | Pixel-art oyun render |
| UI | React 18 + Framer Motion | Animasyonlu arayüz |
| Stil | Tailwind CSS 3.4 | Responsive tasarım |
| Ses | Web Audio API | Prosedürel ses sentezi |
| Dil | TypeScript 5.4 (strict) | End-to-end tip güvenliği |
| ID | nanoid | Benzersiz entity kimlikleri |

---

## Özellikler

- **Gerçek Zamanlı Co-op** — 2–4 oyuncu, oda kodu ile anında bağlantı
- **Solo Mod** — Tek başına 3 canla oyna
- **Prosedürel Zindanlar** — Her oyun benzersiz harita
- **9 Canavar Tipi** — Farklı AI, sprite ve zorluk
- **3 Kahraman Sınıfı** — Benzersiz yetenekler ve oyun tarzları
- **Dinamik Zorluk** — Oyuncu sayısına göre otomatik ölçekleme
- **Pixel Art Görseller** — 2.500+ satır prosedürel sprite kodu
- **Dinamik Aydınlatma** — Entity bazlı ışık ve gölge sistemi
- **Parçacık Efektleri** — 30+ efekt, 768 parçacık havuzu
- **Mobil Destek** — Dokunmatik kontroller, responsive UI
- **Gamepad Desteği** — Xbox / PlayStation controller uyumluluğu
- **Oyun İçi Sohbet** — Gerçek zamanlı takım iletişimi
- **Fog of War** — Keşif bazlı görünüm sistemi
- **Loot Sistemi** — 5 farklı drop, sınıf bazlı denge
- **Seviye Atlama** — XP sistemi, stat büyümesi
- **Boss Savaşı** — Özel mekanikler, sahne efektleri
- **Sunucu Otoritesi** — Hile önleme mimari
- **4K Destek** — 3xl / 4xl breakpoint'ları ile ultra geniş ekran uyumu

---

<p align="center">
  <sub>Ahmet Akyapı tarafından geliştirilmiştir.</sub>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-14-black?logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/Socket.IO-4.7-white?logo=socket.io&logoColor=white" alt="Socket.IO" />
  <img src="https://img.shields.io/badge/TypeScript-5.4-blue?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind-3.4-38bdf8?logo=tailwind-css&logoColor=white" alt="Tailwind" />
  <img src="https://img.shields.io/badge/Framer_Motion-11-ff69b4?logo=framer&logoColor=white" alt="Framer Motion" />
</p>

<h1 align="center">Dungeon Mates</h1>

<p align="center">
  <strong>Co-op Zindan Macerasi</strong><br/>
  <em>2-4 kisilik gercek zamanli multiplayer pixel art dungeon crawler</em>
</p>

<p align="center">
  Arkadaslarinla birlikte zindanin derinliklerine dal.<br/>
  Prosedural olarak uretilen karanlik zindanlarda canavarlarla savas, loot topla, boss'lari yen.
</p>

---

## Oyun Hakkinda

**Dungeon Mates**, tarayici tabanli bir co-op dungeon crawler oyunudur. Herhangi bir indirme veya kurulum gerektirmeden, oda kodu ile arkadaslarini davet edip birlikte oynayabilirsin. Her oyun benzersizdir — zindanlar prosedural olarak uretilir, canavar dagilimlari rastgeledir ve zorluk oyuncu sayisina gore dinamik olarak olceklenir.

### Nasil Oynanir

1. **Oda Olustur** — 4 haneli benzersiz oda kodu al
2. **Arkadaslarini Davet Et** — Kodu paylas, odaya katilsinlar
3. **Sinifini Sec** — Savasci, Buyucu veya Okcu
4. **Zindana Dal** — 5 kat, her katta canavarlar, son katta boss

### Temel Mekanikler

| Kontrol | Masaustu | Mobil |
|---------|----------|-------|
| Hareket | WASD / Ok Tuslari | Sol Joystick |
| Saldiri | Space | Saldiri Butonu |
| Yetenek | E | Yetenek Butonu |
| Etkilesim | R (Sandik/Merdiven) | Etkilesim Butonu |
| Sprint | Shift | — |
| Sohbet | Enter | — |

---

## Kahraman Siniflari

<table>
  <tr>
    <td align="center"><strong>Savasci</strong></td>
    <td align="center"><strong>Buyucu</strong></td>
    <td align="center"><strong>Okcu</strong></td>
  </tr>
  <tr>
    <td align="center">120 HP / 15 ATK / 10 DEF</td>
    <td align="center">70 HP / 20 ATK / 3 DEF</td>
    <td align="center">90 HP / 12 ATK / 5 DEF</td>
  </tr>
  <tr>
    <td>Yakin mesafe tank. Kalkan Duvari (E) ile hasari %70 azaltir. Kizil pelerin, boynutlu migfer, arma kalkan.</td>
    <td>Alan hasarci. Buz Firtinasi (E) ile cevre hasari + yavaslatma. Asa kristali, takimyildizi desenli cuppesi.</td>
    <td>Uzak menzilli DPS. Ok Yagmuru (E) ile 5 ok yelpaze atis. Runik yay, ok sadagi, kukuletali pelerin.</td>
  </tr>
</table>

---

## Canavar Bestiary

Oyunda 9 farkli canavar tipi bulunur. Her biri benzersiz AI davranisina, sprite tasarimina ve zorluk seviyesine sahiptir.

| Canavar | HP | Saldiri | Ozellik |
|---------|---:|--------:|---------|
| **Fare** | 12 | 4 | Surulerde (2-3) gelir, hizli ve duzensiz hareket |
| **Slime** | 20 | 5 | Sicrar, 3 renk varyanti (yesil/buz/ates) |
| **Yarasa** | 15 | 6 | Cok hizli, duzensiz ucus paterni |
| **Iskelet** | 30 | 8 | Kilicli, kalkanli, cene tikirdamasi |
| **Orumcek** | 25 | 7 | Ag firlatir → oyuncuyu yavaslatir |
| **Mantar** | 45 | 8 | Zehir aurasi, yavaslatma, tanky |
| **Hayalet** | 35 | 14 | Duvarlardan gecer, faz degistirir (dokunulmaz) |
| **Goblin** | 40 | 10 | Savas boyali, diken sopali, dusuk HP'de kacar |
| **Boss Demon** | 300 | 25 | Sarj saldirisi, alan hasari, minion cagirir |

### Kat Bazli Zorluk

- **Kat 1**: Fare, Slime, Yarasa (giris)
- **Kat 2**: + Iskelet, Orumcek
- **Kat 3**: + Goblin, Hayalet, Mantar
- **Kat 4**: Tum tipler, zor agirlikli
- **Kat 5**: Boss Demon + minion ordusu

---

## Dinamik Zorluk Sistemi

Oyun, oyuncu sayisina gore otomatik olarak olceklenir:

| Ozellik | Solo | 2 Kisi | 3 Kisi | 4 Kisi |
|---------|:----:|:------:|:------:|:------:|
| Harita Boyutu | 48x48 | 56x56 | 64x64 | 72x72 |
| Canavar Carpani | 0.7x | 1.0x | 1.5x | 2.0x |
| Canavar HP | 1.0x | 1.35x | 1.70x | 2.05x |
| Boss HP | 300 | 450 | 600 | 750 |
| Loot Carpani | 1.5x | 1.0x | 1.2x | 1.4x |
| XP Kazanimi | %100 | %75 | %60 | %50 |
| Kat Arasi Iyilesme | %40 | %30 | %25 | %20 |

---

## Teknik Mimari

### Genel Bakis

```
Tarayici (Next.js)          WebSocket           Sunucu (Node.js)
+------------------+       (Socket.IO)       +------------------+
|  React UI        | <--------------------> |  GameRoom        |
|  Canvas Renderer |   gercek zamanli       |  Monster AI      |
|  Input Manager   |   20 tick/sn           |  Collision       |
|  Sound Engine    |                        |  Dungeon Gen     |
|  Particle System |                        |  Loot System     |
+------------------+                        +------------------+
        |                                           |
    shared/types.ts  <-- Ortak tip tanimlari -->  shared/types.ts
```

### Sunucu Otoritesi

Tum oyun mantigi sunucu tarafinda calisir. Client sadece input gonderir ve state render eder — **hile onleme** icin server-authoritative mimari.

- **Tick Rate**: 20 FPS (50ms aralik)
- **Input Throttle**: Client ~22fps (45ms) ile input gonderir
- **One-shot Actions**: Saldiri/yetenek/etkilesim ayri socket event olarak gonderilir (kayip onleme)
- **State Broadcast**: Her tick'te tam oyun durumu tum client'lara yayinlanir

### Render Pipeline

Oyun HTML5 Canvas uzerinde pixel-art tarzinda render edilir:

1. **Mantiksal Cozunurluk**: 480x270 (masaustu), 280x210 (mobil)
2. **Offscreen Buffer**: Piksel artifact'larini onlemek icin
3. **Render Katmanlari**: Zemin → Cevre Dekor → Loot → Canavarlar → Mermiler → Oyuncular → Parcaciklar → Sis → UI
4. **Dinamik Aydinlatma**: Entity bazli isik (mesale, oyuncu, canavar, loot)
5. **Sis Sistemi**: 3 durumlu (gizli/kesif/gorunur) fog of war
6. **Kalite Otomatigi**: FPS izleme ile otomatik kalite ayarlama (Low/Medium/High)

### Prosedural Sprite Sistemi

Oyundaki tum sprite'lar **prosedural olarak cizilir** — sprite sheet kullanilmaz. Her karakter, canavar, tile ve efekt piksel piksel Canvas API ile olusturulur:

- **2,588 satir** sprite render kodu
- Her canavar icin benzersiz animasyon (yurume, saldiri, olum, ozel efektler)
- Frame-bazli animasyon sistemi (8 FPS anim tick)
- Offscreen sprite cache ile performans optimizasyonu
- Hasar flash, nefes alma, pelerin dalgalanma gibi detaylar

### Parcacik Sistemi

Pool-bazli parcacik motoru (768 oncelik onbellekli parcacik):

- **30+ efekt**: Hit spark, kan, buyu patlamasi, ates izi, zehir bulutu, ag atisi, hayalet faz, boss slam...
- **Oncelik sistemi**: Ambient parcaciklar (dusuk) combat'tan once geri donusturulur
- **Fizik**: Yercekimi, surtunme, aci bazli hiz

### Zindan Uretimi

**BSP (Binary Space Partition)** algoritmasi ile prosedural zindan uretimi:

- Dengeli oda dagilimindan rastgele sekilli, birbirine bagli odalar uretir
- Oda boyutlari: 7x7 ile 13x13 tile arasi
- Koridorlarla baglanti, kapi yerlestirme
- Boss odasi, baslangic odasi, sandik ve merdiven yerlestirme
- Harita boyutu oyuncu sayisina gore dinamik

### Ses Motoru

Web Audio API tabanli retro ses sentezleyici:

- Prosedural ses efektleri (dalga formu sentezi)
- Sinif bazli saldiri sesleri (kilic, ates topu, ok)
- Cooldown/debounce sistemi (ses ustu uste binmez)
- Efekt bazli ayarlanabilir ses sicaklik haritasi

---

## Proje Yapisi

```
dungeon-mates/
  shared/
    types.ts                 # Ortak tip tanimlari, sabitler, istatistikler
  server/
    index.ts                 # Socket.IO sunucu giris noktasi
    GameRoom.ts              # Oda yonetimi, oyun dongusu, combat
    entities/
      Player.ts              # Oyuncu entity, sinif yetenekleri
      Monster.ts             # Canavar AI, 9 farkli davranis
      Projectile.ts          # Mermi fizigi, carpisma
    dungeon/
      DungeonGenerator.ts    # BSP zindan uretici
  src/
    app/
      page.tsx               # Landing page
      game/page.tsx           # Ana oyun sayfasi (tum fazlar)
      layout.tsx              # Root layout, fontlar, metadata
      globals.css             # Global stiller, animasyonlar
    components/
      game/
        HUD.tsx               # Heads-up display (HP, mana, minimap, combo)
        ClassSelect.tsx       # Sinif secim ekrani
        TutorialOverlay.tsx   # Oyun ici tutorial
        GameOverScreen.tsx    # Bitis istatistikleri
        ChatBox.tsx           # Oyun ici sohbet
        WaitingScreen.tsx     # Sunucu bekleme ekrani
        VirtualJoystick.tsx   # Mobil dokunmatik kontroller
        ...12 diger bilesen
      ui/
        PixelButton.tsx       # Pixel-art buton
        PixelInput.tsx        # Pixel-art input
    hooks/
      useGameSocket.ts        # WebSocket baglanti & event yonetimi
      useGameLoop.ts          # Oyun dongusu (requestAnimationFrame)
      useSound.ts             # Ses efekt yonetimi
    game/
      renderer/
        GameRenderer.ts       # Ana canvas render (2,129 satir)
        SpriteRenderer.ts     # Prosedural sprite cizim (2,588 satir)
        ParticleSystem.ts     # Parcacik motoru (1,106 satir)
      audio/
        SoundManager.ts       # Web Audio sentezleyici
      input/
        InputManager.ts       # Klavye + gamepad girdi yonetimi
```

**Toplam**: ~38 kaynak dosya, ~15,000+ satir TypeScript

---

## Kurulum

### Gereksinimler

- Node.js 18+
- npm 9+

### Yerel Gelistirme

```bash
# Repo'yu klonla
git clone https://github.com/ahmetakyapi/dungeon-mates.git
cd dungeon-mates

# Bagimliliklari kur
npm install

# Gelistirme sunucusunu baslat (client + server ayni anda)
npm run dev
```

Tarayicida ac: `http://localhost:3002`

Sunucu otomatik olarak `localhost:3001` uzerinde calisir.

### Environment Variables

```env
NEXT_PUBLIC_WS_URL=http://localhost:3001   # WebSocket sunucu URL'i
PORT=3001                                   # Sunucu portu
ALLOWED_ORIGINS=*                           # CORS izinleri
```

---

## Deploy

### Frontend (Vercel)

```bash
npm run build
```

Vercel'de environment variable olarak `NEXT_PUBLIC_WS_URL` degerini backend sunucu adresine ayarla.

### Backend (Render / Railway / VPS)

```bash
npm run build:server
npm run start:server
```

**Render Free Tier**: Sunucu uykuya gecebilir. Oyun, sunucu uyanana kadar animasyonlu bekleme ekrani gosterir (ipuclari, ilerleme cubugu, dungeon animasyonu).

Environment variable olarak `ALLOWED_ORIGINS` degerini frontend domain'ine ayarla.

---

## Teknoloji Yigini

| Katman | Teknoloji | Amac |
|--------|-----------|------|
| Framework | Next.js 14 (App Router) | SSR, routing, build |
| Gercek Zaman | Socket.IO 4.7 | WebSocket multiplayer |
| Render | HTML5 Canvas | Pixel-art oyun render |
| UI | React 18 + Framer Motion | Animasyonlu arayuz |
| Stil | Tailwind CSS 3.4 | Responsive tasarim |
| Ses | Web Audio API | Prosedural ses sentezi |
| Dil | TypeScript 5.4 (strict) | End-to-end tip guvenligi |
| ID | nanoid | Benzersiz entity kimlikleri |

---

## Ozellikler Ozeti

- **Gercek Zamanli Co-op**: 2-4 oyuncu, oda kodu ile aninda baglanti
- **Solo Mod**: Tek basina 3 canla oyna
- **Prosedural Zindanlar**: Her oyun benzersiz harita
- **9 Canavar Tipi**: Farkli AI, sprite ve zorluk
- **3 Kahraman Sinifi**: Benzersiz yetenekler ve oyun tarzlari
- **Dinamik Zorluk**: Oyuncu sayisina gore otomatik olcekleme
- **Pixel Art Gorseller**: 2,500+ satir prosedural sprite kodu
- **Dinamik Aydinlatma**: Entity bazli isik ve golge sistemi
- **Parcacik Efektleri**: 30+ efekt, 768 parcacik havuzu
- **Mobil Destek**: Dokunmatik kontroller, responsive UI
- **Gamepad Destegi**: Xbox/PlayStation controller uyumlulugu
- **Oyun Ici Sohbet**: Gercek zamanli takim iletisimi
- **Fog of War**: Kesif bazli gorunum sistemi
- **Loot Sistemi**: 5 farkli drop, sinif bazli denge
- **Seviye Atlama**: XP sistemi, stat buyumesi
- **Boss Savasi**: Ozel mekanikler, sahne efektleri
- **Prosedural Ses**: Web Audio sentezleyici, sinif bazli efektler
- **Sunucu Otoritesi**: Hile onleme mimari
- **4K Destek**: 3xl/4xl breakpoint'lari ile ultra genis ekran uyumu

---

<p align="center">
  <sub>Ahmet Akyapi tarafindan gelistirilmistir.</sub>
</p>

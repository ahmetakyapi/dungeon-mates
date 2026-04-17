/**
 * SoundManager - Web Audio API based retro/8-bit sound synthesizer
 * Singleton pattern, lazy AudioContext initialization (requires user gesture)
 */

type NoteFrequency = number;

const NOTES: Record<string, NoteFrequency> = {
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00, A3: 220.00, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.00, B5: 987.77,
  C6: 1046.50,
  // Minor notes
  Eb3: 155.56, Ab3: 207.65, Bb3: 233.08,
  Eb4: 311.13, Ab4: 415.30, Bb4: 466.16,
  Eb5: 622.25,
} as const;

export class SoundManager {
  private static instance: SoundManager;
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private masterVolume = 0.5;
  private sfxVolume = 0.7;
  private musicVolume = 0.3;
  private muted = false;
  private musicIntervals: ReturnType<typeof setInterval>[] = [];
  private ambientIntervals: ReturnType<typeof setInterval>[] = [];
  private noiseBuffer: AudioBuffer | null = null;
  private lastPlayTime: Map<string, number> = new Map();

  private canPlay(id: string, cooldownMs: number): boolean {
    const now = performance.now();
    const last = this.lastPlayTime.get(id) ?? 0;
    if (now - last < cooldownMs) return false;
    this.lastPlayTime.set(id, now);
    return true;
  }

  static getInstance(): SoundManager {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager();
    }
    return SoundManager.instance;
  }

  private constructor() {}

  private getContext(): AudioContext | null {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return null;
      }

      // Master gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.masterVolume;
      this.masterGain.connect(this.ctx.destination);

      // SFX gain
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxVolume;
      this.sfxGain.connect(this.masterGain);

      // Music gain
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicVolume;
      this.musicGain.connect(this.masterGain);

      // Pre-generate noise buffer
      this.noiseBuffer = this.createNoiseBuffer();
    }

    // Resume if suspended (browser autoplay policy)
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    return this.ctx;
  }

  private createNoiseBuffer(): AudioBuffer {
    const ctx = this.ctx!;
    const bufferSize = ctx.sampleRate * 0.5; // 500ms of noise
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private playNoise(duration: number, volume: number, filterFreq?: number, filterType?: BiquadFilterType, startTime?: number): void {
    const ctx = this.getContext();
    if (!ctx || !this.noiseBuffer || !this.sfxGain) return;

    const t0 = startTime ?? ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);

    if (filterFreq !== undefined) {
      const filter = ctx.createBiquadFilter();
      filter.type = filterType ?? 'lowpass';
      filter.frequency.value = filterFreq;
      source.connect(filter);
      filter.connect(gain);
    } else {
      source.connect(gain);
    }

    gain.connect(this.sfxGain);
    source.start(t0);
    source.stop(t0 + duration);
  }

  private playTone(
    freq: number,
    duration: number,
    waveform: OscillatorType = 'square',
    volume: number = 0.3,
    freqEnd?: number,
    startTime?: number,
    destination?: AudioNode,
  ): OscillatorNode | null {
    const ctx = this.getContext();
    if (!ctx) return null;
    const dest = destination ?? this.sfxGain!;
    const start = startTime ?? ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = waveform;
    osc.frequency.setValueAtTime(freq, start);
    if (freqEnd !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 20), start + duration);
    }

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(start);
    osc.stop(start + duration);

    return osc;
  }

  private playNotes(
    notes: NoteFrequency[],
    noteDuration: number,
    gap: number,
    waveform: OscillatorType = 'square',
    volume: number = 0.25,
  ): void {
    const ctx = this.getContext();
    if (!ctx) return;
    notes.forEach((freq, i) => {
      const startTime = ctx.currentTime + i * gap;
      this.playTone(freq, noteDuration, waveform, volume, undefined, startTime);
    });
  }

  // =====================
  // SFX - Attack Sounds
  // =====================

  playSwordSlash(): void {
    if (!this.canPlay('swordSlash', 150)) return;
    const variation = 0.9 + Math.random() * 0.2; // 90-110%
    // White noise burst
    this.playNoise(0.12, 0.25, 3000 * variation, 'highpass');
    // Descending frequency sweep
    this.playTone(800 * variation, 0.15, 'sawtooth', 0.15, 200 * variation);
    // Quick click at start
    this.playTone(1200 * variation, 0.03, 'square', 0.1);
  }

  playArrowShoot(): void {
    if (!this.canPlay('arrowShoot', 100)) return;
    const variation = 0.9 + Math.random() * 0.2; // 90-110%
    // Quick ascending "twang"
    this.playTone(400 * variation, 0.08, 'sine', 0.2, 1200 * variation);
    // Follow-up high ping
    const ctx = this.getContext();
    if (!ctx) return;
    this.playTone(1800 * variation, 0.06, 'sine', 0.1, 2400 * variation, ctx.currentTime + 0.05);
  }

  playFireball(): void {
    if (!this.canPlay('fireball', 200)) return;
    const variation = 0.9 + Math.random() * 0.2; // 90-110%
    const ctx = this.getContext();
    if (!ctx) return;
    // Low rumble ascending
    this.playTone(80 * variation, 0.25, 'sawtooth', 0.2, 400 * variation);
    // Noise burst mid-way — use Web Audio scheduling instead of setTimeout to avoid drift/pops
    this.playNoise(0.15, 0.15, 800 * variation, 'lowpass', ctx.currentTime + 0.1);
    // High crackle
    this.playTone(200 * variation, 0.3, 'sawtooth', 0.1, 600 * variation, ctx.currentTime + 0.05);
  }

  // =====================
  // SFX - Hit/Damage
  // =====================

  playHit(): void {
    if (!this.canPlay('hit', 80)) return;
    // Pitch + filter variation for organic per-hit feel
    const pitch = 0.8 + Math.random() * 0.35; // 80-115%
    const filterCut = 1600 + Math.random() * 900;
    // Short noise burst + square wave
    this.playNoise(0.08, 0.3, filterCut, 'lowpass');
    this.playTone(300 * pitch, 0.08, 'square', 0.2, 100 * pitch);
    // Low thump body
    this.playTone(90 * pitch, 0.05, 'sine', 0.15);
  }

  playCriticalHit(): void {
    if (!this.canPlay('criticalHit', 150)) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const pitch = 0.95 + Math.random() * 0.1;
    // Louder hit + sub-bass thump for crit weight
    this.playNoise(0.12, 0.5, 2500, 'lowpass');
    this.playTone(400 * pitch, 0.1, 'square', 0.3, 150 * pitch);
    this.playTone(60, 0.12, 'sine', 0.28); // sub-bass
    // Shimmer arpeggio (C-E-G ascending)
    const base = 880 * pitch;
    this.playTone(base, 0.1, 'sine', 0.2, 1800, ctx.currentTime + 0.04);
    this.playTone(base * 1.26, 0.1, 'sine', 0.2, 2200, ctx.currentTime + 0.08);
    this.playTone(base * 1.5, 0.14, 'sine', 0.22, 2600, ctx.currentTime + 0.12);
  }

  // ===== Elemental hit SFX — Faz 4 =====

  playFireHit(): void {
    if (!this.canPlay('fireHit', 100)) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const pitch = 0.9 + Math.random() * 0.2;
    // Low crackle + descending burst
    this.playNoise(0.12, 0.35, 900, 'bandpass');
    this.playTone(180 * pitch, 0.15, 'sawtooth', 0.22, 60 * pitch);
    // Spark snap
    this.playTone(1200 * pitch, 0.04, 'square', 0.14);
  }

  playIceHit(): void {
    if (!this.canPlay('iceHit', 100)) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const pitch = 0.92 + Math.random() * 0.18;
    // High crystalline ping + shimmer
    this.playTone(1800 * pitch, 0.12, 'sine', 0.2, 2400 * pitch);
    this.playTone(2600 * pitch, 0.1, 'sine', 0.14, 3200 * pitch, ctx.currentTime + 0.02);
    this.playNoise(0.08, 0.2, 4500, 'highpass');
  }

  playPoisonHit(): void {
    if (!this.canPlay('poisonHit', 100)) return;
    const pitch = 0.85 + Math.random() * 0.2;
    // Low throb + bubbling noise
    this.playTone(140 * pitch, 0.22, 'triangle', 0.2, 80 * pitch);
    this.playNoise(0.1, 0.25, 700, 'lowpass');
  }

  playHolyHit(): void {
    if (!this.canPlay('holyHit', 100)) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const pitch = 0.95 + Math.random() * 0.1;
    // Detuned sine stack — major triad C-E-G for choir feel
    const base = 520 * pitch;
    this.playTone(base, 0.3, 'sine', 0.15);
    this.playTone(base * 1.25, 0.3, 'sine', 0.12, undefined, ctx.currentTime + 0.01);
    this.playTone(base * 1.5, 0.3, 'sine', 0.1, undefined, ctx.currentTime + 0.02);
    // Sparkle
    this.playTone(base * 3, 0.1, 'sine', 0.08, base * 4, ctx.currentTime + 0.05);
  }

  playComboTier(tier: number): void {
    if (!this.canPlay(`combo_${tier}`, 200)) return;
    const ctx = this.getContext();
    if (!ctx) return;
    // Ascending notes per tier for escalating satisfaction
    const baseFreq = 440 * (1 + tier * 0.25);
    this.playTone(baseFreq, 0.08, 'sine', 0.18);
    this.playTone(baseFreq * 1.5, 0.08, 'sine', 0.15, undefined, ctx.currentTime + 0.05);
    if (tier >= 2) {
      this.playTone(baseFreq * 2, 0.12, 'sine', 0.13, undefined, ctx.currentTime + 0.1);
    }
  }

  playPlayerHurt(): void {
    if (!this.canPlay('playerHurt', 300)) return;
    // Descending square wave
    this.playTone(600, 0.25, 'square', 0.2, 150);
    this.playNoise(0.08, 0.15, 1000, 'lowpass');
  }

  playMonsterHurt(): void {
    if (!this.canPlay('monsterHurt', 100)) return;
    // Short low noise burst
    this.playNoise(0.06, 0.25, 600, 'lowpass');
    this.playTone(200, 0.06, 'square', 0.15, 80);
  }

  playDeath(): void {
    if (!this.canPlay('death', 1000)) return;
    const ctx = this.getContext();
    if (!ctx) return;
    // Long descending sweep
    this.playTone(800, 0.6, 'square', 0.2, 60);
    // Noise fade
    this.playNoise(0.5, 0.2, 1500, 'lowpass');
    // Secondary descending tone
    this.playTone(600, 0.8, 'sawtooth', 0.1, 30, ctx.currentTime + 0.15);
  }

  // =====================
  // SFX - Loot/Pickup
  // =====================

  playLootPickup(): void {
    if (!this.canPlay('lootPickup', 150)) return;
    // Quick ascending 3-note arpeggio (C-E-G)
    this.playNotes([NOTES.C5, NOTES.E5, NOTES.G5], 0.08, 0.065, 'square', 0.2);
  }

  playGoldPickup(): void {
    if (!this.canPlay('goldPickup', 100)) return;
    const ctx = this.getContext();
    if (!ctx) return;
    // Coin "ching" - high sine ping
    this.playTone(1400, 0.08, 'sine', 0.2);
    this.playTone(2100, 0.1, 'sine', 0.15, undefined, ctx.currentTime + 0.04);
  }

  playHealthPotion(): void {
    if (!this.canPlay('healthPotion', 300)) return;
    // Gentle ascending sweep
    this.playTone(300, 0.25, 'sine', 0.15, 800);
    const ctx = this.getContext();
    if (!ctx) return;
    this.playTone(500, 0.2, 'triangle', 0.1, 1000, ctx.currentTime + 0.1);
  }

  // =====================
  // SFX - UI
  // =====================

  playButtonClick(): void {
    if (!this.canPlay('buttonClick', 100)) return;
    this.playTone(800, 0.03, 'square', 0.15);
  }

  playMenuOpen(): void {
    if (!this.canPlay('menuOpen', 300)) return;
    this.playTone(400, 0.1, 'square', 0.12, 800);
  }

  playMenuClose(): void {
    if (!this.canPlay('menuClose', 300)) return;
    this.playTone(800, 0.1, 'square', 0.12, 400);
  }

  // =====================
  // SFX - Game Events
  // =====================

  playRoomCleared(): void {
    if (!this.canPlay('roomCleared', 1000)) return;
    // Victory fanfare: C-E-G-C(high)
    this.playNotes([NOTES.C4, NOTES.E4, NOTES.G4, NOTES.C5], 0.12, 0.12, 'square', 0.2);
  }

  playLevelUp(): void {
    if (!this.canPlay('levelUp', 1000)) return;
    const ctx = this.getContext();
    if (!ctx) return;
    // Ascending arpeggio with shimmer
    const notes = [NOTES.C4, NOTES.E4, NOTES.G4, NOTES.C5, NOTES.E5];
    notes.forEach((freq, i) => {
      const t = ctx.currentTime + i * 0.1;
      this.playTone(freq, 0.2, 'square', 0.18, undefined, t);
      // Shimmer overtone
      this.playTone(freq * 2, 0.15, 'sine', 0.06, undefined, t);
    });
  }

  playBossAppear(): void {
    if (!this.canPlay('bossAppear', 1000)) return;
    const ctx = this.getContext();
    if (!ctx) return;
    // Deep rumble
    this.playTone(50, 0.8, 'sawtooth', 0.25, 30);
    // Dramatic low note
    this.playTone(80, 0.6, 'square', 0.15, 40, ctx.currentTime + 0.3);
    // Noise rumble
    this.playNoise(0.8, 0.15, 200, 'lowpass');
    // Ominous high note
    this.playTone(NOTES.Eb4, 0.4, 'sawtooth', 0.08, undefined, ctx.currentTime + 0.6);
  }

  playFloorComplete(): void {
    if (!this.canPlay('floorComplete', 2000)) return;
    // Full ascending scale: C-D-E-F-G-A-B-C
    const notes = [NOTES.C4, NOTES.D4, NOTES.E4, NOTES.F4, NOTES.G4, NOTES.A4, NOTES.B4, NOTES.C5];
    this.playNotes(notes, 0.1, 0.09, 'square', 0.18);
  }

  playVictory(): void {
    if (!this.canPlay('victory', 2000)) return;
    const ctx = this.getContext();
    if (!ctx) return;
    // First arpeggio: C-E-G
    const arp1 = [NOTES.C4, NOTES.E4, NOTES.G4];
    arp1.forEach((freq, i) => {
      this.playTone(freq, 0.2, 'square', 0.2, undefined, ctx.currentTime + i * 0.12);
    });
    // Second arpeggio higher: C-E-G-C
    const arp2 = [NOTES.C5, NOTES.E5, NOTES.G5, NOTES.C6];
    arp2.forEach((freq, i) => {
      const t = ctx.currentTime + 0.5 + i * 0.12;
      this.playTone(freq, 0.25, 'square', 0.18, undefined, t);
      this.playTone(freq * 0.5, 0.2, 'triangle', 0.06, undefined, t);
    });
    // Final sustain chord
    const chordTime = ctx.currentTime + 1.1;
    [NOTES.C5, NOTES.E5, NOTES.G5].forEach((freq) => {
      this.playTone(freq, 0.5, 'sine', 0.1, undefined, chordTime);
    });
  }

  playDefeat(): void {
    if (!this.canPlay('defeat', 2000)) return;
    const ctx = this.getContext();
    if (!ctx) return;
    // Sad descending minor notes
    const notes = [NOTES.Eb4, NOTES.C4, NOTES.Ab3, NOTES.Eb3];
    notes.forEach((freq, i) => {
      this.playTone(freq, 0.25, 'square', 0.18, undefined, ctx.currentTime + i * 0.2);
    });
    // Low rumble at end
    this.playTone(60, 0.6, 'sawtooth', 0.08, 30, ctx.currentTime + 0.7);
  }

  playDoorOpen(): void {
    if (!this.canPlay('doorOpen', 500)) return;
    const ctx = this.getContext();
    if (!ctx) return;
    // Creaking: noise with filter sweep
    if (!this.noiseBuffer || !this.sfxGain) return;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(200, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.3);
    filter.Q.value = 5;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    source.start(ctx.currentTime);
    source.stop(ctx.currentTime + 0.35);
  }

  playChestOpen(): void {
    if (!this.canPlay('chestOpen', 500)) return;
    const ctx = this.getContext();
    if (!ctx) return;
    // Creak
    this.playDoorOpen();
    // Magical shimmer
    const shimmerNotes = [NOTES.E5, NOTES.G5, NOTES.B5, NOTES.E5];
    shimmerNotes.forEach((freq, i) => {
      this.playTone(freq, 0.12, 'sine', 0.1, undefined, ctx.currentTime + 0.15 + i * 0.07);
    });
    // Coin sounds
    this.playTone(2000, 0.06, 'sine', 0.12, undefined, ctx.currentTime + 0.35);
    this.playTone(2400, 0.06, 'sine', 0.1, undefined, ctx.currentTime + 0.4);
  }

  playStairsDescend(): void {
    if (!this.canPlay('stairsDescend', 1000)) return;
    const ctx = this.getContext();
    if (!ctx) return;
    // Echoing descending notes
    const notes = [NOTES.G4, NOTES.E4, NOTES.C4, NOTES.G3, NOTES.E3, NOTES.C3];
    notes.forEach((freq, i) => {
      const t = ctx.currentTime + i * 0.09;
      this.playTone(freq, 0.2, 'triangle', 0.15 - i * 0.02, undefined, t);
    });
  }

  // =====================
  // SFX - Footsteps
  // =====================

  playFootstep(): void {
    if (!this.canPlay('footstep', 220)) return;
    const ctx = this.getContext();
    if (!ctx || !this.noiseBuffer || !this.sfxGain) return;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 400 + Math.random() * 400;
    filter.Q.value = 2;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    source.start();
    source.stop(ctx.currentTime + 0.05);
  }

  // =====================
  // Music Helpers
  // =====================

  private playMusicNote(freq: number, type: OscillatorType, duration: number, volume: number): void {
    const ctx = this.getContext();
    if (!ctx || !this.musicGain) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);
    osc.connect(gain);
    gain.connect(this.musicGain);
    osc.start();
    osc.stop(ctx.currentTime + duration / 1000);
  }

  private playMusicPercussion(duration: number, volume: number): void {
    const ctx = this.getContext();
    if (!ctx || !this.noiseBuffer || !this.musicGain) return;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1000;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    source.start();
    source.stop(ctx.currentTime + duration / 1000);
  }

  // =====================
  // Music
  // =====================

  playFloorMusic(floor: number): void {
    this.stopMusic();
    const ctx = this.getContext();
    if (!ctx || !this.musicGain) return;

    const tempo = 60 + Math.min(floor - 1, 8) * 3; // 60-84 BPM
    const stepMs = (60000 / tempo) / 2; // 8th notes

    // Base notes (C minor pentatonic)
    const baseNotes = [130.81, 155.56, 174.61, 196.00, 233.08]; // C3, Eb3, F3, G3, Bb3
    // Melody notes (higher octave)
    const melodyNotes = [261.63, 311.13, 349.23, 392.00, 466.16]; // C4, Eb4, F4, G4, Bb4

    let step = 0;
    const interval = setInterval(() => {
      if (this.muted || !this.musicGain) return;

      // Bass layer (all floors)
      if (step % 4 === 0) {
        this.playMusicNote(
          baseNotes[step % baseNotes.length] * (floor >= 5 ? 0.5 : 1),
          'triangle',
          stepMs * 3,
          0.12,
        );
      }

      // Melody layer (floor 3+)
      if (floor >= 3 && step % 2 === 0) {
        const noteIdx = (step + floor) % melodyNotes.length;
        this.playMusicNote(melodyNotes[noteIdx], 'sine', stepMs * 1.5, 0.06);
      }

      // Dissonance layer (floor 5+)
      if (floor >= 5 && step % 3 === 0) {
        this.playMusicNote(
          melodyNotes[step % melodyNotes.length] * 1.03,
          'sawtooth',
          stepMs,
          0.03,
        );
      }

      // Percussion (floor 7+)
      if (floor >= 7 && (step % 4 === 0 || (floor >= 9 && step % 2 === 0))) {
        this.playMusicPercussion(stepMs * 0.3, 0.08);
      }

      step++;
    }, stepMs);

    this.musicIntervals.push(interval);
  }

  playDungeonMusic(): void {
    this.playFloorMusic(1);
  }

  playBossMusic(): void {
    this.stopMusic();
    const ctx = this.getContext();
    if (!ctx || !this.musicGain) return;

    // Intense, faster pattern
    const bassPattern = [NOTES.C3, NOTES.C3, NOTES.Eb3, NOTES.C3, NOTES.G3, NOTES.C3, NOTES.Eb3, NOTES.Bb3];
    const melodyPattern = [NOTES.C4, NOTES.Eb4, NOTES.G4, NOTES.Eb4, NOTES.C4, NOTES.Bb3, NOTES.Ab3, NOTES.G3];
    let step = 0;
    const bpm = 140;
    const stepDuration = 60 / bpm;

    const interval = setInterval(() => {
      if (this.muted || !this.musicGain) return;

      const bassFreq = bassPattern[step % bassPattern.length];
      const melFreq = melodyPattern[step % melodyPattern.length];

      // Aggressive bass
      this.playTone(bassFreq, stepDuration * 0.6, 'sawtooth', 0.07, undefined, undefined, this.musicGain!);

      // Melody
      this.playTone(melFreq, stepDuration * 0.4, 'square', 0.05, undefined, undefined, this.musicGain!);

      // Kick on even beats
      if (step % 2 === 0) {
        this.playTone(60, 0.08, 'sine', 0.06, 30, undefined, this.musicGain!);
      }

      step++;
    }, stepDuration * 1000);

    this.musicIntervals.push(interval);
  }

  stopMusic(): void {
    this.musicIntervals.forEach((id) => clearInterval(id));
    this.musicIntervals = [];
  }

  // =====================
  // Ambient Sounds
  // =====================

  startAmbience(floor: number): void {
    this.stopAmbience();
    if (!this.getContext()) return;
    if (!this.sfxGain) return;

    // Water drip — all floors, more frequent on deeper floors
    const dripInterval = setInterval(() => {
      if (this.muted) return;
      if (Math.random() < 0.3 + floor * 0.05) {
        this.playDrip();
      }
    }, 2000 + Math.random() * 3000);
    this.ambientIntervals.push(dripInterval);

    // Wind — floors 3+
    if (floor >= 3) {
      const windInterval = setInterval(() => {
        if (this.muted) return;
        this.playWind();
      }, 5000 + Math.random() * 5000);
      this.ambientIntervals.push(windInterval);
    }

    // Whispers — floors 6+
    if (floor >= 6) {
      const whisperInterval = setInterval(() => {
        if (this.muted) return;
        this.playWhisper();
      }, 8000 + Math.random() * 7000);
      this.ambientIntervals.push(whisperInterval);
    }

    // Heartbeat — floor 9+
    if (floor >= 9) {
      const heartbeatInterval = setInterval(() => {
        if (this.muted) return;
        this.playHeartbeat();
      }, 800);
      this.ambientIntervals.push(heartbeatInterval);
    }
  }

  stopAmbience(): void {
    this.ambientIntervals.forEach((id) => clearInterval(id));
    this.ambientIntervals = [];
  }

  private playDrip(): void {
    const ctx = this.getContext();
    if (!ctx || !this.sfxGain) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200 + Math.random() * 800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  }

  private playWind(): void {
    const ctx = this.getContext();
    if (!ctx || !this.noiseBuffer || !this.sfxGain) return;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 300 + Math.random() * 200;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.03, ctx.currentTime + 0.5);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 2);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    source.start();
    source.stop(ctx.currentTime + 2.1);
  }

  private playWhisper(): void {
    const ctx = this.getContext();
    if (!ctx || !this.sfxGain) return;
    // Multiple detuned sine waves for eerie whisper
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 200 + Math.random() * 300 + i * 50;
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.015, ctx.currentTime + 0.3);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.5);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start();
      osc.stop(ctx.currentTime + 1.6);
    }
  }

  private playHeartbeat(): void {
    const ctx = this.getContext();
    if (!ctx || !this.sfxGain) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 40;
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  }

  // =====================
  // Volume Control
  // =====================

  setMasterVolume(vol: number): void {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    const ctx = this.getContext();
    if (this.masterGain && ctx) {
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.masterVolume, ctx.currentTime);
    }
  }

  getMasterVolume(): number {
    return this.masterVolume;
  }

  setSfxVolume(vol: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, vol));
    const ctx = this.getContext();
    if (this.sfxGain && ctx) {
      this.sfxGain.gain.setValueAtTime(this.sfxVolume, ctx.currentTime);
    }
  }

  getSfxVolume(): number {
    return this.sfxVolume;
  }

  setMusicVolume(vol: number): void {
    this.musicVolume = Math.max(0, Math.min(1, vol));
    const ctx = this.getContext();
    if (this.musicGain && ctx) {
      this.musicGain.gain.setValueAtTime(this.musicVolume, ctx.currentTime);
    }
  }

  getMusicVolume(): number {
    return this.musicVolume;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    const ctx = this.getContext();
    if (this.masterGain && ctx) {
      this.masterGain.gain.setValueAtTime(
        this.muted ? 0 : this.masterVolume,
        ctx.currentTime,
      );
    }
    return this.muted;
  }

  isMutedState(): boolean {
    return this.muted;
  }

  destroy(): void {
    this.stopMusic();
    this.stopAmbience();
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
    this.masterGain = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.noiseBuffer = null;
  }
}

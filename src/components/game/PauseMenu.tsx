'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PixelButton } from '@/components/ui/PixelButton';
import { useSound } from '@/hooks/useSound';

const EASE = [0.22, 1, 0.36, 1] as const;

type PauseMenuProps = {
  isOpen: boolean;
  isSolo: boolean;
  onResume: () => void;
  onRestart?: () => void;
  onLeave: () => void;
};

const MENU_ITEMS_MULTIPLAYER = [
  { key: 'resume', label: 'Devam Et', icon: '▶️', variant: 'primary' as const },
  { key: 'controls', label: 'Kontroller', icon: '🎮', variant: 'secondary' as const },
  { key: 'sound', label: 'Ses Ayarları', icon: '🔊', variant: 'secondary' as const },
  { key: 'leave', label: 'Çıkış', icon: '🚪', variant: 'danger' as const },
] as const;

const MENU_ITEMS_SOLO = [
  { key: 'resume', label: 'Devam Et', icon: '▶️', variant: 'primary' as const },
  { key: 'restart', label: 'Yeniden Başla', icon: '🔄', variant: 'gold' as const },
  { key: 'controls', label: 'Kontroller', icon: '🎮', variant: 'secondary' as const },
  { key: 'sound', label: 'Ses Ayarları', icon: '🔊', variant: 'secondary' as const },
  { key: 'leave', label: 'Çıkış', icon: '🚪', variant: 'danger' as const },
] as const;

function ControlsInfo() {
  return (
    <motion.div
      className="mt-4 flex flex-col gap-3 rounded border border-dm-border bg-dm-bg/60 p-4"
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.3, ease: EASE }}
    >
      <p className="font-pixel text-[9px] text-dm-accent">Masaüstü</p>
      <div className="grid grid-cols-2 gap-2 text-[10px] text-zinc-400">
        <span>W/A/S/D</span><span>Hareket</span>
        <span>Space</span><span>Saldırı</span>
        <span>E</span><span>Yetenek</span>
        <span>ESC</span><span>Menü</span>
      </div>
      <div className="h-px bg-dm-border" />
      <p className="font-pixel text-[9px] text-dm-accent">Mobil</p>
      <div className="grid grid-cols-2 gap-2 text-[10px] text-zinc-400">
        <span>Sol Joystick</span><span>Hareket</span>
        <span>Sağ Butonlar</span><span>Saldırı & Yetenek</span>
      </div>
    </motion.div>
  );
}

function SoundSettings() {
  const sound = useSound();
  const [masterVol, setMasterVol] = useState(() => sound.getMasterVolume() * 100);
  const [sfxVol, setSfxVol] = useState(() => sound.getSfxVolume() * 100);
  const [musicVol, setMusicVol] = useState(() => sound.getMusicVolume() * 100);
  const [muted, setMuted] = useState(() => sound.isMuted());

  const handleMasterChange = useCallback((val: number) => {
    setMasterVol(val);
    sound.setMasterVolume(val / 100);
  }, [sound]);

  const handleSfxChange = useCallback((val: number) => {
    setSfxVol(val);
    sound.setSfxVolume(val / 100);
  }, [sound]);

  const handleMusicChange = useCallback((val: number) => {
    setMusicVol(val);
    sound.setMusicVolume(val / 100);
  }, [sound]);

  const handleToggleMute = useCallback(() => {
    const newMuted = sound.toggleMute() ?? false;
    setMuted(newMuted);
  }, [sound]);

  return (
    <motion.div
      className="mt-4 flex flex-col gap-4 rounded border border-dm-border bg-dm-bg/60 p-4"
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.3, ease: EASE }}
    >
      {/* Master Volume */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="font-pixel text-[9px] text-dm-accent">Ana Ses</span>
          <span className="font-pixel text-[8px] text-zinc-500">{Math.round(masterVol)}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={masterVol}
          onChange={(e) => handleMasterChange(Number(e.target.value))}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-zinc-800 accent-dm-accent [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-dm-accent"
        />
      </div>

      {/* SFX Volume */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="font-pixel text-[9px] text-zinc-400">Efektler</span>
          <span className="font-pixel text-[8px] text-zinc-500">{Math.round(sfxVol)}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={sfxVol}
          onChange={(e) => handleSfxChange(Number(e.target.value))}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-zinc-800 accent-dm-gold [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-dm-gold"
        />
      </div>

      {/* Music Volume */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="font-pixel text-[9px] text-zinc-400">Müzik</span>
          <span className="font-pixel text-[8px] text-zinc-500">{Math.round(musicVol)}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={musicVol}
          onChange={(e) => handleMusicChange(Number(e.target.value))}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-zinc-800 accent-dm-xp [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-dm-xp"
        />
      </div>

      {/* Mute Toggle */}
      <button
        onClick={handleToggleMute}
        className={`flex items-center justify-center gap-2 rounded border px-3 py-2 font-pixel text-[9px] transition-colors ${
          muted
            ? 'border-dm-health/40 bg-dm-health/10 text-dm-health'
            : 'border-dm-border bg-dm-surface text-zinc-400 hover:border-dm-accent/30 hover:text-zinc-300'
        }`}
      >
        <span>{muted ? '🔇' : '🔊'}</span>
        {muted ? 'Sessiz (Açık)' : 'Sessiz'}
      </button>
    </motion.div>
  );
}

export function PauseMenu({
  isOpen,
  isSolo,
  onResume,
  onRestart,
  onLeave,
}: PauseMenuProps) {
  const [showControls, setShowControls] = useState(false);
  const [showSound, setShowSound] = useState(false);

  const handleAction = useCallback(
    (key: string) => {
      switch (key) {
        case 'resume':
          onResume();
          break;
        case 'restart':
          onRestart?.();
          break;
        case 'controls':
          setShowControls((prev) => !prev);
          setShowSound(false);
          break;
        case 'sound':
          setShowSound((prev) => !prev);
          setShowControls(false);
          break;
        case 'leave':
          onLeave();
          break;
      }
    },
    [onResume, onRestart, onLeave],
  );

  // ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onResume();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onResume]);

  // Reset panels when menu closes
  useEffect(() => {
    if (!isOpen) {
      setShowControls(false);
      setShowSound(false);
    }
  }, [isOpen]);

  const menuItems = isSolo ? MENU_ITEMS_SOLO : MENU_ITEMS_MULTIPLAYER;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: EASE }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
            onClick={onResume}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Menu card */}
          <motion.div
            className="glass-strong relative z-10 mx-4 w-full max-w-sm overflow-hidden rounded-2xl p-6 sm:p-8"
            initial={{ scale: 0.85, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.85, opacity: 0, y: 20 }}
            transition={{ duration: 0.35, ease: EASE }}
          >
            {/* Title */}
            <h2 className="glow-purple mb-6 text-center font-pixel text-base text-dm-accent sm:text-lg">
              Duraklatıldı
            </h2>

            {/* Menu items */}
            <div className="flex flex-col gap-3">
              {menuItems.map((item, i) => (
                <motion.div
                  key={item.key}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.05 * i, duration: 0.3, ease: EASE }}
                >
                  <PixelButton
                    variant={item.variant}
                    fullWidth
                    onClick={() => handleAction(item.key)}
                  >
                    <span className="mr-2">{item.icon}</span>
                    {item.label}
                  </PixelButton>
                </motion.div>
              ))}
            </div>

            {/* Controls panel */}
            <AnimatePresence>
              {showControls && <ControlsInfo />}
            </AnimatePresence>

            {/* Sound settings panel */}
            <AnimatePresence>
              {showSound && <SoundSettings />}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

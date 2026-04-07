'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// --- Settings persistence ---
const SETTINGS_KEY = 'dm_settings';

export type GameSettings = {
  masterVolume: number;    // 0-1
  sfxVolume: number;       // 0-1
  musicVolume: number;     // 0-1
  showFps: boolean;
  screenShake: boolean;
  particles: 'high' | 'medium' | 'low';
  quality: 'high' | 'medium' | 'low';
  showDamageNumbers: boolean;
  showMinimap: boolean;
};

const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 0.7,
  sfxVolume: 0.8,
  musicVolume: 0.5,
  showFps: false,
  screenShake: true,
  particles: 'high',
  quality: 'high',
  showDamageNumbers: true,
  showMinimap: true,
};

export function loadSettings(): GameSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (!stored) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: GameSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch { /* ignore */ }
}

// --- Volume Slider ---
function VolumeSlider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 text-[10px] text-gray-300">{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-gray-700 accent-purple-500"
      />
      <span className="w-8 text-right text-[9px] text-gray-400">{Math.round(value * 100)}%</span>
    </div>
  );
}

// --- Toggle ---
function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-gray-300">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={`h-5 w-9 rounded-full transition-colors ${value ? 'bg-purple-500' : 'bg-gray-600'}`}
      >
        <div
          className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-4' : 'translate-x-0.5'}`}
        />
      </button>
    </div>
  );
}

// --- Select ---
function Select({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-gray-300">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded bg-gray-700 px-2 py-0.5 text-[10px] text-gray-200 outline-none"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

// --- Main Settings Menu ---
type SettingsMenuProps = {
  isOpen: boolean;
  onClose: () => void;
  settings: GameSettings;
  onSettingsChange: (settings: GameSettings) => void;
};

export function SettingsMenu({ isOpen, onClose, settings, onSettingsChange }: SettingsMenuProps) {
  const update = useCallback((partial: Partial<GameSettings>) => {
    const next = { ...settings, ...partial };
    onSettingsChange(next);
    saveSettings(next);
  }, [settings, onSettingsChange]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="w-80 rounded-xl border border-purple-500/30 bg-gray-900/95 p-5 shadow-2xl backdrop-blur"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 text-center text-sm font-bold text-purple-300">Ayarlar</h2>

            {/* Audio */}
            <div className="mb-4">
              <h3 className="mb-2 text-[9px] font-bold uppercase tracking-wider text-gray-500">Ses</h3>
              <div className="space-y-2">
                <VolumeSlider label="Ana Ses" value={settings.masterVolume} onChange={(v) => update({ masterVolume: v })} />
                <VolumeSlider label="Efektler" value={settings.sfxVolume} onChange={(v) => update({ sfxVolume: v })} />
                <VolumeSlider label="Müzik" value={settings.musicVolume} onChange={(v) => update({ musicVolume: v })} />
              </div>
            </div>

            {/* Display */}
            <div className="mb-4">
              <h3 className="mb-2 text-[9px] font-bold uppercase tracking-wider text-gray-500">Görüntü</h3>
              <div className="space-y-2">
                <Select
                  label="Kalite"
                  value={settings.quality}
                  options={[
                    { value: 'high', label: 'Yüksek' },
                    { value: 'medium', label: 'Orta' },
                    { value: 'low', label: 'Düşük' },
                  ]}
                  onChange={(v) => update({ quality: v as GameSettings['quality'] })}
                />
                <Select
                  label="Parçacık Efektleri"
                  value={settings.particles}
                  options={[
                    { value: 'high', label: 'Yüksek' },
                    { value: 'medium', label: 'Orta' },
                    { value: 'low', label: 'Düşük' },
                  ]}
                  onChange={(v) => update({ particles: v as GameSettings['particles'] })}
                />
                <Toggle label="FPS Göster" value={settings.showFps} onChange={(v) => update({ showFps: v })} />
                <Toggle label="Hasar Rakamları" value={settings.showDamageNumbers} onChange={(v) => update({ showDamageNumbers: v })} />
                <Toggle label="Minimap" value={settings.showMinimap} onChange={(v) => update({ showMinimap: v })} />
              </div>
            </div>

            {/* Gameplay */}
            <div className="mb-4">
              <h3 className="mb-2 text-[9px] font-bold uppercase tracking-wider text-gray-500">Oyun</h3>
              <div className="space-y-2">
                <Toggle label="Ekran Sarsıntısı" value={settings.screenShake} onChange={(v) => update({ screenShake: v })} />
              </div>
            </div>

            {/* Close */}
            <button
              onClick={onClose}
              className="mt-2 w-full rounded-lg bg-purple-600/80 py-1.5 text-[11px] font-bold text-white transition hover:bg-purple-500"
            >
              Kapat
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// --- useSettings hook ---
export function useSettings() {
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  const updateSettings = useCallback((next: GameSettings) => {
    setSettings(next);
    saveSettings(next);
  }, []);

  return { settings, updateSettings };
}

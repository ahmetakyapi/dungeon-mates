'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { SoundManager } from '@/game/audio/SoundManager';

export function useSound() {
  const managerRef = useRef<SoundManager | null>(null);

  const getManager = useCallback((): SoundManager | null => {
    if (typeof window === 'undefined') return null;
    if (!managerRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { SoundManager: SM } = require('@/game/audio/SoundManager') as { SoundManager: typeof SoundManager };
      managerRef.current = SM.getInstance();
    }
    return managerRef.current;
  }, []);

  // Init AudioContext on first user interaction
  useEffect(() => {
    const initAudio = () => {
      getManager();
      window.removeEventListener('click', initAudio);
      window.removeEventListener('touchstart', initAudio);
    };
    window.addEventListener('click', initAudio, { once: true });
    window.addEventListener('touchstart', initAudio, { once: true });
    return () => {
      window.removeEventListener('click', initAudio);
      window.removeEventListener('touchstart', initAudio);
    };
  }, [getManager]);

  const playSwordSlash = useCallback(() => getManager()?.playSwordSlash(), [getManager]);
  const playArrowShoot = useCallback(() => getManager()?.playArrowShoot(), [getManager]);
  const playFireball = useCallback(() => getManager()?.playFireball(), [getManager]);
  const playHit = useCallback(() => getManager()?.playHit(), [getManager]);
  const playCriticalHit = useCallback(() => getManager()?.playCriticalHit(), [getManager]);
  const playFireHit = useCallback(() => getManager()?.playFireHit(), [getManager]);
  const playIceHit = useCallback(() => getManager()?.playIceHit(), [getManager]);
  const playPoisonHit = useCallback(() => getManager()?.playPoisonHit(), [getManager]);
  const playHolyHit = useCallback(() => getManager()?.playHolyHit(), [getManager]);
  const playComboTier = useCallback((tier: number) => getManager()?.playComboTier(tier), [getManager]);
  const playPlayerHurt = useCallback(() => getManager()?.playPlayerHurt(), [getManager]);
  const playMonsterHurt = useCallback(() => getManager()?.playMonsterHurt(), [getManager]);
  const playDeath = useCallback(() => getManager()?.playDeath(), [getManager]);
  const playLootPickup = useCallback(() => getManager()?.playLootPickup(), [getManager]);
  const playGoldPickup = useCallback(() => getManager()?.playGoldPickup(), [getManager]);
  const playHealthPotion = useCallback(() => getManager()?.playHealthPotion(), [getManager]);
  const playButtonClick = useCallback(() => getManager()?.playButtonClick(), [getManager]);
  const playMenuOpen = useCallback(() => getManager()?.playMenuOpen(), [getManager]);
  const playMenuClose = useCallback(() => getManager()?.playMenuClose(), [getManager]);
  const playRoomCleared = useCallback(() => getManager()?.playRoomCleared(), [getManager]);
  const playLevelUp = useCallback(() => getManager()?.playLevelUp(), [getManager]);
  const playBossAppear = useCallback(() => getManager()?.playBossAppear(), [getManager]);
  const playFloorComplete = useCallback(() => getManager()?.playFloorComplete(), [getManager]);
  const playVictory = useCallback(() => getManager()?.playVictory(), [getManager]);
  const playDefeat = useCallback(() => getManager()?.playDefeat(), [getManager]);
  const playDoorOpen = useCallback(() => getManager()?.playDoorOpen(), [getManager]);
  const playChestOpen = useCallback(() => getManager()?.playChestOpen(), [getManager]);
  const playStairsDescend = useCallback(() => getManager()?.playStairsDescend(), [getManager]);
  const playFootstep = useCallback((floor?: number) => getManager()?.playFootstep(floor), [getManager]);
  const playHolyBolt = useCallback(() => getManager()?.playHolyBolt(), [getManager]);
  const playBossPhaseMusic = useCallback((phase: number) => getManager()?.playBossPhaseMusic(phase), [getManager]);
  const duckMusic = useCallback((durationMs?: number, depth?: number) => getManager()?.duckMusic(durationMs, depth), [getManager]);
  const playDungeonMusic = useCallback(() => getManager()?.playDungeonMusic(), [getManager]);
  const playFloorMusic = useCallback((floor: number) => getManager()?.playFloorMusic(floor), [getManager]);
  const playBossMusic = useCallback(() => getManager()?.playBossMusic(), [getManager]);
  const stopMusic = useCallback(() => getManager()?.stopMusic(), [getManager]);
  const startAmbience = useCallback((floor: number) => getManager()?.startAmbience(floor), [getManager]);
  const stopAmbience = useCallback(() => getManager()?.stopAmbience(), [getManager]);
  const setMasterVolume = useCallback((v: number) => getManager()?.setMasterVolume(v), [getManager]);
  const setSfxVolume = useCallback((v: number) => getManager()?.setSfxVolume(v), [getManager]);
  const setMusicVolume = useCallback((v: number) => getManager()?.setMusicVolume(v), [getManager]);
  const toggleMute = useCallback(() => getManager()?.toggleMute(), [getManager]);
  const isMuted = useCallback(() => getManager()?.isMutedState() ?? false, [getManager]);
  const getMasterVolume = useCallback(() => getManager()?.getMasterVolume() ?? 0.5, [getManager]);
  const getSfxVolume = useCallback(() => getManager()?.getSfxVolume() ?? 0.7, [getManager]);
  const getMusicVolume = useCallback(() => getManager()?.getMusicVolume() ?? 0.3, [getManager]);

  return useMemo(() => ({
    playSwordSlash, playArrowShoot, playFireball, playHolyBolt,
    playHit, playCriticalHit, playFireHit, playIceHit, playPoisonHit, playHolyHit, playComboTier,
    playPlayerHurt, playMonsterHurt, playDeath,
    playLootPickup, playGoldPickup, playHealthPotion,
    playButtonClick, playMenuOpen, playMenuClose,
    playRoomCleared, playLevelUp, playBossAppear, playFloorComplete,
    playVictory, playDefeat, playDoorOpen, playChestOpen, playStairsDescend,
    playFootstep,
    playDungeonMusic, playFloorMusic, playBossMusic, playBossPhaseMusic, duckMusic, stopMusic,
    startAmbience, stopAmbience,
    setMasterVolume, setSfxVolume, setMusicVolume,
    toggleMute, isMuted, getMasterVolume, getSfxVolume, getMusicVolume,
  }), [
    playSwordSlash, playArrowShoot, playFireball, playHolyBolt,
    playHit, playCriticalHit, playFireHit, playIceHit, playPoisonHit, playHolyHit, playComboTier,
    playPlayerHurt, playMonsterHurt, playDeath,
    playLootPickup, playGoldPickup, playHealthPotion,
    playButtonClick, playMenuOpen, playMenuClose,
    playRoomCleared, playLevelUp, playBossAppear, playFloorComplete,
    playVictory, playDefeat, playDoorOpen, playChestOpen, playStairsDescend,
    playFootstep,
    playDungeonMusic, playFloorMusic, playBossMusic, playBossPhaseMusic, duckMusic, stopMusic,
    startAmbience, stopAmbience,
    setMasterVolume, setSfxVolume, setMusicVolume,
    toggleMute, isMuted, getMasterVolume, getSfxVolume, getMusicVolume,
  ]);
}

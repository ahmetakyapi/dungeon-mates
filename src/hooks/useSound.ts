'use client';

import { useCallback, useEffect, useRef } from 'react';
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

  return {
    // Attack
    playSwordSlash: useCallback(() => getManager()?.playSwordSlash(), [getManager]),
    playArrowShoot: useCallback(() => getManager()?.playArrowShoot(), [getManager]),
    playFireball: useCallback(() => getManager()?.playFireball(), [getManager]),
    // Hit/damage
    playHit: useCallback(() => getManager()?.playHit(), [getManager]),
    playCriticalHit: useCallback(() => getManager()?.playCriticalHit(), [getManager]),
    playPlayerHurt: useCallback(() => getManager()?.playPlayerHurt(), [getManager]),
    playMonsterHurt: useCallback(() => getManager()?.playMonsterHurt(), [getManager]),
    playDeath: useCallback(() => getManager()?.playDeath(), [getManager]),
    // Loot
    playLootPickup: useCallback(() => getManager()?.playLootPickup(), [getManager]),
    playGoldPickup: useCallback(() => getManager()?.playGoldPickup(), [getManager]),
    playHealthPotion: useCallback(() => getManager()?.playHealthPotion(), [getManager]),
    // UI
    playButtonClick: useCallback(() => getManager()?.playButtonClick(), [getManager]),
    playMenuOpen: useCallback(() => getManager()?.playMenuOpen(), [getManager]),
    playMenuClose: useCallback(() => getManager()?.playMenuClose(), [getManager]),
    // Game events
    playRoomCleared: useCallback(() => getManager()?.playRoomCleared(), [getManager]),
    playLevelUp: useCallback(() => getManager()?.playLevelUp(), [getManager]),
    playBossAppear: useCallback(() => getManager()?.playBossAppear(), [getManager]),
    playFloorComplete: useCallback(() => getManager()?.playFloorComplete(), [getManager]),
    playVictory: useCallback(() => getManager()?.playVictory(), [getManager]),
    playDefeat: useCallback(() => getManager()?.playDefeat(), [getManager]),
    playDoorOpen: useCallback(() => getManager()?.playDoorOpen(), [getManager]),
    playChestOpen: useCallback(() => getManager()?.playChestOpen(), [getManager]),
    playStairsDescend: useCallback(() => getManager()?.playStairsDescend(), [getManager]),
    // Music
    playDungeonMusic: useCallback(() => getManager()?.playDungeonMusic(), [getManager]),
    playBossMusic: useCallback(() => getManager()?.playBossMusic(), [getManager]),
    stopMusic: useCallback(() => getManager()?.stopMusic(), [getManager]),
    // Volume
    setMasterVolume: useCallback((v: number) => getManager()?.setMasterVolume(v), [getManager]),
    setSfxVolume: useCallback((v: number) => getManager()?.setSfxVolume(v), [getManager]),
    setMusicVolume: useCallback((v: number) => getManager()?.setMusicVolume(v), [getManager]),
    toggleMute: useCallback(() => getManager()?.toggleMute(), [getManager]),
    isMuted: useCallback(() => getManager()?.isMutedState() ?? false, [getManager]),
    getMasterVolume: useCallback(() => getManager()?.getMasterVolume() ?? 0.5, [getManager]),
    getSfxVolume: useCallback(() => getManager()?.getSfxVolume() ?? 0.7, [getManager]),
    getMusicVolume: useCallback(() => getManager()?.getMusicVolume() ?? 0.3, [getManager]),
  };
}

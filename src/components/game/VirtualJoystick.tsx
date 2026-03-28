'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const JOYSTICK_SIZE = 120;
const THUMB_SIZE = 44;
const MAX_DISTANCE = (JOYSTICK_SIZE - THUMB_SIZE) / 2;
const EASE = [0.22, 1, 0.36, 1] as const;

type VirtualJoystickProps = {
  /** Player's current HP (0-max) */
  playerHp?: number;
  /** Player's max HP */
  playerMaxHp?: number;
  /** Current floor number */
  currentFloor?: number;
  /** Attack cooldown progress 0-1 (0 = ready, 1 = full cooldown) */
  attackCooldown?: number;
  /** Skill cooldown progress 0-1 */
  skillCooldown?: number;
  /** Callback when attack is pressed */
  onAttack?: () => void;
  /** Callback when skill is pressed */
  onSkill?: () => void;
  /** Callback when interact is pressed */
  onInteract?: () => void;
  /** Whether interact button should be visible */
  showInteract?: boolean;
};

export function VirtualJoystick({
  playerHp = 0,
  playerMaxHp = 100,
  currentFloor = 1,
  attackCooldown = 0,
  skillCooldown = 0,
  onAttack,
  onSkill,
  onInteract,
  showInteract = false,
}: VirtualJoystickProps) {
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const joystickRef = useRef<HTMLDivElement>(null);
  const [thumbPos, setThumbPos] = useState({ x: 0, y: 0 });
  const [isPressed, setIsPressed] = useState(false);

  // Detect touch device
  useEffect(() => {
    const isTouch = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
    setIsTouchDevice(isTouch);
    if (isTouch) {
      // Fade in
      const timer = setTimeout(() => setIsVisible(true), 100);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      setIsPressed(true);
      updateThumb(e.touches[0]);
    },
    [],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      updateThumb(e.touches[0]);
    },
    [],
  );

  const handleTouchEnd = useCallback(() => {
    setIsPressed(false);
    setThumbPos({ x: 0, y: 0 });
  }, []);

  const updateThumb = (touch: React.Touch | undefined) => {
    if (!touch || !joystickRef.current) return;
    const rect = joystickRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = touch.clientX - centerX;
    const dy = touch.clientY - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const clampedDist = Math.min(dist, MAX_DISTANCE);
    const angle = Math.atan2(dy, dx);
    setThumbPos({
      x: Math.cos(angle) * clampedDist,
      y: Math.sin(angle) * clampedDist,
    });
  };

  const haptic = useCallback(() => {
    try {
      if ('vibrate' in navigator) navigator.vibrate(10);
    } catch { /* ignore */ }
  }, []);

  if (!isTouchDevice) return null;

  const hpPercent = playerMaxHp > 0 ? Math.max(0, Math.min(100, (playerHp / playerMaxHp) * 100)) : 0;
  const hpColor = hpPercent > 50 ? '#4ade80' : hpPercent > 25 ? '#fbbf24' : '#ef4444';

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="pointer-events-none absolute inset-0 z-30 game-safe-area"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: EASE }}
        >
          {/* Floor number — top center on mobile */}
          <div className="absolute left-1/2 top-2 -translate-x-1/2 sm:hidden">
            <div className="rounded border border-dm-border bg-dm-bg/80 px-3 py-1 backdrop-blur-sm">
              <span className="font-pixel text-[8px] text-dm-gold">
                Kat {currentFloor}
              </span>
            </div>
          </div>

          {/* Joystick area — bottom left */}
          <div
            ref={joystickRef}
            className="pointer-events-auto absolute bottom-8 left-8"
            style={{ width: JOYSTICK_SIZE, height: JOYSTICK_SIZE }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* Outer ring */}
            <motion.div
              className="absolute inset-0 rounded-full border-2 bg-white/5"
              animate={{
                borderColor: isPressed ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.2)',
                boxShadow: isPressed
                  ? '0 0 15px rgba(139,92,246,0.3)'
                  : '0 0 0px transparent',
              }}
              transition={{ duration: 0.15 }}
              style={{ width: JOYSTICK_SIZE, height: JOYSTICK_SIZE }}
            />

            {/* Inner thumb */}
            <motion.div
              className="absolute rounded-full border-2 border-white/40 bg-white/20"
              animate={{
                x: thumbPos.x,
                y: thumbPos.y,
                backgroundColor: isPressed ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.2)',
              }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              style={{
                width: THUMB_SIZE,
                height: THUMB_SIZE,
                left: JOYSTICK_SIZE / 2 - THUMB_SIZE / 2,
                top: JOYSTICK_SIZE / 2 - THUMB_SIZE / 2,
              }}
            />
          </div>

          {/* Mini health bar near joystick */}
          <div
            className="pointer-events-none absolute bottom-4 left-8"
            style={{ width: JOYSTICK_SIZE }}
          >
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800/80">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: hpColor }}
                animate={{ width: `${hpPercent}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>

          {/* Action buttons — right side */}

          {/* Attack button — large, red */}
          <motion.button
            className="pointer-events-auto absolute bottom-12 right-6 flex h-[70px] w-[70px] items-center justify-center rounded-full border-2 border-dm-health/40 bg-dm-health/15"
            whileTap={{ scale: 0.85 }}
            onTouchStart={(e) => {
              e.stopPropagation();
              haptic();
              onAttack?.();
            }}
          >
            {/* Cooldown overlay */}
            {attackCooldown > 0 && (
              <svg
                className="absolute inset-0 -rotate-90"
                viewBox="0 0 70 70"
              >
                <circle
                  cx="35"
                  cy="35"
                  r="33"
                  fill="none"
                  stroke="rgba(0,0,0,0.5)"
                  strokeWidth="4"
                  strokeDasharray={`${attackCooldown * 207.3} 207.3`}
                />
              </svg>
            )}
            <span className="text-2xl">⚔️</span>
          </motion.button>

          {/* Skill button — purple, above attack */}
          <motion.button
            className="pointer-events-auto absolute bottom-[120px] right-10 flex h-[55px] w-[55px] items-center justify-center rounded-full border-2 border-dm-accent/40 bg-dm-accent/15"
            whileTap={{ scale: 0.85 }}
            onTouchStart={(e) => {
              e.stopPropagation();
              haptic();
              onSkill?.();
            }}
          >
            {/* Cooldown overlay */}
            {skillCooldown > 0 && (
              <svg
                className="absolute inset-0 -rotate-90"
                viewBox="0 0 55 55"
              >
                <circle
                  cx="27.5"
                  cy="27.5"
                  r="25.5"
                  fill="none"
                  stroke="rgba(0,0,0,0.5)"
                  strokeWidth="4"
                  strokeDasharray={`${skillCooldown * 160.2} 160.2`}
                />
              </svg>
            )}
            <span className="text-xl">✨</span>
          </motion.button>

          {/* Interact button — small, blue, only when near interactive object */}
          <AnimatePresence>
            {showInteract && (
              <motion.button
                className="pointer-events-auto absolute bottom-[180px] right-14 flex h-[30px] w-[30px] items-center justify-center rounded-full border-2 border-blue-500/50 bg-blue-500/15"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: EASE }}
                whileTap={{ scale: 0.85 }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  haptic();
                  onInteract?.();
                }}
              >
                <span className="text-xs">🔑</span>
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

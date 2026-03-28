'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PixelButton } from '@/components/ui/PixelButton';

const EASE = [0.22, 1, 0.36, 1] as const;
const SHOW_LEAVE_AFTER_MS = 10_000;

type DisconnectOverlayProps = {
  isDisconnected: boolean;
  onLeave: () => void;
};

export function DisconnectOverlay({ isDisconnected, onLeave }: DisconnectOverlayProps) {
  const [showLeave, setShowLeave] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [countdown, setCountdown] = useState(5);

  // Reset state when reconnected
  useEffect(() => {
    if (!isDisconnected) {
      setShowLeave(false);
      setRetryCount(0);
      setCountdown(5);
      return;
    }

    // Show leave button after 10 seconds
    const leaveTimer = setTimeout(() => setShowLeave(true), SHOW_LEAVE_AFTER_MS);

    return () => clearTimeout(leaveTimer);
  }, [isDisconnected]);

  // Countdown for retry
  useEffect(() => {
    if (!isDisconnected) return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setRetryCount((r) => r + 1);
          return 5;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isDisconnected]);

  const handleLeave = useCallback(() => {
    onLeave();
  }, [onLeave]);

  return (
    <AnimatePresence>
      {isDisconnected && (
        <motion.div
          className="fixed inset-0 z-[95] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: EASE }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/80 backdrop-blur-lg" />

          {/* Content */}
          <motion.div
            className="relative z-10 mx-4 flex w-full max-w-sm flex-col items-center gap-6"
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            transition={{ duration: 0.4, ease: EASE }}
          >
            {/* Spinner */}
            <div className="relative h-20 w-20">
              <motion.div
                className="absolute inset-0 rounded-full border-4 border-dm-border"
                style={{ borderTopColor: '#8b5cf6' }}
                animate={{ rotate: 360 }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl">🔌</span>
              </div>
            </div>

            {/* Text */}
            <div className="flex flex-col items-center gap-2">
              <h2 className="font-pixel text-sm text-dm-health sm:text-base">
                Bağlantı Koptu
              </h2>
              <motion.p
                className="font-pixel text-[10px] text-zinc-400"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                Yeniden bağlanılıyor...
              </motion.p>
            </div>

            {/* Retry info */}
            <div className="flex flex-col items-center gap-1">
              <p className="font-pixel text-[9px] text-zinc-500">
                Sonraki deneme: {countdown}sn
              </p>
              <p className="font-pixel text-[8px] text-zinc-600">
                Deneme #{retryCount + 1}
              </p>
            </div>

            {/* Leave button (shown after delay) */}
            <AnimatePresence>
              {showLeave && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: EASE }}
                >
                  <PixelButton variant="secondary" onClick={handleLeave}>
                    Ana Menüye Dön
                  </PixelButton>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

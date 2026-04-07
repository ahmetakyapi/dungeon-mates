'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const EASE = [0.22, 1, 0.36, 1] as const;
const TOAST_DURATION = 3000;
const MAX_TOASTS = 4;

export type ToastType = 'info' | 'success' | 'warning' | 'danger';

export type Toast = {
  id: string;
  text: string;
  icon: string;
  type: ToastType;
};

export const TOAST_COLORS: Record<ToastType, string> = {
  info: '#3b82f6',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
} as const;

export const TOAST_BG: Record<ToastType, string> = {
  info: 'border-blue-500/30 bg-blue-950/60',
  success: 'border-emerald-500/30 bg-emerald-950/60',
  warning: 'border-amber-500/30 bg-amber-950/60',
  danger: 'border-red-500/30 bg-red-950/60',
} as const;

let toastIdCounter = 0;
export function createToastId(): string {
  toastIdCounter += 1;
  return `toast_${toastIdCounter}_${Date.now()}`;
}

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const addToast = useCallback((text: string, icon: string, type: ToastType) => {
    const id = createToastId();
    setToasts((prev) => [...prev.slice(-(MAX_TOASTS - 1)), { id, text, icon, type }]);

    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      timersRef.current.delete(id);
    }, TOAST_DURATION);

    timersRef.current.set(id, timer);
  }, []);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
    };
  }, []);

  return { toasts, addToast };
}

export function ToastList({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="pointer-events-none absolute right-2 top-10 z-30 flex flex-col items-end gap-1.5 sm:right-4 sm:top-16 sm:gap-2">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            layout
            className={`pointer-events-none flex items-center gap-2 rounded-lg border px-3 py-1.5 backdrop-blur-md sm:px-4 sm:py-2 ${TOAST_BG[toast.type]}`}
            initial={{ x: 80, opacity: 0, scale: 0.85 }}
            animate={{ x: 0, opacity: 1, scale: 1 }}
            exit={{ x: 80, opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3, ease: EASE }}
          >
            <span className="text-xs sm:text-sm">{toast.icon}</span>
            <span
              className="font-pixel text-[7px] sm:text-[8px] lg:text-[9px] xl:text-[10px] 2xl:text-[12px]"
              style={{ color: TOAST_COLORS[toast.type] }}
            >
              {toast.text}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

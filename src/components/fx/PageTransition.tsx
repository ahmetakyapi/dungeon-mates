'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { PixelShutter } from './PixelShutter';
import { EASE_OUT_EXPO, prefersReducedMotion } from '@/lib/motion';

type NavigateOptions = {
  /** Shown in the middle of the covered screen, e.g. "Zindana iniliyor". */
  label?: string;
  /** Accent for the wavefront. */
  edge?: string;
  /** Sweep direction — down into the dungeon, up out of it. */
  direction?: 'down' | 'up';
};

type TransitionApi = {
  navigate: (href: string, opts?: NavigateOptions) => void;
  busy: boolean;
};

const TransitionContext = createContext<TransitionApi | null>(null);

type Stage = 'idle' | 'cover' | 'hold' | 'reveal';

/** Longest we keep the screen covered waiting for the next route to mount. */
const MAX_HOLD_MS = 4000;
/** Shortest hold, so the label is readable rather than a flicker. */
const MIN_HOLD_MS = 260;

/**
 * Route transitions.
 *
 * `navigate()` covers the screen with the pixel shutter, pushes the route while
 * covered, waits for the new pathname to mount, then lifts the shutter. Wrapped
 * around the whole app in the root layout, so it survives the route change it is
 * hiding.
 */
export function PageTransitionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [stage, setStage] = useState<Stage>('idle');
  const [opts, setOpts] = useState<NavigateOptions>({});
  const target = useRef<string | null>(null);
  const fromPath = useRef<string>(pathname);
  const heldAt = useRef(0);

  const navigate = useCallback((href: string, o: NavigateOptions = {}) => {
    if (stage !== 'idle') return;
    if (prefersReducedMotion()) { router.push(href); return; }
    router.prefetch(href);
    target.current = href;
    fromPath.current = pathname;
    setOpts(o);
    setStage('cover');
  }, [stage, router, pathname]);

  const onCovered = useCallback(() => {
    if (!target.current) return;
    heldAt.current = performance.now();
    setStage('hold');
    router.push(target.current);
  }, [router]);

  // Lift once the new route is on screen, or give up waiting.
  useEffect(() => {
    if (stage !== 'hold') return;
    const targetPath = target.current?.split('?')[0] ?? '';
    const arrived = pathname !== fromPath.current || targetPath === fromPath.current;
    const elapsed = performance.now() - heldAt.current;
    const wait = arrived ? Math.max(0, MIN_HOLD_MS - elapsed) : MAX_HOLD_MS;
    const t = window.setTimeout(() => setStage('reveal'), wait);
    return () => window.clearTimeout(t);
  }, [stage, pathname]);

  const onRevealed = useCallback(() => {
    target.current = null;
    setStage('idle');
  }, []);

  const edge = opts.edge ?? '#9184d9';

  return (
    <TransitionContext.Provider value={{ navigate, busy: stage !== 'idle' }}>
      {children}

      {stage === 'cover' && (
        <PixelShutter mode="cover" edge={edge} direction={opts.direction} onDone={onCovered} />
      )}
      {stage === 'hold' && (
        <div aria-hidden className="pointer-events-auto fixed inset-0" style={{ zIndex: 200, background: '#07080f' }} />
      )}
      {stage === 'reveal' && (
        <PixelShutter mode="reveal" edge={edge} direction={opts.direction} onDone={onRevealed} durationMs={820} />
      )}

      <AnimatePresence>
        {(stage === 'cover' || stage === 'hold') && opts.label && (
          <motion.div
            key="label"
            className="pointer-events-none fixed inset-0 flex flex-col items-center justify-center gap-4"
            style={{ zIndex: 201 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { delay: 0.35, duration: 0.3 } }}
            exit={{ opacity: 0, transition: { duration: 0.18 } }}
          >
            <div className="overflow-hidden">
              <motion.p
                className="font-mono text-[11px] uppercase tracking-[0.42em] text-zinc-300"
                initial={{ y: '110%' }}
                animate={{ y: 0, transition: { delay: 0.4, duration: 0.6, ease: EASE_OUT_EXPO } }}
              >
                {opts.label}
              </motion.p>
            </div>
            {/* An indeterminate bar in blocks — the shutter's own grain. */}
            <div className="flex gap-[3px]">
              {Array.from({ length: 12 }).map((_, i) => (
                <span
                  key={i}
                  className="dm-loader-block block h-[6px] w-[6px]"
                  style={{ animationDelay: `${i * 70}ms`, background: edge }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </TransitionContext.Provider>
  );
}

/**
 * Navigate with the pixel transition. Falls back to a plain push outside the
 * provider so a component can be rendered in isolation.
 */
export function useTransitionRouter(): TransitionApi {
  const ctx = useContext(TransitionContext);
  const router = useRouter();
  if (ctx) return ctx;
  return { navigate: (href: string) => router.push(href), busy: false };
}

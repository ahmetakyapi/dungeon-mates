'use client';

import { floorTheme } from '../../../shared/types';

/**
 * Fixed depth instrument on the left rail.
 *
 * The page is structured as a descent, so the reader's scroll position is real
 * information: which floor they are standing on and how deep they have gone.
 * The gauge reads it out like a mine shaft indicator rather than decorating the
 * page with a generic progress bar.
 */
export function DepthGauge({ floor, progress }: { floor: number; progress: number }) {
  const theme = floorTheme(floor);
  // 24m per floor is arbitrary but consistent — it exists to make depth legible
  // as a quantity, the way an altimeter does.
  const depth = Math.round(((floor - 1) + progress) * 24);

  return (
    <div
      className="pointer-events-none fixed left-0 top-1/2 z-40 hidden -translate-y-1/2 pl-4 lg:block"
      aria-hidden
    >
      <div className="flex items-center gap-3 rounded-r-md border-y border-r border-white/[0.07] bg-black/50 py-3 pl-2 pr-4 backdrop-blur-sm">
        {/* Shaft: one notch per floor, filled to the current depth */}
        <div className="flex flex-col gap-[3px]">
          {Array.from({ length: 10 }).map((_, i) => {
            const n = i + 1;
            const passed = n < floor;
            const current = n === floor;
            return (
              <span
                key={n}
                className="block transition-all duration-500"
                style={{
                  width: current ? 22 : passed ? 13 : 7,
                  height: current ? 3 : 2,
                  background: current
                    ? theme.accent
                    : passed
                      ? 'rgba(226,232,240,0.42)'
                      : 'rgba(226,232,240,0.14)',
                  boxShadow: current ? `0 0 8px ${theme.accent}80` : 'none',
                }}
              />
            );
          })}
        </div>

        <div className="flex flex-col gap-0.5">
          <span
            className="font-mono text-xs font-semibold tabular-nums transition-colors duration-500"
            style={{ color: theme.accent }}
          >
            −{depth}m
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-zinc-600">
            kat {String(floor).padStart(2, '0')}
          </span>
        </div>
      </div>
    </div>
  );
}

'use client';

import { PixelMotes, type MoteTone } from './PixelMotes';

/**
 * The room around a menu screen — lobby, class select, loading, the end of a
 * run. A dungeon chamber rather than a flat dark page:
 *
 *   - two wall torches (md and up), pixel flames on a three-frame sprite and a
 *     light that flickers in steps, the way the landing's gate torches do
 *   - drifting motes in the screen's tone (embers, arcane sparks, gold, ash)
 *   - a low glow off the floor
 *
 * Sits behind the content (absolute, z-0, no pointer). CSS in globals.css
 * (.dm-room*). Reduced motion: the torches stand still and the motes stop.
 */
export function ScreenAtmosphere({ tone = 'ember', torches = true, density = 0.5 }: {
  tone?: MoteTone;
  torches?: boolean;
  /** Share of quick embers among the motes, 0–1. */
  density?: number;
}) {
  return (
    <div aria-hidden className="dm-room" data-tone={tone}>
      <div className="dm-room-floor" />
      <PixelMotes tone={tone} ember={density} max={56} min={20} />
      {torches && (
        <>
          <Torch side="left" />
          <Torch side="right" />
        </>
      )}
    </div>
  );
}

function Torch({ side }: { side: 'left' | 'right' }) {
  return (
    <div className="dm-room-torch" data-side={side}>
      <span className="dm-room-torch-glow" />
      <svg viewBox="0 0 10 26" shapeRendering="crispEdges">
        {/* Flame: three frames, one shown at a time (CSS steps). */}
        <g className="dm-room-flame dm-room-flame--a">
          <rect x="4" y="1" width="2" height="2" fill="#ffd27a" />
          <rect x="3" y="3" width="4" height="3" fill="#ff8a3d" />
          <rect x="4" y="4" width="2" height="3" fill="#ffd27a" />
          <rect x="2" y="6" width="6" height="2" fill="#e5532a" />
          <rect x="4" y="6" width="2" height="2" fill="#fff1c9" />
        </g>
        <g className="dm-room-flame dm-room-flame--b">
          <rect x="5" y="0" width="1" height="2" fill="#ffd27a" />
          <rect x="3" y="2" width="4" height="4" fill="#ff8a3d" />
          <rect x="4" y="3" width="2" height="4" fill="#ffd27a" />
          <rect x="2" y="6" width="6" height="2" fill="#e5532a" />
          <rect x="4" y="6" width="2" height="2" fill="#fff1c9" />
        </g>
        <g className="dm-room-flame dm-room-flame--c">
          <rect x="3" y="1" width="2" height="2" fill="#ffd27a" />
          <rect x="3" y="3" width="4" height="3" fill="#ff8a3d" />
          <rect x="3" y="4" width="3" height="3" fill="#ffd27a" />
          <rect x="2" y="6" width="6" height="2" fill="#e5532a" />
          <rect x="4" y="6" width="2" height="2" fill="#fff1c9" />
        </g>
        {/* Wall plate with rivets, the ring that holds the torch, cup and handle. */}
        <rect x="3" y="13" width="4" height="11" fill="#22243a" />
        <rect x="4" y="22" width="1" height="1" fill="#4a4d6e" />
        <rect x="5" y="14" width="1" height="1" fill="#4a4d6e" />
        <rect x="4" y="11" width="2" height="9" fill="#6b4a2c" />
        <rect x="4" y="11" width="1" height="9" fill="#8a6038" />
        <rect x="2" y="8" width="6" height="2" fill="#5b4a3a" />
        <rect x="3" y="10" width="4" height="1" fill="#3e3128" />
        <rect x="2" y="16" width="6" height="2" fill="#3a3c58" />
        <rect x="2" y="16" width="6" height="1" fill="#55587a" />
      </svg>
    </div>
  );
}

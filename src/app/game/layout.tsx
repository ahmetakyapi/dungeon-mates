import type { Metadata, Viewport } from 'next';

// The run screen is a session, not a page: every URL carries a room code or a
// player name, so it is kept out of search results.
export const metadata: Metadata = {
  title: 'Zindan',
  robots: { index: false, follow: false },
};

// Zoom is locked only here. A pinch or double-tap zoom in the middle of a fight
// fights the joystick; the landing keeps normal zoom for reading.
export const viewport: Viewport = {
  maximumScale: 1,
  userScalable: false,
};

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return children;
}

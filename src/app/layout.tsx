import type { Metadata, Viewport } from 'next';
import { Inter, Press_Start_2P } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const pressStart2P = Press_Start_2P({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-pixel',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Dungeon Mates — Co-op Zindan Macerası',
  description:
    'Arkadaşlarınla birlikte zindanın derinliklerine dal! 2-4 kişilik co-op pixel art dungeon crawler.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="tr"
      className={`dark ${inter.variable} ${pressStart2P.variable}`}
      suppressHydrationWarning
    >
      <body className="font-body antialiased safe-area-padding">
        {children}
        <Analytics />
      </body>
    </html>
  );
}

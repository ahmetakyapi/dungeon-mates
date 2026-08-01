import type { Metadata, Viewport } from 'next';
import { Space_Grotesk, IBM_Plex_Mono, Press_Start_2P, Inter } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';

// Body face. Space Grotesk has a slightly mechanical, drawn quality that sits
// next to pixel type without fighting it — Inter read as a neutral default and
// gave the page no voice of its own.
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

// Utility face for depth readings, floor numerals and stat values. Monospace is
// the honest choice for instrument-style data.
const plexMono = IBM_Plex_Mono({
  weight: ['400', '500', '600'],
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

const pressStart2P = Press_Start_2P({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-pixel',
  display: 'swap',
});

// Inter carries the Nocturne design system used by the landing page. Self-hosted
// via next/font rather than the system's Google Fonts @import, so it is not a
// render-blocking third-party request.
const inter = Inter({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://dungeon-mates.vercel.app'),
  title: {
    default: 'Dungeon Mates — Tarayıcıda Anında Başlayan Co-op Zindan',
    template: '%s · Dungeon Mates',
  },
  description:
    'Zephara\'nın yozlaşmış katlarını arkadaşlarınla dolaş, 14 canavar türüyle savaş, sınıfını seç — kurulum yok, tarayıcıda anında başla.',
  keywords: [
    'co-op dungeon crawler',
    'browser game',
    'pixel art',
    'multiplayer',
    'roguelite',
    'web game',
    'tarayıcı oyunu',
    'türkçe oyun',
    'ücretsiz online oyun',
  ],
  authors: [{ name: 'Ahmet Akyapı' }],
  creator: 'Ahmet Akyapı',
  openGraph: {
    type: 'website',
    locale: 'tr_TR',
    url: 'https://dungeon-mates.vercel.app',
    siteName: 'Dungeon Mates',
    title: 'Dungeon Mates — Arkadaşlarınla Zindan Derinliklerine Dal',
    description:
      'Zephara\'nın 10 katı, 14 canavar, 4 sınıf. Kurulum yok, tarayıcıda anında başla. Solo ya da 2-4 kişi co-op.',
    // Image auto-discovered from src/app/opengraph-image.tsx (1200×630, edge-generated)
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Dungeon Mates — Co-op Zindan Macerası',
    description:
      'Zephara\'nın derinliklerine dal. 10 kat, 14 canavar, 4 sınıf. Tarayıcıda anında başla.',
    // Image auto-discovered from src/app/twitter-image.tsx
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0a0e17',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="tr"
      className={`dark ${spaceGrotesk.variable} ${plexMono.variable} ${pressStart2P.variable} ${inter.variable}`}
      suppressHydrationWarning
    >
      <body className="font-body antialiased safe-area-padding">
        {children}
        <Analytics />
      </body>
    </html>
  );
}

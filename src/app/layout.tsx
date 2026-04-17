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
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'Dungeon Mates — Co-op Dungeon Crawler',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Dungeon Mates — Co-op Zindan Macerası',
    description:
      'Zephara\'nın derinliklerine dal. 10 kat, 14 canavar, 4 sınıf. Tarayıcıda anında başla.',
    images: ['/og.png'],
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

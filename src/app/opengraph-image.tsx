import { ImageResponse } from 'next/og';

// Next.js auto-discovers this file and generates /opengraph-image
// Shared by /twitter-image.tsx via re-export below

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const alt = 'Dungeon Mates — Co-op Zindan Macerası';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  // Load Press Start 2P from Google Fonts (pixel aesthetic to match brand)
  const pixelFontData = await fetch(
    'https://fonts.gstatic.com/s/pressstart2p/v15/e3t4euO8T-267oIAQAu6jDQyK3nVivM.woff',
  ).then((r) => r.arrayBuffer());

  // Inter for body copy
  const interFontData = await fetch(
    'https://fonts.gstatic.com/s/inter/v18/UcCo3FwrK3iLTcvneQg7Ca725JhhKnNqk4j1ebLhAm8SrXTc2dRbGxJihSnClg.woff',
  ).then((r) => r.arrayBuffer());

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: '#0a0e17',
          backgroundImage:
            'radial-gradient(circle at 18% 22%, rgba(139,92,246,0.28), transparent 42%), radial-gradient(circle at 82% 28%, rgba(245,158,11,0.18), transparent 48%), radial-gradient(circle at 50% 110%, rgba(16,185,129,0.12), transparent 55%)',
          padding: '72px 80px',
          position: 'relative',
        }}
      >
        {/* Subtle grid pattern */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(139,92,246,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.05) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            opacity: 0.6,
          }}
        />

        {/* Corner pixel accents */}
        <div style={{ position: 'absolute', top: 40, left: 40, display: 'flex', gap: 8 }}>
          <div style={{ width: 12, height: 12, backgroundColor: '#ef4444', borderRadius: 2 }} />
          <div style={{ width: 12, height: 12, backgroundColor: '#fbbf24', borderRadius: 2 }} />
          <div style={{ width: 12, height: 12, backgroundColor: '#10b981', borderRadius: 2 }} />
        </div>
        <div
          style={{
            position: 'absolute',
            top: 40,
            right: 40,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            fontFamily: 'Pixel',
            fontSize: 14,
            color: 'rgba(163,163,163,0.9)',
            letterSpacing: '0.2em',
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              backgroundColor: '#10b981',
              borderRadius: 999,
              boxShadow: '0 0 12px #10b981',
            }}
          />
          TARAYICIDA · ANINDA
        </div>

        {/* Top — Badge */}
        <div style={{ display: 'flex' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '14px 22px',
              borderRadius: 999,
              border: '1px solid rgba(139,92,246,0.35)',
              backgroundColor: 'rgba(17,24,39,0.7)',
              fontFamily: 'Pixel',
              fontSize: 18,
              color: '#c4b5fd',
              letterSpacing: '0.15em',
            }}
          >
            <span style={{ fontSize: 28 }}>⚔</span>
            CO-OP DUNGEON CRAWLER
          </div>
        </div>

        {/* Middle — Hero */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          <div
            style={{
              display: 'flex',
              fontFamily: 'Pixel',
              fontSize: 104,
              color: '#c4b5fd',
              lineHeight: 1,
              letterSpacing: '-0.01em',
              textShadow:
                '0 0 40px rgba(139,92,246,0.6), 0 0 80px rgba(139,92,246,0.25)',
            }}
          >
            DUNGEON MATES
          </div>

          <div
            style={{
              display: 'flex',
              fontFamily: 'Inter',
              fontSize: 44,
              color: '#e5e5e5',
              lineHeight: 1.15,
              fontWeight: 500,
              maxWidth: 980,
            }}
          >
            Arkadaşlarınla&nbsp;
            <span style={{ color: '#c4b5fd', textShadow: '0 0 24px rgba(139,92,246,0.4)' }}>
              10 kat derin.
            </span>
            <br />
            <span style={{ color: '#fde68a', textShadow: '0 0 20px rgba(245,158,11,0.35)' }}>
              Tarayıcıda
            </span>
            &nbsp;anında.
          </div>
        </div>

        {/* Bottom — Stats strip + URL */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 40,
          }}
        >
          <div style={{ display: 'flex', gap: 40 }}>
            {[
              { v: '10', l: 'KAT', c: '#c4b5fd' },
              { v: '14', l: 'CANAVAR', c: '#fcd34d' },
              { v: '4', l: 'SINIF', c: '#86efac' },
              { v: '∞', l: 'RASTGELE', c: '#7dd3fc' },
            ].map((s) => (
              <div
                key={s.l}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 6,
                }}
              >
                <span
                  style={{
                    fontFamily: 'Pixel',
                    fontSize: 56,
                    color: s.c,
                    lineHeight: 1,
                    textShadow: `0 0 20px ${s.c}66`,
                  }}
                >
                  {s.v}
                </span>
                <span
                  style={{
                    fontFamily: 'Pixel',
                    fontSize: 14,
                    color: 'rgba(115,115,115,1)',
                    letterSpacing: '0.25em',
                  }}
                >
                  {s.l}
                </span>
              </div>
            ))}
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: 8,
              fontFamily: 'Pixel',
            }}
          >
            <span style={{ fontSize: 16, color: '#fbbf24', letterSpacing: '0.15em' }}>
              ▶ HEMEN OYNA
            </span>
            <span style={{ fontSize: 14, color: 'rgba(115,115,115,1)', letterSpacing: '0.1em' }}>
              dungeon-mates.vercel.app
            </span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Pixel', data: pixelFontData, style: 'normal', weight: 400 },
        { name: 'Inter', data: interFontData, style: 'normal', weight: 500 },
      ],
    },
  );
}

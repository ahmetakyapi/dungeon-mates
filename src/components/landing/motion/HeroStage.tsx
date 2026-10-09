'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion, useScroll, useTransform, useMotionTemplate, useSpring } from 'framer-motion';
import { LiveScene } from '../LiveScene';
import { RevealText } from './RevealText';
import { EASE_OUT_EXPO } from '@/lib/motion';

/**
 * The opening shot.
 *
 * A pinned stage two and a half screens tall. At rest the live dungeon sits in
 * a small window between two lines of giant type; as the reader scrolls, the
 * window opens until the dungeon fills the screen and swallows the headline —
 * the page literally drops them into the game. A second line arrives over the
 * full-bleed scene before the stage unpins.
 */
export function HeroStage({ ready, actions }: { ready: boolean; actions: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 760px)');
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  const { scrollYProgress: raw } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const p = useSpring(raw, { stiffness: 140, damping: 30, mass: 0.3 });

  // The window: insets shrink from a framed card to nothing.
  const startX = narrow ? 7 : 31;
  // On a phone the window sits high so the second line of type has room
  // beneath it, above the blurb and buttons.
  const startTop = narrow ? 25 : 26;
  const startBot = narrow ? 39 : 26;
  const ix = useTransform(p, [0, 0.55], [startX, 0]);
  const iyTop = useTransform(p, [0, 0.55], [startTop, 0]);
  const iyBot = useTransform(p, [0, 0.55], [startBot, 0]);
  const rad = useTransform(p, [0, 0.55], [14, 0]);
  const clip = useMotionTemplate`inset(${iyTop}% ${ix}% ${iyBot}% ${ix}% round ${rad}px)`;
  const sceneScale = useTransform(p, [0, 0.6], [1.12, 1]);

  // The two lines of type part and fade as the window opens.
  const topX = useTransform(p, [0, 0.5], ['0vw', narrow ? '-30vw' : '-22vw']);
  const botX = useTransform(p, [0, 0.5], ['0vw', narrow ? '30vw' : '22vw']);
  const typeOpacity = useTransform(p, [0.18, 0.46], [1, 0]);
  const chromeOpacity = useTransform(p, [0, 0.14], [1, 0]);
  const chromeY = useTransform(p, [0, 0.14], [0, 24]);

  // The payoff line over the full-bleed scene.
  const lateOpacity = useTransform(p, [0.58, 0.72, 0.95, 1], [0, 1, 1, 0.4]);
  const lateY = useTransform(p, [0.58, 0.75], [40, 0]);
  const shade = useTransform(p, [0.5, 0.75], [0, 0.55]);

  return (
    <section ref={ref} id="top" className="dm-hero" aria-label="Giriş">
      <div className="dm-hero-stage">
        {/* Giant type sits beneath the window, so opening it eats the words. */}
        <motion.div className="dm-hero-type" style={{ opacity: typeOpacity }}>
          <motion.div style={{ x: topX }} className="dm-hero-line dm-hero-line--top">
            <RevealText as="h1" by="char" text="On Kat" play={ready} delay={0.05} />
          </motion.div>
          <motion.div style={{ x: botX }} className="dm-hero-line dm-hero-line--bot">
            <RevealText as="span" by="char" text="Aşağı." play={ready} delay={0.28} wordStyle={() => ({ color: 'var(--color-ember)' })} />
          </motion.div>
        </motion.div>

        <motion.div
          className="dm-hero-window"
          style={{ clipPath: clip, WebkitClipPath: clip }}
          initial={{ opacity: 0, scale: 0.92 }}
          animate={ready ? { opacity: 1, scale: 1 } : undefined}
          transition={{ duration: 1.3, ease: EASE_OUT_EXPO, delay: 0.15 }}
        >
          <motion.div style={{ scale: sceneScale, width: '100%', height: '100%' }}>
            <LiveScene scene="skirmish" floor={10} cols={24} rows={15} showLabel={false} />
          </motion.div>
          <motion.span aria-hidden className="dm-hero-shade" style={{ opacity: shade }} />
          <span aria-hidden className="dm-hero-sweep" />
        </motion.div>

        <motion.div className="dm-hero-late" style={{ opacity: lateOpacity, y: lateY }}>
          <p className="dm-eyebrow">Kat 10 · Taht Salonu · gerçek zamanlı render</p>
          <p className="dm-hero-late-line">Tek çıkış en dipte.</p>
        </motion.div>

        {/* Chrome: kicker, blurb, actions, scroll cue. Leaves first. */}
        <motion.div className="dm-hero-chrome" style={{ opacity: chromeOpacity, y: chromeY }}>
          <motion.div
            className="dm-hero-blurb"
            initial={{ opacity: 0, y: 18 }}
            animate={ready ? { opacity: 1, y: 0 } : undefined}
            transition={{ duration: 1, ease: EASE_OUT_EXPO, delay: 0.75 }}
          >
            <p>
              Tarayıcıda açılan co-op zindan. Düşmanlar vuracakları yeri önce zeminde gösterir —
              okuyabilirsen kaçabilirsin.
            </p>
            <div className="dm-hero-actions">{actions}</div>
          </motion.div>
          <motion.div
            className="dm-scroll-cue"
            initial={{ opacity: 0 }}
            animate={ready ? { opacity: 1 } : undefined}
            transition={{ duration: 1, delay: 1.1 }}
          >
            <span>Aşağı in</span>
            <span className="dm-scroll-cue-track"><span /></span>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

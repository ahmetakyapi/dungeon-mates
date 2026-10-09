'use client';

import { useEffect } from 'react';
import Lenis from 'lenis';
import { prefersReducedMotion } from '@/lib/motion';

/**
 * Inertial scrolling for the landing page.
 *
 * The page is built as a descent, and most of its set pieces are scroll-linked
 * (the hero frame opening, the pinned floor gallery, words lighting up). With
 * raw wheel steps those jump in 100px notches; Lenis turns the wheel into a
 * continuous position so they glide. Touch keeps native scrolling — phones
 * already have momentum and fighting it feels wrong.
 *
 * Mounted only on the landing page, never under /game.
 */
let instance: Lenis | null = null;
/** Last requested lock state, so a Lenis created after the lock still honours it. */
let locked = false;

export function SmoothScroll() {
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const lenis = new Lenis({
      duration: 1.15,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });
    instance = lenis;
    if (locked) lenis.stop();
    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
      instance = null;
    };
  }, []);
  return null;
}

/** Scroll to an element id (or the top), through Lenis when it is running. */
export function scrollToTarget(target: string | 0) {
  if (instance) {
    instance.scrollTo(target === 0 ? 0 : `#${target}`, { duration: 1.6, offset: -10 });
    return;
  }
  if (target === 0) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  document.getElementById(target)?.scrollIntoView({ behavior: 'smooth' });
}

/** Pause/resume scrolling — used while the preloader or a modal is up. */
export function setScrollLocked(next: boolean) {
  locked = next;
  if (instance) { if (next) instance.stop(); else instance.start(); }
  document.documentElement.style.overflow = next ? 'hidden' : '';
}

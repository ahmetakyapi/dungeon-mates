'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { motion, type Variants } from 'framer-motion';
import { PixelButton } from '@/components/ui/PixelButton';
import { PixelInput } from '@/components/ui/PixelInput';
import { SplitReveal } from '@/components/fx/RevealText';
import { EASE_OUT_EXPO } from '@/lib/motion';
import { cleanPlayerName, loadPlayerName, PLAYER_NAME_MAX } from '@/lib/player-name';
import { ROOM_CODE_LENGTH } from '../../../shared/types';

const STAGGER: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};
const ITEM: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE_OUT_EXPO } },
};

type JoinPromptProps = {
  roomCode: string;
  onJoin: (name: string) => void;
  onBack: () => void;
};

/**
 * Where an invite link lands. The link carries only the room code, so the
 * friend picks a name here — before this screen the game page bounced any
 * link without a name back to the landing, and the code was lost on the way.
 */
export function JoinPrompt({ roomCode, onJoin, onBack }: JoinPromptProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const code = roomCode.toUpperCase();
  const validCode = code.length === ROOM_CODE_LENGTH && /^[A-Z0-9]+$/.test(code);

  useEffect(() => {
    setName(loadPlayerName());
    // Desktop only: on a phone, focusing pops the keyboard over the room code
    // before the player has seen which room they are joining.
    if (window.matchMedia?.('(pointer: fine)').matches) inputRef.current?.focus();
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const clean = cleanPlayerName(name);
    if (!clean) {
      setError('Önce bir isim gir.');
      inputRef.current?.focus();
      return;
    }
    onJoin(clean);
  };

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-dm-bg px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[min(600px,120vw)] w-[min(600px,120vw)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-dm-gold/[0.05] blur-3xl"
      />
      <div className="dm-scanlines" aria-hidden />
      <div className="dm-vignette" aria-hidden />

      <motion.div
        className="z-10 flex w-full max-w-sm flex-col items-center gap-6 lg:max-w-md"
        variants={STAGGER}
        initial="hidden"
        animate="show"
      >
        <motion.div className="flex flex-col items-center gap-3 text-center" variants={ITEM}>
          <h1
            className="font-pixel text-lg text-dm-accent sm:text-2xl lg:text-3xl"
            style={{ textShadow: '0 0 24px rgba(139,92,246,0.45)' }}
          >
            <SplitReveal text={validCode ? 'Odaya Katıl' : 'Davet Geçersiz'} delay={0.1} stagger={0.035} />
          </h1>
          <p className="max-w-[34ch] text-sm leading-relaxed text-zinc-400 lg:text-base">
            {validCode
              ? 'Arkadaşın seni bu odaya çağırdı. Adını yaz, aynı zindanda buluşun.'
              : 'Bu bağlantıda geçerli bir oda kodu yok. Kodu arkadaşından iste ya da ana menüden yeni bir oda kur.'}
          </p>
        </motion.div>

        {validCode && (
          <>
            <motion.div className="flex flex-col items-center gap-2" variants={ITEM}>
              <span className="dm-label text-zinc-400">Oda Kodu</span>
              <div className="flex gap-1.5" aria-label={`Oda kodu ${code.split('').join(' ')}`} role="img">
                {Array.from(code).map((ch, i) => (
                  <span
                    key={`${ch}-${i}`}
                    aria-hidden
                    className="grid h-11 w-9 place-items-center border border-dm-gold/25 bg-dm-bg/70 font-pixel text-xl text-dm-gold sm:h-14 sm:w-11 sm:text-3xl"
                    style={{ textShadow: '0 0 14px rgba(245,158,11,0.55)' }}
                  >
                    {ch}
                  </span>
                ))}
              </div>
            </motion.div>

            <motion.form className="flex w-full flex-col gap-3" variants={ITEM} onSubmit={submit} noValidate>
              <PixelInput
                ref={inputRef}
                id="join-name"
                label="İsmin"
                value={name}
                maxLength={PLAYER_NAME_MAX}
                autoComplete="nickname"
                enterKeyHint="go"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'join-error' : undefined}
                onChange={(e) => { setName(e.target.value.slice(0, PLAYER_NAME_MAX)); if (error) setError(''); }}
              />
              {error && (
                <motion.p
                  id="join-error"
                  role="alert"
                  className="dm-label text-dm-health"
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: [0, -5, 5, -2, 0] }}
                  transition={{ duration: 0.4 }}
                >
                  {error}
                </motion.p>
              )}
              <PixelButton type="submit" variant="primary" fullWidth>
                Katıl
              </PixelButton>
            </motion.form>
          </>
        )}

        <motion.div variants={ITEM}>
          <button
            type="button"
            className="dm-label -my-2 py-2 text-zinc-400 underline-offset-4 transition-colors hover:text-zinc-200 hover:underline"
            onClick={onBack}
          >
            Ana Menüye Dön
          </button>
        </motion.div>
      </motion.div>
    </main>
  );
}

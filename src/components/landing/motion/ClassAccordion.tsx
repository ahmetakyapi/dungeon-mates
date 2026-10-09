'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { CLASS_STATS, type PlayerClass } from '../../../../shared/types';
import { ClassPortrait } from '../ClassPortrait';
import { EASE_OUT_EXPO } from '@/lib/motion';

const CLASSES: ReadonlyArray<{ key: PlayerClass; role: string; line: string }> = [
  { key: 'warrior', role: 'Ön Saf', line: 'Kalkan duvarı hasarı yutar. Ağır düşmanı hazırlık anında sersemletir.' },
  { key: 'mage', role: 'Alan Hasarı', line: 'Buz fırtınası yavaşlatır. Yanan hedefe buz vurulursa dondurur.' },
  { key: 'archer', role: 'Menzil', line: 'En hızlı sınıf. Kritik yığar; ok yağmuru koridoru kapatır.' },
  { key: 'healer', role: 'Destek', line: 'Takımı ayakta tutar. Ultimate ekibe üç saniye dokunulmazlık verir.' },
];

const STAT_KEYS = [
  ['Can', 'maxHp'], ['Mana', 'maxMana'], ['Saldırı', 'attack'],
  ['Savunma', 'defense'], ['Hız', 'speed'], ['Menzil', 'attackRange'],
] as const;

/** Bars are relative to the best class in each stat, so they compare at a glance. */
const MAX: Record<(typeof STAT_KEYS)[number][1], number> = STAT_KEYS.reduce((acc, [, k]) => {
  acc[k] = Math.max(...CLASSES.map((c) => CLASS_STATS[c.key][k]));
  return acc;
}, {} as Record<(typeof STAT_KEYS)[number][1], number>);

/**
 * Four slabs side by side; the one under the pointer (or focus, or tap) opens
 * up to show the hero and their numbers while the others fold to a spine. On
 * narrow screens they stack and every slab is open.
 */
export function ClassAccordion() {
  const [open, setOpen] = useState<PlayerClass>('warrior');

  return (
    <div className="dm-acc" role="list">
      {CLASSES.map(({ key, role, line }, i) => {
        const s = CLASS_STATS[key];
        const on = open === key;
        return (
          <motion.article
            key={key}
            role="listitem"
            tabIndex={0}
            className="dm-acc-item"
            data-on={on ? 'true' : undefined}
            data-cursor={on ? undefined : 'Seç'}
            style={{ ['--cls' as string]: s.color }}
            onPointerEnter={(e) => { if (e.pointerType === 'mouse') setOpen(key); }}
            onFocus={() => setOpen(key)}
            onClick={() => setOpen(key)}
            initial={{ opacity: 0, y: 60 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '0px 0px -10% 0px' }}
            transition={{ duration: 1, ease: EASE_OUT_EXPO, delay: i * 0.09 }}
          >
            <div className="dm-acc-spine" aria-hidden>
              <span className="dm-acc-idx">0{i + 1}</span>
              <span className="dm-acc-spine-name">{s.label}</span>
            </div>

            <div className="dm-acc-body">
              <div className="dm-acc-portrait">
                <ClassPortrait cls={key} height={200} />
              </div>
              <div className="dm-acc-copy">
                <span className="dm-eyebrow" style={{ color: s.color }}>{role}</span>
                <h3 style={{ color: s.color }}>{s.label}</h3>
                <p>{line}</p>
                <dl className="dm-acc-stats">
                  {STAT_KEYS.map(([label, k], si) => (
                    <div key={k}>
                      <dt>{label}</dt>
                      <dd>{s[k]}</dd>
                      <span className="dm-acc-bar">
                        <span
                          style={{
                            transform: `scaleX(${on ? s[k] / MAX[k] : 0})`,
                            transitionDelay: on ? `${0.15 + si * 0.05}s` : '0s',
                          }}
                        />
                      </span>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </motion.article>
        );
      })}
    </div>
  );
}

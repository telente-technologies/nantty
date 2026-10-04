"use client";

import { useMemo, useState, type CSSProperties } from "react";

import styles from "./celebrations.module.css";

const tones = ["brand", "success", "warn", "danger"] as const;

function Balloon({ tone }: { readonly tone: (typeof tones)[number] }) {
  return (
    <svg viewBox="0 0 40 60" aria-hidden="true" focusable="false" className={styles.balloonSvg} data-tone={tone}>
      <ellipse cx="20" cy="19" rx="16" ry="19" fill="currentColor" />
      <ellipse cx="13" cy="11" rx="4" ry="6" fill="#fff" opacity="0.28" />
      <path d="M20 38 L16.5 43 H23.5 Z" fill="currentColor" />
      <path d="M20 43 C16 49 24 53 20 59" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" opacity="0.8" />
    </svg>
  );
}

export function CelebrationConfetti() {
  const pieces = [[14, 20, 0], [60, 10, 1], [108, 26, 2], [160, 12, 3], [206, 30, 1], [250, 14, 0], [36, 56, 2], [88, 62, 3], [140, 52, 0], [188, 66, 2], [236, 58, 1], [282, 40, 3]] as const;
  return (
    <svg className={styles.confetti} viewBox="0 0 300 80" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      {pieces.map(([x, y, tone]) => (
        <g key={`${x}-${y}`} className={styles.piece} data-tone={tones[tone]}>
          {x % 2 === 0 ? <circle cx={x} cy={y} r="4" fill="currentColor" /> : <rect x={x} y={y} width="7" height="4" rx="1" fill="currentColor" transform={`rotate(${x % 60} ${x} ${y})`} />}
        </g>
      ))}
    </svg>
  );
}

export function FloatingBalloons({ count = 7, height }: { readonly count?: number; readonly height?: number }) {
  const [popped, setPopped] = useState<ReadonlySet<number>>(new Set());
  const specs = useMemo(() => Array.from({ length: count }, (_, id) => ({ id, left: 4 + ((id * 83) % 88), delay: id * 0.26, duration: 5.2 + ((id * 610) % 2400) / 1000 })), [count]);
  return (
    <div className={styles.layer} style={height === undefined ? undefined : { height, bottom: "auto" }}>
      <div className={styles.staticConfetti}>
        <CelebrationConfetti />
      </div>
      <div className={styles.motionBalloons}>
        {specs.filter((spec) => !popped.has(spec.id)).map((spec) => (
          <button
            key={spec.id}
            type="button"
            className={styles.balloon}
            aria-label="Pop balloon"
            style={{ left: `${spec.left}%`, animationDelay: `${spec.delay}s`, animationDuration: `${spec.duration}s` } as CSSProperties}
            onClick={() => setPopped((current) => new Set(current).add(spec.id))}
          >
            <Balloon tone={tones[spec.id % 4]!} />
          </button>
        ))}
      </div>
    </div>
  );
}

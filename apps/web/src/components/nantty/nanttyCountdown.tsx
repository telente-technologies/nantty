"use client";

import { useEffect, useState } from "react";

import styles from "./nanttyLanding.module.css";

interface CountdownParts {
  readonly days: number;
  readonly hours: number;
  readonly minutes: number;
  readonly seconds: number;
}

function getCountdownParts(target: string): CountdownParts | null {
  const distance = new Date(target).getTime() - Date.now();
  if (!Number.isFinite(distance) || distance <= 0) return null;
  const totalSeconds = Math.floor(distance / 1000);
  return {
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3_600),
    minutes: Math.floor((totalSeconds % 3_600) / 60),
    seconds: totalSeconds % 60,
  };
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function NanttyCountdown({ target, label }: { readonly target: string; readonly label: string }) {
  const [parts, setParts] = useState<CountdownParts | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const update = () => {
      setParts(getCountdownParts(target));
      setIsReady(true);
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [target]);

  if (!isReady) return <p className={styles.countdownLoading} data-countdown-target={target} data-countdown-label={label}>Preparing countdown…</p>;
  if (!parts) return <p className={styles.countdownLive}>{label} starts now</p>;

  return (
    <div className={styles.countdown} data-countdown-target={target} data-countdown-label={label} role="timer" aria-label={`Time remaining until ${label}`}>
      {[
        [parts.days, "days"],
        [pad(parts.hours), "hours"],
        [pad(parts.minutes), "minutes"],
        [pad(parts.seconds), "seconds"],
      ].map(([value, unit]) => (
        <span className={styles.countdownUnit} key={unit}>
          <strong>{value}</strong>
          <span>{unit}</span>
        </span>
      ))}
    </div>
  );
}

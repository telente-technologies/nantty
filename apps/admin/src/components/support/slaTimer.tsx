"use client";

import { useEffect, useState } from "react";

import { formatDateTime, formatDurationFromSeconds } from "@/utils/formatting.util";

import styles from "./slaTimer.module.css";

function useCurrentTimeTickingEvery(intervalInMilliseconds: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalInMilliseconds);
    return () => window.clearInterval(timer);
  }, [intervalInMilliseconds]);
  return now;
}

interface SlaTimerProps {
  readonly label: string;
  readonly dueAt: string;
  readonly metAt: string | null;
  readonly isStopped?: boolean;
}

export function SlaTimer({ label, dueAt, metAt, isStopped = false }: SlaTimerProps) {
  const now = useCurrentTimeTickingEvery(15_000);
  const dueEpochMs = new Date(dueAt).getTime();
  if (metAt) {
    const wasLate = new Date(metAt).getTime() > dueEpochMs;
    return (
      <span className={`${styles.timer} ${wasLate ? styles.late : styles.met}`} title={`${label} due ${formatDateTime(dueAt)}`}>
        {label}: {wasLate ? "met late" : "met"}
      </span>
    );
  }
  if (isStopped) return <span className={styles.timer}>{label}: stopped</span>;
  const secondsLeft = Math.round((dueEpochMs - now) / 1000);
  const isBreached = secondsLeft < 0;
  const isNear = !isBreached && secondsLeft < 3600;
  return (
    <span className={`${styles.timer} ${isBreached ? styles.breached : isNear ? styles.near : ""}`} title={`${label} due ${formatDateTime(dueAt)}`}>
      {label}: {isBreached ? `overdue ${formatDurationFromSeconds(-secondsLeft)}` : `${formatDurationFromSeconds(secondsLeft)} left`}
    </span>
  );
}

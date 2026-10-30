"use client";

import { useEffect, useState } from "react";

import styles from "./launchCountdown.module.css";

const milestones = [
  { label: "Early beta", date: "2027-01-15T09:00:00+01:00", display: "15 January 2027 · 9:00am WAT" },
  { label: "Public launch", date: "2027-03-01T09:00:00+01:00", display: "1 March 2027 · 9:00am WAT" },
] as const;

function remaining(target: string) {
  const difference = new Date(target).getTime() - Date.now();
  if (!Number.isFinite(difference) || difference <= 0) return null;
  const seconds = Math.floor(difference / 1000);
  return [Math.floor(seconds / 86_400), Math.floor((seconds % 86_400) / 3_600), Math.floor((seconds % 3_600) / 60), seconds % 60];
}

function Countdown({ target, label }: { target: string; label: string }) {
  const [time, setTime] = useState<ReturnType<typeof remaining>>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const update = () => {
      setTime(remaining(target));
      setReady(true);
    };
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [target]);

  if (!ready) return <p className={styles.loading}>Preparing countdown…</p>;
  if (!time) return <p className={styles.live}>{label} starts now</p>;

  return (
    <div className={styles.timer} role="timer" aria-label={`Time remaining until ${label}`}>
      {time.map((value, index) => {
        const unit = ["days", "hours", "minutes", "seconds"][index] ?? "";
        return (
        <span className={styles.unit} key={unit}>
          <strong>{index === 0 ? value : String(value).padStart(2, "0")}</strong>
          <span>{unit}</span>
        </span>
        );
      })}
    </div>
  );
}

export function LaunchCountdown() {
  return (
    <section className={styles.section} aria-labelledby="launch-timeline-heading">
      <div className={styles.inner}>
        <div className={styles.intro}>
          <p className={styles.eyebrow}>Launch timeline</p>
          <h2 id="launch-timeline-heading">Two milestones ahead.</h2>
          <p>Dates are planning targets and will be confirmed before launch.</p>
        </div>
        <div className={styles.grid}>
          {milestones.map((milestone) => (
            <article className={styles.card} key={milestone.label}>
              <div>
                <p className={styles.label}>{milestone.label}</p>
                <p className={styles.date}>{milestone.display}</p>
              </div>
              <Countdown target={milestone.date} label={milestone.label.toLowerCase()} />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

"use client";

import { ThemeSwitcher, useTheme } from "@nantty/web-kit";

import styles from "./settingsHome.module.css";

export function AppearanceSection() {
  const { preference, resolvedTheme } = useTheme();
  const summary = preference === "system" ? `Following your device (${resolvedTheme} right now)` : `Always ${preference}`;
  return (
    <section className={styles.card} aria-labelledby="appearance-heading">
      <div className={styles.cardHeader}>
        <h2 id="appearance-heading" className={styles.cardTitle}>
          Appearance
        </h2>
        <p className={styles.cardDescription}>Choose light, dark, or match your device. Your choice syncs to the Nantty app on your account.</p>
      </div>
      <ThemeSwitcher label="Theme" showLabel />
      <p className={styles.cardStatus} aria-live="polite">
        {summary}
      </p>
    </section>
  );
}

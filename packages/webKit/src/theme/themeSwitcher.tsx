"use client";

import { useId } from "react";

import { themePreferenceLabels, themePreferences, type ThemePreference } from "./themePreference.constant";
import { useTheme } from "./themeProvider";
import styles from "./themeSwitcher.module.css";

export interface ThemeSwitcherProps {
  readonly label?: string;
  readonly showLabel?: boolean;
  readonly iconOnly?: boolean;
  readonly className?: string;
}

function ThemePreferenceIcon({ preference }: { readonly preference: ThemePreference }) {
  if (preference === "light") {
    return (
      <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" focusable="false">
        <circle cx="10" cy="10" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.7" />
        <path d="M10 1.8v2.1M10 16.1v2.1M1.8 10h2.1M16.1 10h2.1M4.2 4.2l1.5 1.5M14.3 14.3l1.5 1.5M4.2 15.8l1.5-1.5M14.3 5.7l1.5-1.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }
  if (preference === "dark") {
    return (
      <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" focusable="false">
        <path d="M16.5 12.4A6.8 6.8 0 0 1 7.6 3.5a6.8 6.8 0 1 0 8.9 8.9Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" focusable="false">
      <rect x="2.4" y="3.4" width="15.2" height="10.4" rx="1.8" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M7 17h6M10 13.8V17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function ThemeSwitcher({ label = "Theme", showLabel = false, iconOnly = false, className }: ThemeSwitcherProps) {
  const { preference, setPreference } = useTheme();
  const groupName = useId();
  return (
    <fieldset className={[styles.switcher, iconOnly ? styles.iconOnly : "", className ?? ""].join(" ")}>
      <legend className={showLabel ? styles.legend : styles.visuallyHidden}>{label}</legend>
      <div className={styles.track}>
        {themePreferences.map((option) => (
          <label key={option} className={styles.option} title={iconOnly ? themePreferenceLabels[option] : undefined}>
            <input type="radio" className={styles.radio} name={groupName} value={option} checked={preference === option} onChange={() => setPreference(option)} />
            <span className={styles.face}>
              <ThemePreferenceIcon preference={option} />
              <span className={iconOnly ? styles.visuallyHidden : styles.optionText}>{themePreferenceLabels[option]}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

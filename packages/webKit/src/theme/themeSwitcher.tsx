/** @jsxRuntime automatic */
/** @jsxImportSource react */
"use client";

import { Monitor, Moon, Sun, type Icon } from "@phosphor-icons/react";
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

const themePreferenceIcons: Record<ThemePreference, Icon> = { light: Sun, dark: Moon, system: Monitor };

function ThemePreferenceIcon({ preference }: { readonly preference: ThemePreference }) {
  const PreferenceIcon = themePreferenceIcons[preference];
  return <PreferenceIcon size={16} weight="bold" aria-hidden="true" focusable="false" />;
}

export function ThemeSwitcher({ label = "Theme", showLabel = false, iconOnly = false, className }: ThemeSwitcherProps) {
  const { preference, setPreference } = useTheme();
  const groupName = useId();
  return (
    <fieldset data-theme-switcher="true" className={[styles.switcher, iconOnly ? styles.iconOnly : "", className ?? ""].join(" ")}>
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

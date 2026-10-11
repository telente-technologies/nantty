/** @jsxRuntime automatic */
/** @jsxImportSource react */
"use client";

import { useState, type ReactNode } from "react";

import styles from "./advisories.module.css";
import { ErrorIcon } from "./errorIcons";

function formatWindow(startsAt?: string, endsAt?: string): string | null {
  const format = new Intl.DateTimeFormat("en-NG", { weekday: "short", hour: "numeric", minute: "2-digit" });
  const start = startsAt && !Number.isNaN(Date.parse(startsAt)) ? format.format(new Date(startsAt)) : null;
  const end = endsAt && !Number.isNaN(Date.parse(endsAt)) ? format.format(new Date(endsAt)) : null;
  if (start && end) return `${start} to ${end}`;
  return start ?? end;
}

export function MaintenanceBanner({ message, startsAt, endsAt, onDismiss }: { readonly message?: string; readonly startsAt?: string; readonly endsAt?: string; readonly onDismiss?: () => void }) {
  const windowText = formatWindow(startsAt, endsAt);
  const text = message ?? (windowText ? `Planned maintenance ${windowText}. Some features may pause briefly. Your money and orders are safe.` : "Planned maintenance is coming up. Some features may pause briefly.");
  return (
    <div className={styles.maintenance} role="status">
      <ErrorIcon name="wrench" size={16} weight="bold" />
      <span>{text}</span>
      {onDismiss ? (
        <button type="button" className={styles.dismiss} onClick={onDismiss} aria-label="Dismiss maintenance notice">
          <ErrorIcon name="x" size={14} weight="regular" />
        </button>
      ) : null}
    </div>
  );
}

export interface SensitiveContentCoverProps {
  readonly children: ReactNode;
  readonly canReveal?: boolean;
  readonly ageRestricted?: boolean;
  readonly onReveal?: () => void;
}

export function SensitiveContentCover({ children, canReveal = true, ageRestricted = false, onReveal }: SensitiveContentCoverProps) {
  const [revealed, setRevealed] = useState(false);
  if (revealed) return <>{children}</>;
  return (
    <div className={styles.sensitive}>
      <div className={styles.blurred} aria-hidden="true" inert>
        {children}
      </div>
      <div className={styles.sensitiveOverlay} role="group" aria-label="Sensitive content">
        <ErrorIcon name="eyeSlash" size={28} />
        <p className={styles.sensitiveTitle}>Sensitive content</p>
        <p className={styles.sensitiveText}>{ageRestricted ? "This is only for people aged 18 and over." : "This may be upsetting or graphic for some people."}</p>
        {canReveal ? (
          <button
            type="button"
            className={styles.reveal}
            onClick={() => {
              setRevealed(true);
              onReveal?.();
            }}
          >
            Show anyway
          </button>
        ) : null}
      </div>
    </div>
  );
}

import Link from "next/link";
import type { ReactNode } from "react";

import styles from "./landingLayout.module.css";
import { PrelaunchLoginAction } from "./prelaunchLoginAction";

export interface LandingAction {
  readonly href: string;
  readonly label: string;
  readonly locked?: boolean;
}

export function LandingActionLink({ action, tone = "primary" }: { readonly action: LandingAction; readonly tone?: "primary" | "accent" | "quiet" }) {
  if (action.locked) return <PrelaunchLoginAction className={`${styles.actionLink} ${styles[tone]}`}>{action.label}</PrelaunchLoginAction>;
  return (
    <Link href={action.href} className={`${styles.actionLink} ${styles[tone]}`}>
      {action.label}
    </Link>
  );
}

export function SectionIntro({ eyebrow, heading, headingId, lede, align = "start" }: { readonly eyebrow: string; readonly heading: ReactNode; readonly headingId: string; readonly lede?: ReactNode; readonly align?: "start" | "center" }) {
  return (
    <div className={align === "center" ? `${styles.sectionIntro} ${styles.sectionIntroCentered}` : styles.sectionIntro}>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h2 id={headingId} className={styles.sectionHeading}>
        {heading}
      </h2>
      {lede ? <p className={styles.sectionLede}>{lede}</p> : null}
    </div>
  );
}

export function ScreenshotInBrowserFrame({ src, alt, address, priority = false }: { readonly src: string; readonly alt: string; readonly address: string; readonly priority?: boolean }) {
  const prelaunch = process.env.NEXT_PUBLIC_NANTTY_STATIC_PRELAUNCH === "1";
  return (
    <figure className={styles.browserFrame}>
      <div className={styles.browserBar} aria-hidden>
        <span className={styles.browserDots}>
          <span />
          <span />
          <span />
        </span>
        <span className={styles.browserAddress}>{address}</span>
      </div>
      {prelaunch ? (
        <div className={styles.browserImage} role="img" aria-label={alt} style={{ minHeight: 280, padding: 24, background: "linear-gradient(135deg, var(--surface-card), var(--landing-wash-brand))" }}>
          <p style={{ color: "var(--color-brand)", fontWeight: 700, margin: "0 0 18px" }}>Nantty Ads · Campaign workspace</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
            {["Campaigns", "Reach", "Orders"].map((label, index) => <div key={label} style={{ padding: 16, borderRadius: 12, background: "var(--color-surface)", boxShadow: "inset 0 0 0 1px var(--color-border)" }}><span style={{ display: "block", color: "var(--ink-muted)", fontSize: 13 }}>{label}</span><strong style={{ display: "block", marginTop: 8, fontSize: 22 }}>{["3 active", "12.4k", "86"][index]}</strong></div>)}
          </div>
          <div aria-hidden="true" style={{ height: 76, marginTop: 16, borderRadius: 12, background: "repeating-linear-gradient(90deg, color-mix(in srgb, var(--color-brand) 14%, transparent) 0 12%, transparent 12% 17%)" }} />
        </div>
      ) : <img src={src} alt={alt} width={2880} height={1800} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"} className={styles.browserImage} />}
    </figure>
  );
}

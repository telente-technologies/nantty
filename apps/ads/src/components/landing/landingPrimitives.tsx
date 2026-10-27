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
      <img src={src} alt={alt} width={2880} height={1800} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"} className={styles.browserImage} />
    </figure>
  );
}

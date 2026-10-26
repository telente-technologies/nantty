import Link from "next/link";
import { ConnectionStatus, ThemeSwitcher, NanttyWordmark } from "@nantty/web-kit";
import type { ReactNode } from "react";

import styles from "./authSplitLayout.module.css";

const proofPoints = [
  "Start a stream, or push video from OBS and any RTMP encoder",
  "Drop text, logos, shapes and tickers onto a 1920×1080 canvas",
  "Pin your products and take orders while you are on air",
];

export function AuthSplitLayout({ children }: { readonly children: ReactNode }) {
  return (
    <>
      <ConnectionStatus />
      <div className={styles.page}>
        <aside className={styles.aside} aria-label="About Nantty Studio">
          <div className={styles.asideInner}>
            <Link href="/" className={styles.wordmark}>
              <NanttyWordmark productLabel="Studio" tone="onDark" withSymbol />
            </Link>
            <div className={styles.asideCopy}>
              <p className={styles.eyebrow}>Nantty Studio</p>
              <p className={styles.headline}>Go live, and bring your whole shop with you.</p>
              <p className={styles.lede}>
                One control room for your broadcasts: connect an encoder, build your overlays, pin products and watch the comments roll in.
              </p>
              <ul className={styles.proofList}>
                {proofPoints.map((point, index) => (
                  <li key={point} className={styles.proofRow}>
                    <span className={styles.proofIndex}>{index + 1}</span>
                    {point}
                  </li>
                ))}
              </ul>
            </div>
  
            <div className={styles.stage} aria-hidden="true">
              <span className={styles.stageBadge}>
                <span className={styles.stageDot} />
                LIVE
              </span>
              <span className={styles.stageSource}>OBS connected</span>
              <div className={styles.stageLowerThird}>
                <p className={styles.stageName}>Temitope Adeyemi</p>
                <p className={styles.stageHandle}>@temi.creates</p>
              </div>
              <span className={styles.stageTicker}>Pinned: Shea &amp; Black Soap Bar Duo</span>
            </div>
          </div>
        </aside>
  
        <main id="main-content" className={styles.main} tabIndex={-1}>
          <ThemeSwitcher iconOnly className={styles.themeCorner} />
          <div className={styles.panel}>{children}</div>
        </main>
      </div>
    </>
  );
}

import type { ReactNode } from "react";

import styles from "./payoutOnboarding.module.css";

export function PayoutStepFrame({ stepNumber, stepCount, title, why, children }: { readonly stepNumber: number; readonly stepCount: number; readonly title: string; readonly why: string; readonly children: ReactNode }) {
  return (
    <div className={styles.stack}>
      <div className={styles.bars} role="img" aria-label={`Step ${stepNumber} of ${stepCount}`}>
        {Array.from({ length: stepCount }, (_, index) => <span key={index} className={`${styles.bar} ${index < stepNumber ? styles.barDone : ""}`} />)}
      </div>
      <p className={styles.muted}>Step {stepNumber} of {stepCount}</p>
      <h2 style={{ margin: 0 }}>{title}</h2>
      <div className={styles.why}>
        <strong>Why we need this</strong>
        <p className={styles.muted}>{why}</p>
      </div>
      {children}
    </div>
  );
}

import type { ReactNode } from "react";

import styles from "./payoutOnboarding.module.css";

interface PayoutStepFrameProps {
  readonly stepNumber: number;
  readonly stepCount: number;
  readonly title: string;
  readonly why: string;
  readonly children: ReactNode;
}

export function PayoutStepFrame({ stepNumber, stepCount, title, why, children }: PayoutStepFrameProps) {
  return (
    <div className={styles.stack}>
      <div className={styles.bars} role="img" aria-label={`Step ${stepNumber} of ${stepCount}`}>
        {Array.from({ length: stepCount }, (_, index) => (
          <span key={index} className={`${styles.bar} ${index < stepNumber ? styles.barDone : ""}`} />
        ))}
      </div>
      <p className={styles.muted}>Step {stepNumber} of {stepCount}</p>
      <h2 className={styles.title}>{title}</h2>
      <div className={styles.why}>
        <strong>Why we need this</strong>
        <p className={styles.muted}>{why}</p>
      </div>
      {children}
    </div>
  );
}

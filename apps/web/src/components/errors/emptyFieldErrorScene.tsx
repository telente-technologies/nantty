import type { ReactNode } from "react";

import styles from "./emptyFieldErrorScene.module.css";

interface EmptyFieldErrorSceneProps {
  readonly statusCode: string;
  readonly heading: string;
  readonly description: string;
  readonly actions: ReactNode;
}

export function EmptyFieldErrorScene({ statusCode, heading, description, actions }: EmptyFieldErrorSceneProps) {
  return (
    <section className={styles.scene} aria-labelledby="error-heading">
      <div className={styles.backdrop} aria-hidden="true" />
      <div className={styles.shade} aria-hidden="true" />
      <div className={`pageContainer ${styles.content}`}>
        <p className={styles.statusCode} aria-hidden="true">
          {statusCode.split("").map((statusDigit, digitIndex) => (
            <span key={`${statusDigit}-${digitIndex}`} className={styles.statusDigit}>
              {statusDigit}
            </span>
          ))}
        </p>
        <h1 id="error-heading" className={styles.heading}>
          {heading}
        </h1>
        <p className={styles.description}>{description}</p>
        <div className={styles.actions}>{actions}</div>
      </div>
    </section>
  );
}

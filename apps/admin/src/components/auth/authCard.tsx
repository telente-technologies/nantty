import type { ReactNode } from "react";

import { EnvironmentBadge } from "@/components/shell/environmentBadge";
import type { AdminDeploymentEnvironment } from "@/config/adminEnvironment.config";

import styles from "./authCard.module.css";

export function AuthCard({ environment, title, description, children, footer }: { readonly environment: AdminDeploymentEnvironment; readonly title: string; readonly description?: ReactNode; readonly children: ReactNode; readonly footer?: ReactNode }) {
  return (
    <div className={styles.page}>
      <main className={styles.card}>
        <div className={styles.brandRow}>
          <span className={styles.wordmark}>
            zudomart<span className={styles.suffix}>admin</span>
          </span>
          <EnvironmentBadge environment={environment} />
        </div>
        <h1 className={styles.title}>{title}</h1>
        {description ? <div className={styles.description}>{description}</div> : null}
        <div className={styles.body}>{children}</div>
        {footer ? <div className={styles.footer}>{footer}</div> : null}
      </main>
      <p className={styles.legal}>Restricted system. Every sign-in and action is recorded with your name, IP address and time.</p>
    </div>
  );
}

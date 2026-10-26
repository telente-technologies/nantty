import { NanttyWordmark } from "@nantty/web-kit";
import type { ReactNode } from "react";

import { EnvironmentBadge } from "@/components/shell/environmentBadge";
import type { AdminDeploymentEnvironment } from "@/config/adminEnvironment.config";
import { adminSupportContactEmails } from "@/constants/supportContacts.constant";

import styles from "./authCard.module.css";

const securityPromises = ["Two-step verification on every sign-in", "Sensitive actions ask for your code again", "Signed out after 15 minutes without activity", "Every action is written to the audit log"];

export function AuthCard({ environment, title, description, children, footer }: { readonly environment: AdminDeploymentEnvironment; readonly title: string; readonly description?: ReactNode; readonly children: ReactNode; readonly footer?: ReactNode }) {
  return (
    <div className={styles.page}>
      <section className={styles.brandPanel} aria-label="About this console">
        <div className={styles.brandRow}>
          <NanttyWordmark productLabel="Admin" tone="onDark" height={28} withSymbol />
          <EnvironmentBadge environment={environment} />
        </div>
        <div className={styles.brandBody}>
          <p className={styles.kicker}>Restricted system</p>
          <p className={styles.statement}>The control room for Nantty's people, money and content.</p>
          <ul className={styles.promises}>
            {securityPromises.map((promise) => (
              <li key={promise}>{promise}</li>
            ))}
          </ul>
        </div>
        <p className={styles.legal}>
          Only authorised staff may sign in. Every sign-in and action is recorded with your name, IP address and time. Access problems: {adminSupportContactEmails.map((email, index) => (
            <span key={email}>
              {index > 0 ? " or " : ""}
              <a href={`mailto:${email}`}>{email}</a>
            </span>
          ))}
          .
        </p>
      </section>
      <main className={styles.formPanel}>
        <div className={styles.formColumn}>
          <h1 className={styles.title}>{title}</h1>
          {description ? <div className={styles.description}>{description}</div> : null}
          <div className={styles.body}>{children}</div>
          {footer ? <div className={styles.footer}>{footer}</div> : null}
        </div>
      </main>
    </div>
  );
}

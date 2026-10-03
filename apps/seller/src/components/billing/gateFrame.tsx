"use client";

import type { ReactNode } from "react";

import { DashboardWordmark } from "@/components/layout/sidebarNavigation";
import { Button } from "@/components/ui/button";
import { signOutOfDashboardAndClearCachedPages } from "@/services/signOut.service";

import styles from "./gateFrame.module.css";
import { ZudoIcon } from "@/components/ui/zudoIcon";

export function GateFrame({ children }: { readonly children: ReactNode }) {
  async function signOutOfDashboard() {
    await signOutOfDashboardAndClearCachedPages();
  }
  return (
    <div className={styles.frame}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <DashboardWordmark />
        </div>
        <Button variant="ghost" size="small" onClick={() => void signOutOfDashboard()}>
          Sign out
        </Button>
      </header>
      <main id="main-content" className={styles.main}>
        {children}
      </main>
    </div>
  );
}

export function GateStep({ state, title, children }: { readonly state: "done" | "current" | "todo"; readonly title: string; readonly children?: ReactNode }) {
  return (
    <li className={`${styles.step} ${styles[state]}`}>
      <span className={styles.stepMarker} aria-hidden="true">
        {state === "done" ? <ZudoIcon name="check16" size={14} /> : null}
      </span>
      <div>
        <p className={styles.stepTitle}>
          {title} <span className="visuallyHidden">({state === "done" ? "done" : state === "current" ? "in progress" : "not started"})</span>
        </p>
        {children ? <div className={styles.stepBody}>{children}</div> : null}
      </div>
    </li>
  );
}

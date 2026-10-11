"use client";

import { Suspense, useState, type ReactNode } from "react";

import { useAdminSession } from "@/components/session/adminSessionProvider";

import { AccessDeniedNotice } from "./accessDeniedNotice";
import { ConsoleTopBar } from "./consoleTopBar";
import styles from "./consoleShell.module.css";
import { EnvironmentTape } from "./environmentBadge";
import { IdleSessionWatcher } from "./idleSessionWatcher";
import { KeyboardShortcuts } from "./keyboardShortcuts";
import { SidebarNavigation } from "./sidebarNavigation";

export function ConsoleShell({ children }: { readonly children: ReactNode }) {
  const { environment } = useAdminSession();
  const [isNavigationOpen, setIsNavigationOpen] = useState(false);
  return (
    <div className={styles.shell}>
      <EnvironmentTape environment={environment} />
      <a href="#main-content" className="skipToContentLink">
        Skip to content
      </a>
      <SidebarNavigation isOpenOnSmallScreens={isNavigationOpen} onNavigate={() => setIsNavigationOpen(false)} />
      {isNavigationOpen ? <button type="button" className={styles.scrim} aria-label="Close navigation" onClick={() => setIsNavigationOpen(false)} /> : null}
      <div className={styles.workspace}>
        <ConsoleTopBar onOpenNavigation={() => setIsNavigationOpen(true)} />
        <main id="main-content" className={styles.main} tabIndex={-1}>
          <Suspense fallback={null}>
            <AccessDeniedNotice />
          </Suspense>
          {children}
        </main>
      </div>
      <IdleSessionWatcher />
      <KeyboardShortcuts />
    </div>
  );
}

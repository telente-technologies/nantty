"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

import { CommandPalette } from "@/components/layout/commandPalette";
import { SidebarNavigation } from "@/components/layout/sidebarNavigation";
import { StoreContextProvider } from "@/components/layout/storeContextProvider";
import { TopBar } from "@/components/layout/topBar";
import { useToast } from "@/components/ui/toastProvider";
import { buildNavigationGroups } from "@/config/navigation.config";

import styles from "./workspaceShell.module.css";

export function WorkspaceShell({ adsManagerUrl, children }: { readonly adsManagerUrl: string; readonly children: ReactNode }) {
  const [isNavigationOpen, setIsNavigationOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const navigationGroups = useMemo(() => buildNavigationGroups(adsManagerUrl), [adsManagerUrl]);
  const { showToast } = useToast();

  useEffect(() => {
    function openCommandPaletteOnShortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsCommandPaletteOpen(true);
      }
    }
    window.addEventListener("keydown", openCommandPaletteOnShortcut);
    return () => window.removeEventListener("keydown", openCommandPaletteOnShortcut);
  }, []);

  useEffect(() => {
    const deniedPath = new URLSearchParams(window.location.search).get("denied");
    if (deniedPath) showToast("Your role does not include that page, so we brought you here.", "info");
  }, [showToast]);

  return (
    <StoreContextProvider>
      <div className={styles.shell}>
        <SidebarNavigation groups={navigationGroups} isOpenOnSmallScreens={isNavigationOpen} onNavigate={() => setIsNavigationOpen(false)} />
        {isNavigationOpen ? <button type="button" aria-label="Close navigation" className={styles.scrim} onClick={() => setIsNavigationOpen(false)} /> : null}
        <div className={styles.column}>
          <TopBar onOpenNavigation={() => setIsNavigationOpen(true)} onOpenCommandPalette={() => setIsCommandPaletteOpen(true)} />
          <main id="main-content" tabIndex={-1} className={styles.main}>
            {children}
          </main>
        </div>
      </div>
      <CommandPalette isOpen={isCommandPaletteOpen} onClose={() => setIsCommandPaletteOpen(false)} groups={navigationGroups} />
    </StoreContextProvider>
  );
}

"use client";

import type { ReactNode } from "react";

import { StoreContextProvider } from "@/components/layout/storeContextProvider";
import { PosOfflineBanner } from "@/components/pos/posOfflineBanner";
import { PosPinLockScreen } from "@/components/pos/posPinLockScreen";
import { PosRegisterProvider } from "@/components/pos/posRegisterProvider";
import { PosRegisterTopBar } from "@/components/pos/posRegisterTopBar";
import { PosServiceWorkerRegistration } from "@/components/pos/posServiceWorkerRegistration";
import { usePosRegisterContext } from "@/hooks/usePosRegisterContext.hook";

import styles from "./posRegisterShell.module.css";

function PosRegisterFrame({ children }: { readonly children: ReactNode }) {
  const { isLocked } = usePosRegisterContext();
  return (
    <div className={styles.frame}>
      <PosRegisterTopBar />
      <PosOfflineBanner />
      <main id="main-content" tabIndex={-1} className={styles.main} inert={isLocked}>
        {children}
      </main>
      {isLocked ? <PosPinLockScreen /> : null}
    </div>
  );
}

export function PosRegisterShell({ children }: { readonly children: ReactNode }) {
  return (
    <StoreContextProvider>
      <PosRegisterProvider>
        <PosServiceWorkerRegistration />
        <PosRegisterFrame>{children}</PosRegisterFrame>
      </PosRegisterProvider>
    </StoreContextProvider>
  );
}

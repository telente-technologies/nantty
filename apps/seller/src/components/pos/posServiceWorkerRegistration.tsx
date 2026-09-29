"use client";

import { useEffect } from "react";

export function PosServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/serviceWorker.js", { scope: "/" }).catch(() => undefined);
  }, []);
  return null;
}

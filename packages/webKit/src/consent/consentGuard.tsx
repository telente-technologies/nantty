/** @jsxRuntime automatic */
/** @jsxImportSource react */
"use client";

import type { ReactNode } from "react";

import type { ConsentCategory } from "./consentPolicy.constant";
import { useConsent } from "./useConsent";

export function ConsentGuard({ category, children, fallback = null }: { readonly category: ConsentCategory; readonly children: ReactNode; readonly fallback?: ReactNode }) {
  const isGranted = useConsent(category);
  return <>{isGranted ? children : fallback}</>;
}

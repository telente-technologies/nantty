"use client";

import type { ReactNode } from "react";
import { BrandLoader, ErrorState as KitErrorState, type BrandLoaderSize } from "@zudomart/web-kit";

import { SignInRequiredState } from "@/components/auth/signInRequiredState";
import { isSignInRequiredError } from "@/services/clientApi.service";

import styles from "./feedback.module.css";
import { useIsOnline } from "./onlineStatus.hook";

export { EmptyState, Skeleton } from "@zudomart/web-kit";

type ErrorStateProps = Parameters<typeof KitErrorState>[0] & { readonly error?: unknown; readonly signInDescription?: string };

export function ErrorState({ error, signInDescription, ...props }: ErrorStateProps) {
  const isOnline = useIsOnline();
  if (isSignInRequiredError(error)) return <SignInRequiredState description={signInDescription} />;
  if (isOnline) return <KitErrorState {...props} />;
  return <KitErrorState {...props} title="You're offline" description="Check your connection. This will load again when you're back online." />;
}

export function Spinner({ label = "Loading", size = "md" }: { readonly label?: string; readonly size?: BrandLoaderSize }) {
  return (
    <span className={styles.spinnerRow}>
      <BrandLoader size={size} label={label} />
    </span>
  );
}

export function InlineSpinner({ label = "Loading" }: { readonly label?: string }) {
  return (
    <span className={styles.inlineRow} role="status">
      <span className={styles.spinnerSmall} aria-hidden="true" />
      <span className={styles.inlineLabel}>{label}</span>
    </span>
  );
}

export function Badge({ children, tone = "neutral" }: { readonly children: ReactNode; readonly tone?: "neutral" | "brand" | "success" | "warning" | "error" }) {
  return <span className={[styles.badge, styles[`badge_${tone}`]].join(" ")}>{children}</span>;
}

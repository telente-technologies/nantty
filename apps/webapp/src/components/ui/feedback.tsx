"use client";

import type { ReactNode } from "react";
import { BrandLoader, ErrorState as KitErrorState, type BrandLoaderSize, type ErrorStateProps as KitErrorStateProps } from "@nantty/web-kit";

import { isSignInRequiredError } from "@/services/clientApi.service";

import styles from "./feedback.module.css";

export { EmptyState, ErrorScreen, NotFoundScreen, Skeleton } from "@nantty/web-kit";

type ErrorStateProps = KitErrorStateProps & { readonly signInDescription?: string };

export function ErrorState({ signInDescription, ...props }: ErrorStateProps) {
  if (signInDescription && isSignInRequiredError(props.error)) return <KitErrorState {...props} kind="signedOut" title="Sign in to see this" description={signInDescription} />;
  return <KitErrorState {...props} />;
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

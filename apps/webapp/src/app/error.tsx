"use client";

import { ErrorState } from "@zudomart/web-kit";

import styles from "./routeFallback.module.css";

export default function RootRouteError({ reset }: { readonly error: Error; readonly reset: () => void }) {
  return (
    <div className={styles.page}>
      <ErrorState title="Something went wrong" description="Please try again in a moment." onRetry={reset} />
    </div>
  );
}

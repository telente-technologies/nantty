"use client";

import { RouteErrorScreen } from "@nantty/web-kit";

import styles from "./routeFallback.module.css";

export default function RootRouteError({ error, retry }: { readonly error: Error & { readonly digest?: string }; readonly retry: () => void }) {
  return (
    <main id="main-content" className={styles.page}>
      <RouteErrorScreen error={error} retry={retry} />
    </main>
  );
}

"use client";

import { RouteErrorScreen } from "@nantty/web-kit";

import styles from "./routeFallback.module.css";
import recoveryStyles from "@/components/errors/errorPage.module.css";

export default function RootRouteError({ error, retry }: { readonly error: Error & { readonly digest?: string }; readonly retry: () => void }) {
  return (
    <main id="main-content" tabIndex={-1} className={`${styles.page} ${recoveryStyles.experience}`}>
      <RouteErrorScreen error={error} retry={retry} />
    </main>
  );
}

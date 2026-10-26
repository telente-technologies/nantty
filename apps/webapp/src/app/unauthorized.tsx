import type { Metadata } from "next";
import { ErrorScreen } from "@nantty/web-kit";

import styles from "./routeFallback.module.css";

export const metadata: Metadata = { title: "Sign in to continue", robots: { index: false } };

export default function UnauthorizedPage() {
  return (
    <main id="main-content" className={styles.page}>
      <ErrorScreen kind="signedOut" />
    </main>
  );
}

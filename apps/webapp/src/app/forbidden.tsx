import type { Metadata } from "next";
import { ErrorScreen } from "@nantty/web-kit";

import styles from "./routeFallback.module.css";

export const metadata: Metadata = { title: "You don't have access", robots: { index: false } };

export default function ForbiddenPage() {
  return (
    <main id="main-content" className={styles.page}>
      <ErrorScreen kind="forbidden" />
    </main>
  );
}

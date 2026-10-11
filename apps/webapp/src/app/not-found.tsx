import type { Metadata } from "next";
import { NotFoundScreen } from "@zudomart/web-kit";

import styles from "./routeFallback.module.css";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFoundPage() {
  return (
    <main id="main-content" className={styles.page}>
      <NotFoundScreen />
    </main>
  );
}

import type { Metadata } from "next";
import { NotFoundScreen } from "@nantty/web-kit";

import styles from "./routeFallback.module.css";
import recoveryStyles from "@/components/errors/errorPage.module.css";

export const metadata: Metadata = { title: "Page not found", robots: { index: false } };

export default function NotFoundPage() {
  return (
    <main id="main-content" tabIndex={-1} className={`${styles.page} ${recoveryStyles.experience}`}>
      <NotFoundScreen />
    </main>
  );
}

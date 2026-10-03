import Link from "next/link";
import { EmptyState } from "@zudomart/web-kit";

import styles from "./routeFallback.module.css";

export default function NotFoundPage() {
  return (
    <div className={styles.page}>
      <EmptyState
        title="We can't find that page"
        description="The link may be broken or the page may have moved."
        action={
          <Link href="/" className={styles.homeLink}>
            Back to home
          </Link>
        }
      />
    </div>
  );
}

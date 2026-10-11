import Link from "next/link";

import styles from "./not-found.module.css";

export default function NotFoundPage() {
  return (
    <main id="main-content" className={styles.page}>
      <p className={styles.code}>404</p>
      <h1 className={styles.title}>This page isn&apos;t here</h1>
      <Link href="/home" className={styles.link}>
        Back to the studio
      </Link>
    </main>
  );
}

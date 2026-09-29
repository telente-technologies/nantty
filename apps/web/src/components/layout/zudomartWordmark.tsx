import Link from "next/link";

import styles from "./zudomartWordmark.module.css";

interface WordmarkProps {
  readonly tone?: "brand" | "light";
}

export function ZudomartWordmarkHomeLink({ tone = "brand" }: WordmarkProps) {
  return (
    <Link href="/" className={`${styles.wordmark} ${styles[tone]}`} aria-label="Zudomart home">
      zudomart
    </Link>
  );
}

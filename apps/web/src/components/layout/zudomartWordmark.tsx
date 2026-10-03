import Link from "next/link";

import { ZudomartWordmark } from "@zudomart/web-kit";

import styles from "./zudomartWordmark.module.css";

interface WordmarkProps {
  readonly tone?: "brand" | "light";
}

export function ZudomartWordmarkHomeLink({ tone = "brand" }: WordmarkProps) {
  return (
    <Link href="/" className={styles.wordmarkLink} aria-label="Zudomart home">
      <ZudomartWordmark tone={tone === "light" ? "onDark" : "onLight"} height={24} />
    </Link>
  );
}

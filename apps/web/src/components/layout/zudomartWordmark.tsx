import Link from "next/link";

import { ZudomartWordmark } from "@zudomart/web-kit";

import styles from "./zudomartWordmark.module.css";

interface WordmarkProps {
  readonly tone?: "brand" | "light";
  readonly collapseOnSmallScreens?: boolean;
}

export function ZudomartWordmarkHomeLink({ tone = "brand", collapseOnSmallScreens = false }: WordmarkProps) {
  return (
    <Link href="/" className={styles.wordmarkLink} aria-label="Zudomart home">
      <ZudomartWordmark tone={tone === "light" ? "onDark" : "onLight"} height={24} withSymbol collapseToMarkOnSmallScreens={collapseOnSmallScreens} />
    </Link>
  );
}

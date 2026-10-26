import Link from "next/link";

import { NanttyWordmark } from "@nantty/web-kit";

import styles from "./nanttyWordmark.module.css";

interface WordmarkProps {
  readonly tone?: "brand" | "light";
  readonly collapseOnSmallScreens?: boolean;
}

export function NanttyWordmarkHomeLink({ tone = "brand", collapseOnSmallScreens = false }: WordmarkProps) {
  return (
    <Link href="/" className={styles.wordmarkLink} aria-label="Nantty home">
      <NanttyWordmark tone={tone === "light" ? "onDark" : "onLight"} height={24} withSymbol collapseToMarkOnSmallScreens={collapseOnSmallScreens} />
    </Link>
  );
}

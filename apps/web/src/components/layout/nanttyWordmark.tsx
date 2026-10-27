import Link from "next/link";

import { NanttyWordmark, ThemeAwareNanttyWordmark } from "@nantty/web-kit";

import styles from "./nanttyWordmark.module.css";

interface WordmarkProps {
  readonly tone?: "brand" | "light";
  readonly collapseOnSmallScreens?: boolean;
}

export function NanttyWordmarkHomeLink({ tone = "brand", collapseOnSmallScreens = false }: WordmarkProps) {
  return (
    <Link href="/" className={styles.wordmarkLink} aria-label="Nantty home">
      {tone === "light" ? <NanttyWordmark tone="onDark" height={30} withSymbol /> : <ThemeAwareNanttyWordmark height={30} collapseToMarkOnSmallScreens={collapseOnSmallScreens} />}
    </Link>
  );
}

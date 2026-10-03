import styles from "./zudomartWordmark.module.css";

export type ZudomartProductLabel = "Studio" | "Ads" | "Admin" | "Dashboard";

interface ZudomartWordmarkProps {
  readonly productLabel?: ZudomartProductLabel;
  readonly tone?: "onLight" | "onDark";
  readonly height?: number;
  readonly hideWordOnNarrowScreens?: boolean;
}

export function ZudomartWordmark({ productLabel, tone = "onLight", height = 22, hideWordOnNarrowScreens = false }: ZudomartWordmarkProps) {
  const wordClass = [styles.word, tone === "onDark" ? styles.onDark : styles.onLight, hideWordOnNarrowScreens ? styles.hideOnNarrow : ""].join(" ");
  return (
    <span className={styles.wordmark} role="img" aria-label={productLabel ? `Zudomart ${productLabel}` : "Zudomart"}>
      <svg className={wordClass} viewBox="0 0 212 48" height={height} width={(height * 212) / 48} aria-hidden="true" focusable="false">
        <text x="0" y="37" fontSize="46" fontWeight="700" fill="currentColor" textLength="212" lengthAdjust="spacingAndGlyphs" fontFamily="inherit">
          zudomart
        </text>
      </svg>
      {productLabel ? <span className={styles.label}>{productLabel}</span> : null}
    </span>
  );
}

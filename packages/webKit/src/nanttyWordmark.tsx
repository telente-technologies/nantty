import type { NanttyWordmarkVariant } from "./brand/nanttyBrand.path";
import styles from "./nanttyWordmark.module.css";

export type NanttyProductLabel = "Studio" | "Ads" | "Admin" | "Dashboard";
export type NanttyWordmarkTone = "onLight" | "onDark" | "mono";

interface NanttyWordmarkProps {
  readonly productLabel?: NanttyProductLabel;
  readonly tone?: NanttyWordmarkTone;
  readonly height?: number;
  readonly hideWordOnNarrowScreens?: boolean;
  readonly collapseToMarkOnSmallScreens?: boolean;
  readonly variant?: NanttyWordmarkVariant;
  readonly withSymbol?: boolean;
  readonly className?: string;
}

const toneClass: Record<NanttyWordmarkTone, string | undefined> = { onLight: styles.onLight, onDark: styles.onDark, mono: styles.mono };

interface NanttyLogoMarkProps {
  readonly size?: number;
  readonly className?: string;
}

export function NanttyLogoMark({ size = 28, className }: NanttyLogoMarkProps) {
  return <img className={[styles.mark, className].filter(Boolean).join(" ")} src="/brand/nantty-icon.png" width={size} height={size} alt="" aria-hidden="true" />;
}

export function NanttySymbol({ height = 20, className }: { readonly height?: number; readonly className?: string }) {
  return <img className={[styles.mark, className].filter(Boolean).join(" ")} src="/brand/nantty-icon.png" height={height} width={height} alt="" aria-hidden="true" />;
}

export function NanttyWordmark({ productLabel, tone = "onLight", height = 22, hideWordOnNarrowScreens = false, collapseToMarkOnSmallScreens = false, className }: NanttyWordmarkProps) {
  const wordClass = [styles.word, toneClass[tone], hideWordOnNarrowScreens ? styles.hideOnNarrow : "", collapseToMarkOnSmallScreens ? styles.hideOnSmall : ""].join(" ");
  return (
    <span className={[styles.wordmark, className ?? ""].join(" ")} role="img" aria-label={productLabel ? `Nantty ${productLabel}` : "Nantty"}>
      <NanttyLogoMark size={Math.round(height * 1.05)} className={styles.brandIcon} />
      <span className={[wordClass, styles.brandName].join(" ")} style={{ fontSize: height }}>Nantty</span>
      {productLabel ? <span className={styles.label}>{productLabel}</span> : null}
    </span>
  );
}

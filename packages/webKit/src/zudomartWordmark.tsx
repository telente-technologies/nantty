import { defaultZudomartWordmarkVariant, zudomartWordmarkFor, type ZudomartWordmarkVariant } from "./brand/zudomartBrand.path";
import { zudomartSymbolBounds, zudomartSymbolPath, zudomartSymbolTileRadius, zudomartSymbolViewBox } from "./brand/zudomartSymbol.path";
import styles from "./zudomartWordmark.module.css";

export type ZudomartProductLabel = "Studio" | "Ads" | "Admin" | "Dashboard";
export type ZudomartWordmarkTone = "onLight" | "onDark" | "mono";

interface ZudomartWordmarkProps {
  readonly productLabel?: ZudomartProductLabel;
  readonly tone?: ZudomartWordmarkTone;
  readonly height?: number;
  readonly hideWordOnNarrowScreens?: boolean;
  readonly collapseToMarkOnSmallScreens?: boolean;
  readonly variant?: ZudomartWordmarkVariant;
  readonly withSymbol?: boolean;
}

const toneClass: Record<ZudomartWordmarkTone, string | undefined> = { onLight: styles.onLight, onDark: styles.onDark, mono: styles.mono };

interface ZudomartLogoMarkProps {
  readonly size?: number;
  readonly className?: string;
}

export function ZudomartLogoMark({ size = 28, className }: ZudomartLogoMarkProps) {
  return (
    <svg className={[styles.mark, className].filter(Boolean).join(" ")} viewBox={`0 0 ${zudomartSymbolViewBox} ${zudomartSymbolViewBox}`} width={size} height={size} aria-hidden="true" focusable="false">
      <rect width={zudomartSymbolViewBox} height={zudomartSymbolViewBox} rx={zudomartSymbolTileRadius} className={styles.markTile} />
      <path d={zudomartSymbolPath()} className={styles.markGlyph} />
    </svg>
  );
}

export function ZudomartSymbol({ height = 20, className }: { readonly height?: number; readonly className?: string }) {
  const { x, y, width, height: boxHeight } = zudomartSymbolBounds;
  return (
    <svg className={className} viewBox={`${x} ${y} ${width} ${boxHeight}`} height={height} width={(height * width) / boxHeight} aria-hidden="true" focusable="false">
      <path d={zudomartSymbolPath()} fill="currentColor" />
    </svg>
  );
}

export function ZudomartWordmark({ productLabel, tone = "onLight", height = 22, hideWordOnNarrowScreens = false, collapseToMarkOnSmallScreens = false, variant = defaultZudomartWordmarkVariant, withSymbol = false }: ZudomartWordmarkProps) {
  const { width: pathWidth, height: pathHeight, d } = zudomartWordmarkFor(variant, height);
  const wordClass = [styles.word, toneClass[tone], hideWordOnNarrowScreens ? styles.hideOnNarrow : "", collapseToMarkOnSmallScreens ? styles.hideOnSmall : ""].join(" ");
  return (
    <span className={styles.wordmark} role="img" aria-label={productLabel ? `Zudomart ${productLabel}` : "Zudomart"}>
      {withSymbol ? <ZudomartSymbol height={Math.round(height * 0.62)} className={[styles.word, toneClass[tone], collapseToMarkOnSmallScreens ? styles.hideOnSmall : ""].join(" ")} /> : null}
      <svg className={wordClass} viewBox={`0 0 ${pathWidth} ${pathHeight}`} height={height} width={(height * pathWidth) / pathHeight} aria-hidden="true" focusable="false">
        <path d={d} fill="currentColor" />
      </svg>
      {collapseToMarkOnSmallScreens ? <ZudomartLogoMark size={Math.round(height * 1.35)} className={styles.showOnSmall} /> : null}
      {productLabel ? <span className={styles.label}>{productLabel}</span> : null}
    </span>
  );
}

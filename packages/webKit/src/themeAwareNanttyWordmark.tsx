import styles from "./themeAwareNanttyWordmark.module.css";
import { NanttyWordmark, type NanttyProductLabel } from "./nanttyWordmark";

export function ThemeAwareNanttyWordmark({ productLabel, height = 30, collapseToMarkOnSmallScreens = false }: { readonly productLabel?: NanttyProductLabel; readonly height?: number; readonly collapseToMarkOnSmallScreens?: boolean }) {
  return (
    <span className={styles.themeAware} aria-hidden="true">
      <NanttyWordmark productLabel={productLabel} tone="onLight" height={height} collapseToMarkOnSmallScreens={collapseToMarkOnSmallScreens} className={styles.lightVariant} />
      <NanttyWordmark productLabel={productLabel} tone="onDark" height={height} collapseToMarkOnSmallScreens={collapseToMarkOnSmallScreens} className={styles.darkVariant} />
    </span>
  );
}

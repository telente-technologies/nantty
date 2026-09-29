import styles from "./adsWordmark.module.css";

export function AdsWordmark({ tone = "onDark", compactOnNarrowScreens = false }: { readonly tone?: "onDark" | "onLight"; readonly compactOnNarrowScreens?: boolean }) {
  return (
    <span className={[styles.wordmark, tone === "onDark" ? styles.onDark : styles.onLight, compactOnNarrowScreens ? styles.compactOnNarrowScreens : ""].join(" ")} aria-label="Zudomart Ads Manager">
      <span className={styles.brand} aria-hidden>
        zudomart
      </span>
      <span className={styles.tag} aria-hidden>
        ads
      </span>
    </span>
  );
}

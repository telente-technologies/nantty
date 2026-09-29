import type { MartHomeFeature } from "@/types/catalog.type";
import { humanizeConstantName } from "@/utils/formatting.util";

import styles from "./featurePreviewCard.module.css";

type PreviewableFeature = Pick<MartHomeFeature, "title" | "subtitle" | "kind" | "imageUrl">;

export function FeaturePreviewCard({ feature, isThumbnail = false }: { readonly feature: PreviewableFeature; readonly isThumbnail?: boolean }) {
  return (
    <figure className={`${styles.card} ${isThumbnail ? styles.thumbnail : ""} ${feature.kind === "HERO_BANNER" ? styles.hero : ""}`}>
      {feature.imageUrl ? <img src={feature.imageUrl} alt="" className={styles.image} referrerPolicy="no-referrer" loading="lazy" /> : <span className={styles.placeholder} />}
      {isThumbnail ? null : (
        <figcaption className={styles.caption}>
          <span className={styles.kind}>{humanizeConstantName(feature.kind)}</span>
          <strong className={styles.title}>{feature.title || "Untitled feature"}</strong>
          {feature.subtitle ? <span className={styles.subtitle}>{feature.subtitle}</span> : null}
          <span className={styles.cta}>Shop now</span>
        </figcaption>
      )}
    </figure>
  );
}

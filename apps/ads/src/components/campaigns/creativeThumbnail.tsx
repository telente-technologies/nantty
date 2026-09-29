import type { Creative } from "@/types/creative.type";

import styles from "./campaignTables.module.css";

export function readCreativeThumbnailUrl(creative: Creative): string | null {
  const firstMedia = creative.media[0];
  if (!firstMedia) return null;
  if (firstMedia.kind === "video") return firstMedia.posterUrl;
  return firstMedia.url || null;
}

export function CreativeThumbnail({ creative }: { readonly creative: Creative }) {
  const thumbnailUrl = readCreativeThumbnailUrl(creative);
  if (!thumbnailUrl) return <span className={styles.thumbnail} aria-hidden />;
  return <img src={thumbnailUrl} alt="" className={styles.thumbnail} loading="lazy" width={40} height={40} />;
}

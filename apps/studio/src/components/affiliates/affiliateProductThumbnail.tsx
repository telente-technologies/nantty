import { PackageIcon } from "@/components/ui/icons";
import { SafeImage } from "@/components/ui/media";

import styles from "./affiliates.module.css";

export function AffiliateProductThumbnail({ name, imageUrl }: { readonly name: string; readonly imageUrl: string | null }) {
  const fallback = (
    <span className={styles.thumbFallback} aria-hidden="true">
      <PackageIcon size={22} />
    </span>
  );
  return imageUrl ? <SafeImage src={imageUrl} alt={name} sizes="56px" className={styles.thumb} fallback={fallback} /> : fallback;
}

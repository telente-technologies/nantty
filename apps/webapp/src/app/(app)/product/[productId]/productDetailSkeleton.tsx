import { Skeleton } from "@/components/ui/feedback";

import styles from "./page.module.css";

export function ProductDetailSkeleton() {
  return (
    <div className={styles.page} role="status" aria-label="Loading product">
      <Skeleton width="40%" height={14} />
      <div className={styles.layout}>
        <div className={styles.left}>
          <Skeleton height="auto" className={styles.skeletonGallery} />
        </div>
        <div className={styles.right}>
          <div className={styles.infoCard}>
            <Skeleton width="30%" height={14} />
            <Skeleton width="85%" height={28} />
            <Skeleton width="40%" height={36} />
            <Skeleton height={44} />
            <Skeleton height={44} />
          </div>
        </div>
      </div>
    </div>
  );
}

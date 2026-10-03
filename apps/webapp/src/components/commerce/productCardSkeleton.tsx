import { Skeleton } from "@/components/ui/feedback";

import styles from "./productCardSkeleton.module.css";

export function ProductCardSkeleton() {
  return (
    <div className={styles.card} aria-hidden="true">
      <Skeleton height="auto" className={styles.media} />
      <Skeleton width="80%" height={14} />
      <Skeleton width="40%" height={16} />
    </div>
  );
}

export function ProductGridSkeleton({ count = 8, gridClassName }: { readonly count?: number; readonly gridClassName?: string }) {
  return (
    <div className={gridClassName} role="status" aria-label="Loading products">
      {Array.from({ length: count }, (_, index) => (
        <ProductCardSkeleton key={index} />
      ))}
    </div>
  );
}

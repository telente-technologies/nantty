import { Skeleton } from "@/components/ui/feedback";

import styles from "./postCardSkeleton.module.css";

export function PostCardSkeleton() {
  return (
    <div className={styles.card} aria-hidden="true">
      <div className={styles.header}>
        <Skeleton width={40} height={40} circle />
        <div className={styles.headerText}>
          <Skeleton width="40%" height={14} />
          <Skeleton width="22%" height={12} />
        </div>
      </div>
      <Skeleton width="92%" height={14} />
      <Skeleton width="64%" height={14} />
      <Skeleton height={240} />
    </div>
  );
}

export function PostFeedSkeleton({ count = 3 }: { readonly count?: number }) {
  return (
    <div className={styles.list} role="status" aria-label="Loading your feed">
      {Array.from({ length: count }, (_, index) => (
        <PostCardSkeleton key={index} />
      ))}
    </div>
  );
}

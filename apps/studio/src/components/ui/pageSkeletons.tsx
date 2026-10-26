import { Skeleton } from "@nantty/web-kit";

import styles from "./pageSkeletons.module.css";

export function ListPageSkeleton({ label = "Loading", rows = 4 }: { readonly label?: string; readonly rows?: number }) {
  return (
    <div className={styles.page} role="status" aria-live="polite">
      <span className="visuallyHidden">{label}</span>
      <Skeleton width="min(240px, 60%)" height={28} />
      <Skeleton width="min(520px, 90%)" height={14} />
      <Skeleton height={96} className={styles.card} />
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className={styles.row}>
          <Skeleton width="55%" height={16} />
          <Skeleton width="80%" height={12} />
        </div>
      ))}
    </div>
  );
}

export function ControlRoomSkeleton({ label = "Loading" }: { readonly label?: string }) {
  return (
    <div className={styles.page} role="status" aria-live="polite">
      <span className="visuallyHidden">{label}</span>
      <Skeleton width={96} height={14} />
      <Skeleton width="min(360px, 80%)" height={28} />
      <Skeleton width="min(420px, 90%)" height={14} />
      <div className={styles.grid}>
        <Skeleton height={220} className={styles.card} />
        <Skeleton height={220} className={styles.card} />
      </div>
    </div>
  );
}

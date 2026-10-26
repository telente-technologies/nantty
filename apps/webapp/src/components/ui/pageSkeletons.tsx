import type { ReactNode } from "react";
import { Skeleton } from "@nantty/web-kit";

import styles from "./pageSkeletons.module.css";

function SkeletonRegion({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div className={styles.region} role="status" aria-busy="true">
      <span className="visuallyHidden">{label}</span>
      {children}
    </div>
  );
}

export function ListRowsSkeleton({ label, rows = 5, withAvatar = true }: { readonly label: string; readonly rows?: number; readonly withAvatar?: boolean }) {
  return (
    <SkeletonRegion label={label}>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className={styles.row}>
          {withAvatar ? <Skeleton width={44} height={44} circle /> : null}
          <span className={styles.rowText}>
            <Skeleton width={`${55 - (index % 3) * 10}%`} height={14} />
            <Skeleton width={`${85 - (index % 2) * 15}%`} height={12} />
          </span>
        </div>
      ))}
    </SkeletonRegion>
  );
}

export function DetailSkeleton({ label, blocks = 3 }: { readonly label: string; readonly blocks?: number }) {
  return (
    <SkeletonRegion label={label}>
      <Skeleton width="45%" height={28} />
      <Skeleton width="30%" height={14} />
      {Array.from({ length: blocks }, (_, index) => (
        <div key={index} className={styles.card}>
          <Skeleton width="35%" height={16} />
          <Skeleton height={12} />
          <Skeleton width="80%" height={12} />
        </div>
      ))}
    </SkeletonRegion>
  );
}

export function StatGridSkeleton({ label, tiles = 4 }: { readonly label: string; readonly tiles?: number }) {
  return (
    <SkeletonRegion label={label}>
      <Skeleton width="40%" height={28} />
      <div className={styles.grid}>
        {Array.from({ length: tiles }, (_, index) => (
          <div key={index} className={styles.card}>
            <Skeleton width="50%" height={12} />
            <Skeleton width="70%" height={24} />
          </div>
        ))}
      </div>
      <div className={styles.card}>
        <Skeleton height={160} />
      </div>
    </SkeletonRegion>
  );
}

export function ProfileSkeleton({ label }: { readonly label: string }) {
  return (
    <SkeletonRegion label={label}>
      <Skeleton height={140} className={styles.banner} />
      <div className={styles.profileHead}>
        <Skeleton width={88} height={88} circle />
        <span className={styles.rowText}>
          <Skeleton width="40%" height={20} />
          <Skeleton width="25%" height={14} />
        </span>
      </div>
      <Skeleton width="75%" height={12} />
      <div className={styles.grid}>
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} height={180} />
        ))}
      </div>
    </SkeletonRegion>
  );
}

export function ChatMessagesSkeleton({ label }: { readonly label: string }) {
  return (
    <SkeletonRegion label={label}>
      {[60, 40, 70, 35, 55].map((width, index) => (
        <div key={index} className={index % 2 === 0 ? styles.bubbleTheirs : styles.bubbleMine}>
          <Skeleton width={`${width}%`} height={36} className={styles.bubble} />
        </div>
      ))}
    </SkeletonRegion>
  );
}

export function ProductDetailSkeleton({ label }: { readonly label: string }) {
  return (
    <SkeletonRegion label={label}>
      <div className={styles.split}>
        <Skeleton height="auto" className={styles.squareMedia} />
        <div className={styles.rowText}>
          <Skeleton width="70%" height={24} />
          <Skeleton width="30%" height={20} />
          <Skeleton height={12} />
          <Skeleton width="85%" height={12} />
          <Skeleton width="60%" height={12} />
          <Skeleton height={48} className={styles.pill} />
        </div>
      </div>
    </SkeletonRegion>
  );
}

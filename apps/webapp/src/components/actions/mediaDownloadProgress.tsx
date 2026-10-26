"use client";

import type { BrandedDownloadProgress } from "./brandedMediaDownload.hook";
import styles from "./mediaDownloadProgress.module.css";

export function MediaDownloadProgress({ download, onCancel }: { readonly download: BrandedDownloadProgress; readonly onCancel: () => void }) {
  const percent = Math.round(download.progress * 100);
  const label = download.progress >= 1 ? "Starting download…" : `Adding the Nantty tag to your ${download.mediaType === "video" ? "video" : "photo"}… ${percent}%`;
  return (
    <div className={styles.card} role="status" aria-live="polite">
      <div className={styles.row}>
        <span className={styles.label}>{label}</span>
        <button type="button" className={styles.cancel} onClick={onCancel}>
          Cancel
        </button>
      </div>
      <div className={styles.track} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="Download progress">
        <div className={styles.fill} style={{ width: `${Math.max(4, percent)}%` }} />
      </div>
    </div>
  );
}

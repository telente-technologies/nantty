import type { LiveIncidentFrame } from "@/types/liveIncident.type";
import { formatDateTime, humanizeConstantName } from "@/utils/formatting.util";

import styles from "./liveIncidents.module.css";

export function LiveIncidentFrameGrid({ frames, emptyMessage }: { readonly frames: readonly LiveIncidentFrame[]; readonly emptyMessage: string }) {
  if (frames.length === 0) return <p className={styles.muted}>{emptyMessage}</p>;
  return (
    <ul className={styles.frameGrid}>
      {frames.map((frame) => (
        <li key={frame.id} className={styles.frameCard}>
          {frame.restricted ? (
            <div className={styles.restrictedFrame} role="note">
              Restricted. A hash match was found. Only the legal team can access preserved evidence.
            </div>
          ) : frame.previewUrl ? (
            <img src={frame.previewUrl} alt={`Live frame captured ${formatDateTime(frame.capturedAt)}`} className={styles.frameImage} loading="lazy" referrerPolicy="no-referrer" />
          ) : (
            <div className={styles.restrictedFrame}>Preview unavailable</div>
          )}
          <div className={styles.frameMeta}>
            <span>{formatDateTime(frame.capturedAt)}</span>
            {frame.actionTaken !== "none" ? <span className={styles.actionTag}>{humanizeConstantName(frame.actionTaken)}</span> : null}
          </div>
          {frame.categories.length > 0 ? (
            <ul className={styles.labelList} aria-label="Detected categories">
              {frame.categories.slice(0, 3).map((category) => (
                <li key={category.category}>
                  {humanizeConstantName(category.category)} <strong>{Math.round(category.confidence * 100)}%</strong>
                </li>
              ))}
            </ul>
          ) : null}
          {frame.labels.length > 0 ? (
            <p className={styles.labelLine} title={frame.modelVersion}>
              {frame.labels.slice(0, 4).map((label) => `${label.name} ${Math.round(label.confidence * 100)}%`).join(" · ")}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

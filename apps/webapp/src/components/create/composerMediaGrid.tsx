"use client";

import { AlertIcon, ChevronLeftIcon, ChevronRightIcon, CloseIcon } from "@/components/ui/icons";

import type { ComposerMediaItem } from "./composerMediaUploads.hook";
import styles from "./composer.module.css";

interface ComposerMediaGridProps {
  readonly items: readonly ComposerMediaItem[];
  readonly disabled: boolean;
  readonly onRemove: (localId: string) => void;
  readonly onRetry: (localId: string) => void;
  readonly onMove: (localId: string, offset: -1 | 1) => void;
}

export function ComposerMediaGrid({ items, disabled, onRemove, onRetry, onMove }: ComposerMediaGridProps) {
  if (items.length === 0) return null;
  return (
    <ul className={styles.mediaGrid} aria-label="Photos and videos in this post">
      {items.map((item, index) => {
        const label = `${item.mediaType === "video" ? "Video" : "Photo"} ${index + 1} of ${items.length}`;
        return (
          <li key={item.localId} className={styles.mediaTile} aria-label={label}>
            {item.mediaType === "video" ? (
              <video className={styles.mediaPreview} src={item.previewUrl} muted playsInline preload="metadata" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img className={styles.mediaPreview} src={item.previewUrl} alt="" />
            )}
            {item.status === "uploading" ? (
              <span className={styles.mediaProgress} role="progressbar" aria-label={`Uploading ${label.toLowerCase()}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(item.uploadedFraction * 100)}>
                <span className={styles.mediaProgressBar} style={{ width: `${Math.round(item.uploadedFraction * 100)}%` }} />
              </span>
            ) : null}
            {item.status === "failed" ? (
              <div className={styles.mediaFailed} role="alert">
                <AlertIcon size={18} />
                <span>{item.errorMessage ?? "Upload failed."}</span>
                <button type="button" className={styles.mediaRetry} disabled={disabled} onClick={() => onRetry(item.localId)}>Retry</button>
              </div>
            ) : null}
            <div className={styles.mediaActions}>
              <button type="button" aria-label={`Move ${label.toLowerCase()} earlier`} disabled={disabled || index === 0} onClick={() => onMove(item.localId, -1)}>
                <ChevronLeftIcon size={14} />
              </button>
              <button type="button" aria-label={`Move ${label.toLowerCase()} later`} disabled={disabled || index === items.length - 1} onClick={() => onMove(item.localId, 1)}>
                <ChevronRightIcon size={14} />
              </button>
              <button type="button" aria-label={`Remove ${label.toLowerCase()}`} disabled={disabled} onClick={() => onRemove(item.localId)}>
                <CloseIcon size={14} />
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

import type { AudioMatchHint } from "@/types/copyright.type";

import styles from "./copyrightClaim.module.css";

function formatSecondsAsClock(totalSeconds: number): string {
  return `${Math.floor(totalSeconds / 60)}:${String(Math.round(totalSeconds % 60)).padStart(2, "0")}`;
}

export function AudioMatchHints({ matches }: { readonly matches: readonly AudioMatchHint[] }) {
  if (matches.length === 0) return <p className={styles.muted}>No audio fingerprint matches for this target.</p>;
  return (
    <ul className={styles.matchList}>
      {matches.map((match) => (
        <li key={`${match.matchedTrack}-${match.artist}`} className={styles.matchItem}>
          <div className={styles.matchHeader}>
            <span>
              <strong>{match.matchedTrack}</strong> <span className={styles.muted}>— {match.artist}</span>
            </span>
            <span className={match.confidencePercent >= 90 ? styles.confidenceHigh : match.confidencePercent >= 60 ? styles.confidenceMedium : styles.confidenceLow}>{match.confidencePercent}% match</span>
          </div>
          <ul className={styles.segmentList}>
            {match.segments.map((segment) => (
              <li key={`${segment.targetStartSeconds}-${segment.referenceStartSeconds}`} className="mono">
                Upload {formatSecondsAsClock(segment.targetStartSeconds)}–{formatSecondsAsClock(segment.targetEndSeconds)} matches reference from {formatSecondsAsClock(segment.referenceStartSeconds)}
              </li>
            ))}
          </ul>
          <span className={styles.muted}>{match.source}</span>
        </li>
      ))}
    </ul>
  );
}

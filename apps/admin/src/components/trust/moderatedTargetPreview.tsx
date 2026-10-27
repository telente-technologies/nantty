import { StatusBadge } from "@/components/ui/statusBadge";
import { NanttyIcon } from "@/components/ui/nanttyIcon";
import type { ModeratedTargetPreview } from "@/types/moderation.type";
import { formatDateTime, humanizeConstantName } from "@/utils/formatting.util";

import styles from "./trustShared.module.css";

export function ModeratedTargetPreviewCard({ target }: { readonly target: ModeratedTargetPreview }) {
  return (
    <div className={styles.preview}>
      <div className={styles.previewBadges}>
        <StatusBadge label={humanizeConstantName(target.type)} tone="info" hasDot={false} />
        <StatusBadge status={target.visibility} />
        <code className={styles.muted}>{target.id}</code>
        <span className={styles.muted}>Posted {formatDateTime(target.createdAt)}</span>
      </div>
      {target.title ? <p className={styles.previewTitle}>{target.title}</p> : null}
      {target.text ? <p className={styles.previewText}>{target.text}</p> : null}
      {target.mediaUrls.length > 0 ? (
        <div className={styles.mediaStrip}>
          {target.mediaUrls.map((mediaUrl, index) => (
            <img key={mediaUrl} src={mediaUrl} alt={`Reported media ${index + 1}`} className={styles.mediaThumbnail} loading="lazy" referrerPolicy="no-referrer" />
          ))}
        </div>
      ) : null}
      {target.soundTitle ? (
        <span className={styles.soundLine}>
          <NanttyIcon name="speakerHigh24" size={14} />
          {target.soundTitle}
        </span>
      ) : null}
    </div>
  );
}

export function ModeratedTargetTableCell({ target }: { readonly target: ModeratedTargetPreview }) {
  const firstMedia = target.mediaUrls[0];
  return (
    <span className={styles.targetCell}>
      {firstMedia ? <img src={firstMedia} alt="" className={styles.mediaThumbnailSmall} loading="lazy" referrerPolicy="no-referrer" /> : null}
      <span className={styles.targetCellText}>
        <span className={styles.truncate}>{target.title ?? target.text ?? target.id}</span>
        <span className={styles.muted}>{humanizeConstantName(target.type)} · {target.id}</span>
      </span>
    </span>
  );
}

export function ClassifierScoreBars({ scores, source = "Intelligence service" }: { readonly scores: readonly { label: string; score: number }[]; readonly source?: string }) {
  if (scores.length === 0) return <p className={styles.muted}>No classifier signals.</p>;
  return (
    <ul className={styles.scoreList} aria-label={`${source} classifier scores`}>
      {scores.map((score) => {
        const percent = Math.round(score.score * 100);
        const fillClassName = percent >= 80 ? styles.scoreFillHigh : percent >= 50 ? styles.scoreFillMedium : "";
        return (
          <li key={score.label} className={styles.scoreRow}>
            <span className={styles.scoreLabel}>{score.label}</span>
            <span className={styles.scoreTrack} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label={score.label}>
              <span className={`${styles.scoreFill} ${fillClassName}`} style={{ width: `${percent}%`, display: "block" }} />
            </span>
            <span className={styles.scoreValue}>{percent}%</span>
          </li>
        );
      })}
    </ul>
  );
}

export function DueTimeLabel({ dueAt, isOpen }: { readonly dueAt: string; readonly isOpen: boolean }) {
  const differenceInMinutes = Math.round((new Date(dueAt).getTime() - Date.now()) / 60_000);
  const amount = formatMinutesAsShortDuration(Math.abs(differenceInMinutes));
  if (!isOpen) return <span className={styles.muted}>Closed</span>;
  return differenceInMinutes < 0 ? <span className={styles.overdue}>Past SLA by {amount}</span> : <span className={styles.muted}>Due in {amount}</span>;
}

function formatMinutesAsShortDuration(minutes: number): string {
  if (minutes >= 1440) return `${Math.round(minutes / 1440)}d`;
  if (minutes >= 60) return `${Math.round(minutes / 60)}h`;
  return `${minutes}m`;
}

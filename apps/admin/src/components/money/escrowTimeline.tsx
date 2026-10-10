import { StatusBadge, type BadgeTone } from "@/components/ui/statusBadge";
import type { OrderEscrow, OrderTimelineEvent } from "@/types/commerce.type";
import { formatDateTime, formatMoneyForDisplay, formatRelativeTimeFromNow, humanizeConstantName } from "@/utils/formatting.util";

import styles from "./escrowTimeline.module.css";

function readToneForEventKind(kind: string): BadgeTone {
  if (/dispute|fail|cancel/.test(kind)) return "danger";
  if (/refund/.test(kind)) return "info";
  if (/release|deliver|complete/.test(kind)) return "success";
  if (/hold|held|pending/.test(kind)) return "caution";
  return "neutral";
}

export function EscrowSummary({ escrow }: { readonly escrow: OrderEscrow | null }) {
  if (!escrow) return <p className={styles.meta}>No escrow yet. The buyer has not paid or the payment service did not answer.</p>;
  return (
    <div className={styles.summary}>
      <StatusBadge status={escrow.status} />
      <span>
        Held now: <strong className={styles.amount}>{formatMoneyForDisplay(escrow.heldAmount)}</strong>
      </span>
      <span>Seller share {formatMoneyForDisplay(escrow.sellerAmount)} · fee {formatMoneyForDisplay(escrow.commission)} · refunded {formatMoneyForDisplay(escrow.refunded)}</span>
      {escrow.autoReleaseAt ? <span className={styles.release}>Auto-release {formatRelativeTimeFromNow(escrow.autoReleaseAt)} ({formatDateTime(escrow.autoReleaseAt)})</span> : null}
      {escrow.releasedAt ? <span className={styles.release}>Released {formatDateTime(escrow.releasedAt)}</span> : null}
      {escrow.refundedAt ? <span className={styles.release}>Refunded {formatDateTime(escrow.refundedAt)}</span> : null}
    </div>
  );
}

export function OrderTimeline({ events }: { readonly events: readonly OrderTimelineEvent[] }) {
  if (events.length === 0) return <p className={styles.meta}>No events recorded yet.</p>;
  return (
    <ol className={styles.timeline}>
      {events.map((event) => {
        const tone = readToneForEventKind(event.kind);
        return (
          <li key={event.id} className={`${styles.event} ${styles[tone] ?? ""}`}>
            <div className={styles.eventHeader}>
              <StatusBadge label={humanizeConstantName(event.kind)} tone={tone} hasDot={false} />
            </div>
            <p className={styles.meta}>
              {event.actorName || "System"} <span className={styles.actorKind}>{event.actorKind.toLowerCase()}</span> · <time dateTime={event.occurredAt}>{formatDateTime(event.occurredAt)}</time>
            </p>
            {event.summary ? <p className={styles.note}>{event.summary}</p> : null}
          </li>
        );
      })}
    </ol>
  );
}

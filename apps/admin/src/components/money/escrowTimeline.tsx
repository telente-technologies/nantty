import { StatusBadge, type BadgeTone } from "@/components/ui/statusBadge";
import type { EscrowState, EscrowEventKind } from "@/types/commerce.type";
import { formatDateTime, formatMoneyForDisplay, formatRelativeTimeFromNow, humanizeConstantName } from "@/utils/formatting.util";

import styles from "./escrowTimeline.module.css";

const toneByEventKind: Record<EscrowEventKind, BadgeTone> = {
  FUNDED: "info", HELD: "caution", SHIPPED: "info", DELIVERED: "success", AUTO_RELEASE_SCHEDULED: "neutral", DISPUTED: "danger", RELEASED: "success", REFUNDED: "info", PARTIALLY_REFUNDED: "info",
};

export function EscrowTimeline({ escrow }: { readonly escrow: EscrowState }) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.summary}>
        <StatusBadge status={escrow.status} />
        <span>
          Held now: <strong className={styles.amount}>{formatMoneyForDisplay(escrow.heldAmount)}</strong>
        </span>
        {escrow.autoReleaseAt ? <span className={styles.release}>Auto-release {formatRelativeTimeFromNow(escrow.autoReleaseAt)} ({formatDateTime(escrow.autoReleaseAt)})</span> : null}
      </div>
      <ol className={styles.timeline}>
        {escrow.timeline.map((event) => (
          <li key={event.id} className={`${styles.event} ${styles[toneByEventKind[event.kind]]}`}>
            <div className={styles.eventHeader}>
              <StatusBadge label={humanizeConstantName(event.kind)} tone={toneByEventKind[event.kind]} hasDot={false} />
              {event.amount ? <span className={styles.amount}>{formatMoneyForDisplay(event.amount)}</span> : null}
            </div>
            <p className={styles.meta}>
              {event.actorName} <span className={styles.actorKind}>{event.actorKind.toLowerCase()}</span> · <time dateTime={event.occurredAt}>{formatDateTime(event.occurredAt)}</time>
            </p>
            {event.note ? <p className={styles.note}>{event.note}</p> : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

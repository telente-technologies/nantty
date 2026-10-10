import { humanizeConstantName } from "@/utils/formatting.util";

import styles from "./statusBadge.module.css";

export type BadgeTone = "neutral" | "info" | "success" | "caution" | "danger" | "brand" | "night";

const toneByStatus: Record<string, BadgeTone> = {
  ACTIVE: "success", VERIFIED: "success", APPROVED: "success", RESOLVED: "success", RELEASED: "success", PAID: "success", COMPLETED: "success", DELIVERED: "success", UPHELD: "danger", OPERATIONAL: "success", ENABLED: "success", LIVE: "success", PUBLISHED: "success", SOLVED: "success", CLOSED: "neutral",
  PENDING: "caution", IN_REVIEW: "caution", OPEN: "caution", HELD: "caution", ON_HOLD: "caution", WARNED: "caution", INVITED: "info", DEGRADED: "caution", AWAITING_COUNTER_NOTICE: "caution", COUNTER_NOTICE: "info", ESCALATED: "danger", NEEDS_INFO: "info", PROCESSING: "info", QUEUED: "info", SENDING: "info", SUPERSEDED: "neutral", DRAFT: "neutral", SCHEDULED: "info",
  REJECTED: "danger", BANNED: "danger", DELETED: "night", SUSPENDED: "danger", REVOKED: "night", DISABLED: "neutral", LOCKED: "danger", FAILED: "danger", DOWN: "danger", REFUNDED: "info", PARTIALLY_REFUNDED: "info", CANCELLED: "neutral", DISMISSED: "neutral", REMOVED: "danger", HIDDEN: "caution", RESTRICTED: "caution", WITHHELD: "night", EXPIRED: "neutral",
  LOW: "success", MEDIUM: "caution", HIGH: "danger", CRITICAL: "danger", URGENT: "danger", NORMAL: "neutral",
  SUPERADMIN: "night", ADMIN: "brand", SUPPORT: "info",
  PENDING_REVIEW: "caution", AWAITING_SELLER: "caution", UNDER_REVIEW: "caution", DISPUTED: "danger", REVIEWED: "success", REVERSED: "night", SUCCEEDED: "success", RESOLVED_RELEASED: "success", RESOLVED_REFUNDED: "info", NEW: "info", READY: "info", SHIPPED: "info",
};

export function readToneForStatus(status: string): BadgeTone {
  return toneByStatus[status.toUpperCase()] ?? "neutral";
}

interface StatusBadgeProps {
  readonly status?: string;
  readonly label?: string;
  readonly tone?: BadgeTone;
  readonly hasDot?: boolean;
}

export function StatusBadge({ status, label, tone, hasDot = true }: StatusBadgeProps) {
  const resolvedTone = tone ?? readToneForStatus(status ?? "");
  return (
    <span className={`${styles.badge} ${styles[resolvedTone]}`}>
      {hasDot ? <span className={styles.dot} aria-hidden /> : null}
      {label ?? humanizeConstantName(status ?? "")}
    </span>
  );
}

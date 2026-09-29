import { deliveryStatusLabels } from "@/constants/campaignOptions.constant";
import type { DeliveryStatus } from "@/types/campaign.type";

import styles from "./statusBadge.module.css";

export type BadgeTone = "neutral" | "info" | "success" | "caution" | "error" | "accent";

export function StatusBadge({ tone, children }: { readonly tone: BadgeTone; readonly children: React.ReactNode }) {
  return <span className={`${styles.badge} ${styles[tone]}`}>{children}</span>;
}

const toneByDeliveryStatus: Record<DeliveryStatus, BadgeTone> = {
  draft: "neutral",
  in_review: "info",
  active: "success",
  paused: "caution",
  completed: "neutral",
  rejected: "error",
};

export function DeliveryStatusBadge({ status }: { readonly status: DeliveryStatus }) {
  return (
    <span className={`${styles.badge} ${styles[toneByDeliveryStatus[status]]}`}>
      <span className={styles.dot} aria-hidden />
      {deliveryStatusLabels[status]}
    </span>
  );
}

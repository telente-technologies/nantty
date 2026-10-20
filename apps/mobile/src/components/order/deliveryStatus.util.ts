import type { StatusTone } from "@/components/escrow/statusPill";
import type { DeliveryStatus } from "@/types";

export const DELIVERY_STATUS_APPEARANCE: Record<DeliveryStatus, { readonly label: string; readonly tone: StatusTone }> = {
  pending: { label: "Pending", tone: "neutral" },
  preparing: { label: "Being prepared", tone: "primary" },
  ready_for_pickup: { label: "Ready to ship", tone: "primary" },
  in_transit: { label: "On the way", tone: "caution" },
  delivered: { label: "Delivered", tone: "success" },
  failed: { label: "Delivery attempt failed", tone: "error" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  returned: { label: "Returned", tone: "caution" },
};

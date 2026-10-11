import type { DisputeReason, DisputeStatus, EscrowDetail, EscrowStage } from "@/types/commerce.type";

import { formatMoneyForDisplay } from "./formatMoney.util";

export type EscrowTone = "neutral" | "brand" | "success" | "warning" | "error";
export type EscrowViewerRole = "buyer" | "seller";

export const ESCROW_STAGE_APPEARANCE: Record<EscrowStage, { readonly label: string; readonly tone: EscrowTone }> = {
  awaiting_payment: { label: "Awaiting payment", tone: "neutral" },
  paid_into_escrow: { label: "Paid into escrow", tone: "brand" },
  seller_preparing: { label: "Seller preparing", tone: "brand" },
  shipped: { label: "On the way", tone: "warning" },
  delivered: { label: "Delivered", tone: "success" },
  buyer_confirmed: { label: "Receipt confirmed", tone: "success" },
  released_to_seller: { label: "Released to seller", tone: "success" },
  disputed: { label: "In dispute", tone: "error" },
  refunded: { label: "Refunded", tone: "neutral" },
};

export const DISPUTE_STATUS_APPEARANCE: Record<DisputeStatus, { readonly label: string; readonly tone: EscrowTone }> = {
  open: { label: "Opened", tone: "error" },
  awaiting_seller: { label: "Waiting for seller", tone: "warning" },
  under_review: { label: "Under review", tone: "brand" },
  resolved_refunded: { label: "Refunded", tone: "success" },
  resolved_released: { label: "Paid to seller", tone: "success" },
  closed: { label: "Closed", tone: "neutral" },
};

export const DISPUTE_REASON_OPTIONS: readonly { readonly id: DisputeReason; readonly label: string; readonly hint: string }[] = [
  { id: "not_received", label: "I didn't receive my order", hint: "Tracking shows delivered or it's very late" },
  { id: "not_as_described", label: "Item isn't as described", hint: "Different colour, size, quality or model" },
  { id: "damaged", label: "Item arrived damaged", hint: "Broken, cracked, leaking or torn" },
  { id: "wrong_item", label: "I received the wrong item", hint: "Not what I ordered at all" },
  { id: "other", label: "Something else", hint: "Tell us what happened" },
];

export const MINIMUM_DISPUTE_DESCRIPTION_LENGTH = 20;
export const MAXIMUM_DISPUTE_DESCRIPTION_LENGTH = 1000;
export const MAXIMUM_DISPUTE_EVIDENCE_PHOTOS = 5;
const REASONS_THAT_NEED_PHOTOS = new Set<DisputeReason>(["damaged", "not_as_described", "wrong_item"]);
const STAGES_BUYER_CAN_CONFIRM = new Set<EscrowStage>(["shipped", "delivered"]);
const STAGES_BUYER_CAN_DISPUTE = new Set<EscrowStage>(["seller_preparing", "paid_into_escrow", "shipped", "delivered"]);

export const disputeReasonLabel = (reason: DisputeReason) => DISPUTE_REASON_OPTIONS.find((option) => option.id === reason)?.label ?? "Other";
export const disputeReasonNeedsPhotos = (reason: DisputeReason | null) => reason !== null && REASONS_THAT_NEED_PHOTOS.has(reason);
export const isDisputeFinished = (status: DisputeStatus) => status.startsWith("resolved") || status === "closed";

export function isDisputeDraftReady(draft: { readonly reason: DisputeReason | null; readonly description: string; readonly evidenceCount: number; readonly uploading: boolean }): boolean {
  if (draft.reason === null || draft.uploading) return false;
  if (draft.description.trim().length < MINIMUM_DISPUTE_DESCRIPTION_LENGTH) return false;
  return !disputeReasonNeedsPhotos(draft.reason) || draft.evidenceCount > 0;
}

export function escrowActionsForViewer(escrow: EscrowDetail, viewerRole: EscrowViewerRole) {
  return {
    canConfirmReceipt: viewerRole === "buyer" && STAGES_BUYER_CAN_CONFIRM.has(escrow.stage),
    canOpenDispute: viewerRole === "buyer" && !escrow.disputeId && STAGES_BUYER_CAN_DISPUTE.has(escrow.stage),
    canMarkShipped: viewerRole === "seller" && escrow.stage === "seller_preparing",
  };
}

export const formatFriendlyDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
export const formatFriendlyDateTime = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export function describeEscrowRelease(escrow: EscrowDetail): string {
  if (escrow.releasedAt) return `Released ${formatFriendlyDate(escrow.releasedAt)}`;
  if (escrow.stage === "disputed") return "Release paused while the dispute is reviewed";
  if (escrow.expectedReleaseAt) return `Expected release: ${formatFriendlyDate(escrow.expectedReleaseAt)}`;
  return "Release date appears once the order ships";
}

export type EscrowStepState = "done" | "current" | "upcoming" | "problem";

export interface EscrowTimelineStep {
  readonly key: string;
  readonly title: string;
  readonly detail: string;
  readonly state: EscrowStepState;
  readonly trackingUrl?: string | null;
}

function lastCompletedStepIndex(escrow: EscrowDetail): number {
  if (escrow.releasedAt) return 5;
  if (escrow.buyerConfirmedAt) return 4;
  if (escrow.deliveredAt) return 3;
  if (escrow.shipment) return 2;
  if (escrow.paidAt) return 0;
  return -1;
}

export function buildEscrowTimelineSteps(escrow: EscrowDetail, viewerRole: EscrowViewerRole): EscrowTimelineStep[] {
  const completed = lastCompletedStepIndex(escrow);
  const paused = escrow.stage === "disputed" || escrow.stage === "refunded";
  const stateFor = (index: number): EscrowStepState => (index <= completed ? "done" : index === completed + 1 && !paused ? "current" : "upcoming");
  const storeName = escrow.store.name;
  const shipment = escrow.shipment;
  const money = formatMoneyForDisplay;
  const steps: EscrowTimelineStep[] = [
    {
      key: "paid",
      title: "Paid into escrow",
      detail: escrow.paidAt ? `${money(escrow.heldAmount)} held safely by Zudomart · ${formatFriendlyDateTime(escrow.paidAt)}` : "Waiting for your payment",
      state: escrow.paidAt ? "done" : "current",
    },
    { key: "preparing", title: "Seller preparing", detail: viewerRole === "seller" ? "Pack the order and add the courier's tracking number" : `${storeName} is packing your order`, state: stateFor(1) },
    {
      key: "shipped",
      title: "Shipped",
      detail: shipment ? `${shipment.courierName} · ${shipment.trackingNumber} · ${formatFriendlyDate(shipment.shippedAt)}` : "Courier and tracking number will appear here",
      state: stateFor(2),
      trackingUrl: shipment?.trackingUrl ?? null,
    },
    {
      key: "delivered",
      title: "Delivered",
      detail: escrow.deliveredAt ? formatFriendlyDateTime(escrow.deliveredAt) : shipment?.estimatedDeliveryAt ? `Expected by ${formatFriendlyDate(shipment.estimatedDeliveryAt)}` : "Arrives after shipping",
      state: stateFor(3),
    },
    {
      key: "confirmed",
      title: escrow.buyerConfirmedAt ? "Buyer confirmed" : "Buyer confirms or auto-release",
      detail: escrow.buyerConfirmedAt
        ? `Confirmed ${formatFriendlyDateTime(escrow.buyerConfirmedAt)}`
        : escrow.autoReleaseAt
          ? `Released automatically on ${formatFriendlyDate(escrow.autoReleaseAt)} unless a problem is reported`
          : "Buyer has 3 days after delivery to confirm or report a problem",
      state: escrow.releasedAt && !escrow.buyerConfirmedAt ? "done" : stateFor(4),
    },
    {
      key: "released",
      title: "Released to seller",
      detail: escrow.releasedAt
        ? `${money(escrow.sellerPayoutAmount)} paid to ${storeName} · ${formatFriendlyDate(escrow.releasedAt)}`
        : `${storeName} receives ${money(escrow.sellerPayoutAmount)} after the ${money(escrow.platformFee)} fee`,
      state: stateFor(5),
    },
  ];
  if (!paused) return steps;
  const problemStep: EscrowTimelineStep = {
    key: "problem",
    title: escrow.stage === "refunded" ? "Refunded to buyer" : "Dispute open — release paused",
    detail: escrow.stage === "refunded" ? `${money(escrow.heldAmount)} returned to the buyer` : "Zudomart is holding the money until the dispute is resolved",
    state: "problem",
  };
  return [...steps.slice(0, completed + 1), problemStep, ...steps.slice(completed + 1)];
}

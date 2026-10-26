import type { DisputeReason, DisputeStatus, EscrowDetail, EscrowStage } from "@/types/commerce.type";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

import type { StatusTone } from "./statusPill";

export const ESCROW_STAGE_APPEARANCE: Record<EscrowStage, { label: string; tone: StatusTone }> = {
  awaiting_payment: { label: "Awaiting payment", tone: "neutral" },
  paid_into_escrow: { label: "Paid into escrow", tone: "primary" },
  seller_preparing: { label: "Seller preparing", tone: "primary" },
  shipped: { label: "On the way", tone: "caution" },
  delivered: { label: "Delivered", tone: "success" },
  buyer_confirmed: { label: "Receipt confirmed", tone: "success" },
  released_to_seller: { label: "Released to seller", tone: "success" },
  disputed: { label: "In dispute", tone: "error" },
  under_review: { label: "Under review", tone: "caution" },
  refunded: { label: "Refunded", tone: "neutral" },
};

export const formatFriendlyDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

export const formatFriendlyDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export const DISPUTE_STATUS_APPEARANCE: Record<DisputeStatus, { label: string; tone: StatusTone }> = {
  open: { label: "Opened", tone: "error" },
  awaiting_seller: { label: "Waiting for seller", tone: "caution" },
  under_review: { label: "Under review", tone: "primary" },
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

export const disputeReasonLabel = (reason: DisputeReason) => DISPUTE_REASON_OPTIONS.find((option) => option.id === reason)?.label ?? "Other";

export const STAGES_BUYER_CAN_CONFIRM = new Set<EscrowStage>(["shipped", "delivered", "under_review"]);
export const STAGES_BUYER_CAN_DISPUTE = new Set<EscrowStage>(["seller_preparing", "paid_into_escrow", "shipped", "delivered", "under_review"]);

export function describeEscrowRelease(escrow: EscrowDetail): string {
  if (escrow.releasedAt) return `Released ${formatFriendlyDate(escrow.releasedAt)}`;
  if (escrow.stage === "disputed") return "Release paused while the dispute is reviewed";
  if (escrow.stage === "under_review") return "Under review by Nantty staff. The seller isn't paid until it's settled";
  if (escrow.expectedReleaseAt) return `Expected release: ${formatFriendlyDate(escrow.expectedReleaseAt)}`;
  return "Release date appears once the order ships";
}

export function escrowPausedStepCopy(escrow: EscrowDetail): { readonly title: string; readonly detail: string } {
  if (escrow.stage === "refunded") return { title: "Refunded to buyer", detail: describeRefundReturned(escrow) };
  if (escrow.stage === "under_review") return { title: "Not delivered after 30 days — under review", detail: "Nantty staff will contact the buyer and the seller. The money stays held until staff release it or refund it" };
  return { title: "Dispute open — release paused", detail: "Nantty is holding the money until the dispute is resolved" };
}

function describeRefundReturned(escrow: EscrowDetail): string {
  const kept = escrow.feesKeptOnRefund;
  if (!kept || kept.amountMinor <= 0) return `${formatMoneyForDisplay(escrow.refundedAmount ?? escrow.heldAmount)} returned to the buyer`;
  return `${formatMoneyForDisplay(escrow.refundedAmount ?? escrow.heldAmount)} returned to the buyer. The seller had already been paid, so Nantty kept its ${formatMoneyForDisplay(kept)} fees`;
}

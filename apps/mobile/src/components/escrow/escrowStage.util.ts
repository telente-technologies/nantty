import type { DisputeReason, DisputeStatus, EscrowStage } from "@/types/commerce.type";

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

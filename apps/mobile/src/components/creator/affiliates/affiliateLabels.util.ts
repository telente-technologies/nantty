import type { Money } from "@/types/money.type";
import type { AffiliateAccess, AffiliateEarning } from "@/types/affiliate.type";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

export const affiliateAccessLabels: Record<AffiliateAccess, string> = {
  approved: "Approved",
  paused: "Paused",
  requested: "Requested",
  open: "Open to you",
  approval_required: "Needs approval",
  closed: "Closed",
};

export const affiliateAccessTones = { approved: "success", paused: "neutral", requested: "caution", open: "primary", approval_required: "neutral", closed: "neutral" } as const;

export const affiliatePayoutLabels: Record<AffiliateEarning["payoutStatus"], string> = {
  awaiting_completion: "Paid when the order completes",
  waiting_for_seller_funds: "Earned, waiting for the seller's wallet",
  transferring: "Earned, transfer in progress",
  paid: "Paid to your wallet",
  reversed: "Reversed",
  not_paid: "Not paid",
};

const reversalReasons: Record<string, string> = {
  cancelled: "Cancelled before completion",
  refunded: "Refunded before completion",
  returned: "Returned before completion",
  ineligible: "Not eligible at completion",
  refunded_after_completion: "Refunded after completion",
};

export const describeAffiliateReversal = (reason: string) => reversalReasons[reason] ?? "Reversed";

export const formatMoneyList = (amounts: readonly Money[]) => (amounts.length === 0 ? "0" : amounts.map((amount) => formatMoneyForDisplay(amount)).join(" + "));

export const formatConversion = (percent: number | null) => (percent === null ? "No clicks yet" : `${percent.toFixed(percent < 10 ? 1 : 0)}%`);

export const describeAffiliateEarning = (earning: AffiliateEarning) =>
  `Affiliate commission from ${earning.store.name || "the store"}, ${earning.orderNumber ? `order #${earning.orderNumber.replace(/^#/, "")}` : "order"} (${earning.product.name || "product"})`;

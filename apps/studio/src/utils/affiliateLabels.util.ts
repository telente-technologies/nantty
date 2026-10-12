import type { Money } from "@/types";
import type { AffiliateAccess, AffiliateEarning } from "@/types/affiliate.type";

import { formatMoneyForDisplay } from "./formatMoney.util";

export const affiliateAccessLabels: Record<AffiliateAccess, string> = {
  approved: "Approved",
  paused: "Paused by seller",
  requested: "Request sent",
  open: "Open to you",
  approval_required: "Needs approval",
  closed: "Programme closed",
};

export const affiliatePayoutLabels: Record<AffiliateEarning["payoutStatus"], string> = {
  awaiting_completion: "Paid when the order completes",
  waiting_for_seller_funds: "Earned, waiting for the seller's wallet",
  transferring: "Earned, transfer in progress",
  paid: "Paid to your wallet",
  reversed: "Reversed",
  not_paid: "Not paid",
};

const reversalReasons: Record<string, string> = {
  cancelled: "Order cancelled before completion",
  refunded: "Refunded before completion",
  returned: "Returned before completion",
  ineligible: "Not eligible when the order completed",
  refunded_after_completion: "Refunded after completion",
};

export const describeAffiliateReversal = (reason: string) => reversalReasons[reason] ?? "Reversed";

export const attributionSourceLabels: Record<string, string> = { link: "Your link", post: "Tagged post", clip: "Tagged clip", live: "Live shopping" };

export function formatMoneyList(amounts: readonly Money[]): string {
  return amounts.length === 0 ? "0" : amounts.map((amount) => formatMoneyForDisplay(amount)).join(" + ");
}

export const formatConversion = (percent: number | null) => (percent === null ? "No clicks yet" : `${percent.toFixed(percent < 10 ? 1 : 0)}%`);

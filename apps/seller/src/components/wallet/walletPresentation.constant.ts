import type { StatusTone } from "@/components/ui/statusBadge";
import type { RefundEntry } from "@/types/finance.type";
import type { WalletTransactionKind } from "@/types/wallet.type";

export const walletTransactionKindLabels: Record<WalletTransactionKind, string> = {
  escrow_hold: "Held in escrow",
  escrow_release: "Escrow release",
  payout: "Payout",
  refund: "Refund",
  fee: "Fee",
  affiliate_commission: "Affiliate commission",
  ads_charge: "Ads",
  subscription_charge: "Plan subscription",
  adjustment: "Adjustment",
};

export const walletBalanceBucketLabels = { escrow: "Escrow", pending: "Pending", available: "Available" } as const;

export const refundKindPresentation: Record<RefundEntry["kind"], { readonly label: string; readonly tone: StatusTone }> = {
  cancelled_before_shipping: { label: "Cancelled", tone: "neutral" },
  refunded_order: { label: "Refunded order", tone: "caution" },
  approved_return: { label: "Return", tone: "info" },
};

export const payoutStatusPresentation = {
  processing: { label: "Processing", tone: "info" },
  paid: { label: "Paid", tone: "success" },
  failed: { label: "Failed", tone: "error" },
} as const satisfies Record<string, { readonly label: string; readonly tone: StatusTone }>;

export function formatStatementMonthLabel(month: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-15T12:00:00.000Z`));
}

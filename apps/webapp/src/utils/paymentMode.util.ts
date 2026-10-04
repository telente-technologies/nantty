import type { PaymentMode, StoreSummary } from "@/types";

export function isDirectPaymentStore(store: StoreSummary | null | undefined): boolean {
  return store?.verification?.color === "gold" && store.verification.status === "active";
}

export function toPaymentModeChoices(modes: Readonly<Record<string, PaymentMode>>): { storeId: string; paymentMode: PaymentMode }[] {
  return Object.entries(modes).map(([storeId, paymentMode]) => ({ storeId, paymentMode }));
}

export function describeStoreTrust(store: StoreSummary): string {
  if (store.successRate != null) return `${Math.round(store.successRate * 100)}% success rate`;
  return store.ratingCount > 0 ? `${store.rating.toFixed(1)} rating (${store.ratingCount})` : "New store";
}

export const paymentModeLabels: Record<PaymentMode, string> = { escrow: "Escrow protection", direct: "Paid directly to seller" };

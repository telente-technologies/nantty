import type { AdCreditGrant, AdCreditSource, AdCreditStatus } from "@/types/adCredit.type";
import type { Money } from "@/types/api.type";
import { formatDateOnly, formatMoneyForDisplay } from "@/utils/formatting.util";

export const defaultCashbackPercent = 10;
export const minimumCashbackPercent = 1;
export const maximumCashbackPercent = 50;

export const adCreditStatusFilterOptions: readonly { readonly value: "" | AdCreditStatus; readonly label: string }[] = [
  { value: "", label: "Any status" },
  { value: "active", label: "Active" },
  { value: "spent", label: "Spent" },
  { value: "expired", label: "Expired" },
  { value: "revoked", label: "Revoked" },
];

const sourceLabels: Record<AdCreditSource, string> = {
  admin_issued: "Issued by Nantty",
  cashback: "Cashback",
  premium_free_boost: "Premium free boost",
  boost_refund: "Boost refund",
  legacy: "Earlier credit",
};

export const adCreditSourceFilterOptions: readonly { readonly value: "" | AdCreditSource; readonly label: string }[] = [
  { value: "", label: "Any source" },
  ...(Object.keys(sourceLabels) as AdCreditSource[]).map((source) => ({ value: source, label: sourceLabels[source] })),
];

export function describeAdCreditSource(source: string): string {
  return sourceLabels[source as AdCreditSource] ?? source;
}

export function describeAdCreditExpiry(expiresAt: string | null): string {
  return expiresAt ? `Expires on ${formatDateOnly(expiresAt)}` : "No expiry";
}

export function describeRemainingAdCreditLine(credit: Pick<AdCreditGrant, "remaining" | "expiresAt">): string {
  return credit.expiresAt ? `${formatMoneyForDisplay(credit.remaining)} expires on ${formatDateOnly(credit.expiresAt)}` : `${formatMoneyForDisplay(credit.remaining)} with no expiry`;
}

export function canRevokeAdCredit(credit: Pick<AdCreditGrant, "status" | "remaining">): boolean {
  return credit.status === "active" && credit.remaining.amountMinor > 0;
}

export function isCashbackPercentAllowed(percent: number): boolean {
  return Number.isInteger(percent) && percent >= minimumCashbackPercent && percent <= maximumCashbackPercent;
}

export function isCurrencyCodeShaped(currency: string): boolean {
  return /^[A-Z]{3}$/.test(currency);
}

export function convertExpiryDateInputToIsoEndOfDay(dateInputValue: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateInputValue)) return null;
  const parsed = new Date(`${dateInputValue}T23:59:59.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function isExpiryInTheFuture(isoText: string | null, nowEpochMs: number = Date.now()): boolean {
  return isoText === null || new Date(isoText).getTime() > nowEpochMs;
}

export function isPositiveMoney(amount: Money | null): amount is Money {
  return amount !== null && amount.amountMinor > 0;
}

export function buildSubmissionSignature(parts: readonly unknown[]): string {
  return JSON.stringify(parts);
}

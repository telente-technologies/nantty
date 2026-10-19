import { ApiError } from "@/errors/api.error";
import type { GoldCoverage, GoldForBusinessesInterval, GoldForBusinessesQuote, GoldForBusinessesRules } from "@/types/goldForBusinesses.type";
import type { Money } from "@/types/money.type";

import { formatMoneyForDisplay } from "./formatMoney.util";

export const GOLD_FOR_BUSINESSES_TITLE = "Gold for all your businesses";
export const GOLD_FOR_BUSINESSES_PREMIUM_UPSELL = "Get Blue Premium to cover all your businesses with one Gold plan, up to 16% off.";

export interface GoldQuoteRow {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly emphasis?: boolean;
}

export function percentFromBasisPoints(basisPoints: number): string {
  const percent = basisPoints / 100;
  return `${Number.isInteger(percent) ? percent : percent.toFixed(1)}%`;
}

const intervalWord = (interval: GoldForBusinessesInterval) => (interval === "year" ? "year" : "month");

function discountValue(amountMinor: number, currency: Money["currency"]): string {
  return `−${formatMoneyForDisplay({ amountMinor: Math.abs(amountMinor), currency })}`;
}

export function goldQuoteBreakdownRows(quote: GoldForBusinessesQuote): GoldQuoteRow[] {
  const { breakdown, currency } = quote;
  const businesses = breakdown.profileCount === 1 ? "1 business" : `${breakdown.profileCount} businesses`;
  const rows: GoldQuoteRow[] = [
    { key: "perProfile", label: "Gold per business", value: `${formatMoneyForDisplay(quote.unitMonthlyPrice)}/month` },
    { key: "list", label: breakdown.months > 1 ? `${businesses} × ${breakdown.months} months` : businesses, value: formatMoneyForDisplay(quote.listTotal) },
  ];
  if (breakdown.tierDiscountMinor > 0) rows.push({ key: "tier", label: `Multi-business discount (${percentFromBasisPoints(breakdown.tierBps)})`, value: discountValue(breakdown.tierDiscountMinor, currency) });
  if (breakdown.yearlyExtraDiscountMinor > 0) rows.push({ key: "yearlyExtra", label: `Extra yearly discount (${percentFromBasisPoints(breakdown.yearlyExtraBps)})`, value: discountValue(breakdown.yearlyExtraDiscountMinor, currency) });
  if (breakdown.standardYearlyDiscountMinor > 0) rows.push({ key: "standardYearly", label: `Yearly discount (${percentFromBasisPoints(breakdown.standardYearlyBps)})`, value: discountValue(breakdown.standardYearlyDiscountMinor, currency) });
  if (quote.discount.offerDiscountMinor) rows.push({ key: "offer", label: "Offer discount", value: discountValue(quote.discount.offerDiscountMinor, currency) });
  rows.push({ key: "total", label: `Total per ${intervalWord(quote.interval)}`, value: formatMoneyForDisplay(quote.total), emphasis: true });
  return rows;
}

export function goldQuotePerBusinessRows(quote: GoldForBusinessesQuote): GoldQuoteRow[] {
  return quote.profiles.map((profile) => ({ key: profile.profileId, label: profile.displayName, value: `${formatMoneyForDisplay(profile.price)}/${intervalWord(quote.interval)}` }));
}

export function goldTierRows(rules: GoldForBusinessesRules): GoldQuoteRow[] {
  return rules.tiers.map((tier) => ({ key: String(tier.profiles), label: tier.profiles === 1 ? "1 business" : `${tier.profiles} businesses`, value: `${percentFromBasisPoints(tier.discountBps)} off` }));
}

export function toggleGoldProfileSelection(selected: readonly string[], profileId: string, maximumProfiles: number): string[] {
  if (selected.includes(profileId)) return selected.filter((id) => id !== profileId);
  if (selected.length >= maximumProfiles) return [...selected];
  return [...selected, profileId];
}

export function describeGoldCoverage(coverage: GoldCoverage): string | null {
  if (coverage === "active") return "Covered";
  if (coverage === "pending") return "Waiting for business verification";
  if (coverage === "removing") return "Leaves the plan at renewal";
  return null;
}

const FAILURE_COPY: Readonly<Record<string, string>> = {
  PREMIUM_REQUIRED: "This plan needs Blue Premium. Get Premium first, then come back to cover your businesses.",
  COMBINED_GOLD_PROFILES_INVALID: "One of those businesses can't be added. Pick from your own businesses that don't already have Gold.",
  COMBINED_GOLD_TOO_MANY_PROFILES: "You can cover up to 5 businesses with one plan.",
  PROFILE_ALREADY_HAS_GOLD: "One of those businesses already has its own Gold plan.",
  PROFILE_COVERED_BY_COMBINED_GOLD: "One of those businesses is already covered by this plan.",
  ALREADY_SUBSCRIBED: "You already have this plan. Change the businesses it covers instead.",
  PRICE_CHANGED: "The price changed. Check the new total and try again.",
  PLAN_CHANGE_NOT_ALLOWED: "This plan can't be changed right now. Try again after it renews.",
  VERIFICATION_NOT_ELIGIBLE: "One of those businesses can't get Gold yet. Finish its business verification first.",
};

export function describeGoldForBusinessesFailure(error: unknown, fallback = "We couldn't work out the price. Check your connection and try again."): string | null {
  if (!error) return null;
  if (error instanceof ApiError && error.code && FAILURE_COPY[error.code]) return FAILURE_COPY[error.code]!;
  return fallback;
}

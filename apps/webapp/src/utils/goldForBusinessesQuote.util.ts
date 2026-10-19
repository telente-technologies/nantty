import type { Money } from "@/types";
import type { GoldBillingInterval, GoldBusinessCoverage, GoldForBusinessesQuote, GoldForBusinessesTier } from "@/types/goldForBusinesses.type";

import { formatMoneyForDisplay } from "./formatMoney.util";

export interface GoldQuoteBreakdownRow {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly emphasis?: boolean;
}

export const GOLD_FOR_BUSINESSES_TITLE = "Gold for all your businesses";

const intervalSuffix: Readonly<Record<GoldBillingInterval, string>> = { month: "/ month", year: "/ year" };

export function formatBasisPointsAsPercent(basisPoints: number): string {
  const percent = basisPoints / 100;
  return `${Number.isInteger(percent) ? percent : percent.toFixed(1)}%`;
}

const formatDiscount = (amountMinor: number, currency: Money["currency"]) => `-${formatMoneyForDisplay({ amountMinor: Math.abs(amountMinor), currency })}`;

export function buildGoldQuoteBreakdownRows(quote: GoldForBusinessesQuote): GoldQuoteBreakdownRow[] {
  const { breakdown, currency } = quote;
  const businessesLabel = breakdown.profileCount === 1 ? "1 business" : `${breakdown.profileCount} businesses`;
  const rows: GoldQuoteBreakdownRow[] = [
    { key: "perProfile", label: "Gold per business", value: `${formatMoneyForDisplay(quote.unitMonthlyPrice)} ${intervalSuffix.month}` },
    { key: "gross", label: breakdown.months > 1 ? `${businessesLabel} × ${breakdown.months} months` : businessesLabel, value: formatMoneyForDisplay(quote.listTotal) },
  ];
  if (breakdown.tierDiscountMinor > 0) rows.push({ key: "tier", label: `Multi-business discount (${formatBasisPointsAsPercent(breakdown.tierBps)})`, value: formatDiscount(breakdown.tierDiscountMinor, currency) });
  if (breakdown.yearlyExtraDiscountMinor > 0) rows.push({ key: "yearlyExtra", label: `Extra yearly discount (${formatBasisPointsAsPercent(breakdown.yearlyExtraBps)})`, value: formatDiscount(breakdown.yearlyExtraDiscountMinor, currency) });
  if (breakdown.standardYearlyDiscountMinor > 0) rows.push({ key: "standardYearly", label: `Yearly discount (${formatBasisPointsAsPercent(breakdown.standardYearlyBps)})`, value: formatDiscount(breakdown.standardYearlyDiscountMinor, currency) });
  const offerDiscountMinor = quote.discount.offerDiscountMinor ?? 0;
  if (offerDiscountMinor > 0) rows.push({ key: "offer", label: "Offer discount", value: formatDiscount(offerDiscountMinor, currency) });
  rows.push({ key: "total", label: "Total", value: `${formatMoneyForDisplay(quote.total)} ${intervalSuffix[quote.interval]}`, emphasis: true });
  return rows;
}

export function describeGoldTier(tier: GoldForBusinessesTier): string {
  return `${tier.profiles === 1 ? "1 business" : `${tier.profiles} businesses`}: ${formatBasisPointsAsPercent(tier.discountBps)} off`;
}

export const GOLD_COVERAGE_LABELS: Readonly<Record<GoldBusinessCoverage, string | null>> = {
  none: null,
  pending: "Waiting for verification",
  active: "Gold",
  removing: "Leaves at renewal",
};

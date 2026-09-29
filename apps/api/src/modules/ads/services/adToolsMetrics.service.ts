import { CURRENCY_MINOR_UNIT_DIGITS } from "../../../configs/currency.config.js";
import type { CurrencyCode } from "../../../enums/currency.enum.js";
import { MILLI_MINOR_UNITS_PER_MINOR_UNIT, type AdEventRecord } from "../models/adDelivery.model.js";

export interface DeliveryTotals {
  readonly impressions: number;
  readonly clicks: number;
  readonly reach: number;
  readonly spendMinor: number;
  readonly conversions: number;
  readonly conversionValueMinor: number;
}

export function summarizeDeliveryEvents(events: readonly AdEventRecord[]): DeliveryTotals {
  const viewers = new Set<string>();
  let impressions = 0;
  let clicks = 0;
  let spendMilliMinor = 0;
  let conversions = 0;
  let conversionValueMinor = 0;
  for (const event of events) {
    if (event.rejectionReason !== null && event.type !== "conversion") continue;
    if (event.type === "impression") {
      impressions += 1;
      viewers.add(event.viewerId);
    } else if (event.type === "click") {
      clicks += 1;
    } else {
      conversions += 1;
      conversionValueMinor += event.valueMinor ?? 0;
    }
    if (event.billed) spendMilliMinor += event.chargeMilliMinor;
  }
  return { impressions, clicks, reach: viewers.size, spendMinor: Math.floor(spendMilliMinor / MILLI_MINOR_UNITS_PER_MINOR_UNIT), conversions, conversionValueMinor };
}

export function convertMinorToMajorUnits(amountMinor: number, currency: CurrencyCode): number {
  return amountMinor / 10 ** (CURRENCY_MINOR_UNIT_DIGITS[currency] ?? 2);
}

export function readCostPerResultMinor(totals: DeliveryTotals): number | null {
  const results = totals.conversions > 0 ? totals.conversions : totals.clicks;
  return results === 0 ? null : totals.spendMinor / results;
}

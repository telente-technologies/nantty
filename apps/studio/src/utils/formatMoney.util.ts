import type { Money } from "@/types";

import { detectDeviceLocaleTag } from "./deviceRegion.util";

const formatterCache = new Map<string, Intl.NumberFormat>();

function getCurrencyFormatter(currency: string, showDecimals: boolean): Intl.NumberFormat {
  const key = `${currency}:${showDecimals}`;
  let formatter = formatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(detectDeviceLocaleTag(), {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: showDecimals ? 2 : 0,
      maximumFractionDigits: showDecimals ? 2 : 0,
    });
    formatterCache.set(key, formatter);
  }
  return formatter;
}

export function formatMoneyForDisplay(money: Money, { showDecimals = true }: { showDecimals?: boolean } = {}): string {
  return getCurrencyFormatter(money.currency, showDecimals).format(money.amountMinor / 100);
}

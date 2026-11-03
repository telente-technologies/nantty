import type { Money } from "@/types";

import { detectDeviceLocaleTag } from "./deviceRegion.util";

const formatterCache = new Map<string, Intl.NumberFormat>();
const minorUnitExponentCache = new Map<string, number>();

function getMinorUnitExponent(currency: string): number {
  const cached = minorUnitExponentCache.get(currency);
  if (cached !== undefined) return cached;
  const exponent = new Intl.NumberFormat(detectDeviceLocaleTag(), { style: "currency", currency }).resolvedOptions().maximumFractionDigits;
  minorUnitExponentCache.set(currency, exponent);
  return exponent;
}

function getCurrencyFormatter(currency: string, showDecimals: boolean): Intl.NumberFormat {
  const key = `${currency}:${showDecimals}`;
  let formatter = formatterCache.get(key);
  if (!formatter) {
    const fractionDigits = showDecimals ? getMinorUnitExponent(currency) : 0;
    formatter = new Intl.NumberFormat(detectDeviceLocaleTag(), {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
    formatterCache.set(key, formatter);
  }
  return formatter;
}

export function formatMoneyForDisplay(money: Money, { showDecimals = true }: { showDecimals?: boolean } = {}): string {
  return getCurrencyFormatter(money.currency, showDecimals).format(amountInMajorUnits(money.amountMinor, money.currency));
}

export function amountInMajorUnits(amountMinor: number, currency: string): number {
  return amountMinor / 10 ** getMinorUnitExponent(currency);
}

export function multiplyMoneyByQuantity(money: Money, quantity: number): Money {
  return { amountMinor: money.amountMinor * quantity, currency: money.currency };
}

export function addMoneyAmounts(amounts: readonly Money[], currency: Money["currency"]): Money {
  return { amountMinor: amounts.reduce((total, money) => total + money.amountMinor, 0), currency };
}

export function formatProductPriceForDisplay(product: { readonly price: Money; readonly approxPrice?: Money | null }, options: { showDecimals?: boolean } = {}): string {
  const main = formatMoneyForDisplay(product.price, options);
  return product.approxPrice ? `${main} (approx. ${formatMoneyForDisplay(product.approxPrice, options)})` : main;
}

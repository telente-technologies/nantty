import { minorUnitsPerMajorUnitByCurrency, supportedCurrencyCodes } from "@/constants/currency.constant";
import type { CurrencyCode, Money } from "@/types/money.type";

const basisPointsInOneWhole = 10_000;
const currencyFormatterCache = new Map<string, Intl.NumberFormat>();

export function isSupportedCurrencyCode(candidate: unknown): candidate is CurrencyCode {
  return typeof candidate === "string" && (supportedCurrencyCodes as readonly string[]).includes(candidate);
}

export function createMoney(amountMinor: number, currency: CurrencyCode): Money {
  if (!Number.isSafeInteger(amountMinor)) throw new Error("Money amounts must be whole minor units.");
  return { amountMinor, currency };
}

export function createZeroMoney(currency: CurrencyCode): Money {
  return { amountMinor: 0, currency };
}

function assertSameCurrency(left: Money, right: Money): void {
  if (left.currency !== right.currency) throw new Error(`Cannot combine ${left.currency} with ${right.currency}.`);
}

export function addMoney(left: Money, right: Money): Money {
  assertSameCurrency(left, right);
  return createMoney(left.amountMinor + right.amountMinor, left.currency);
}

export function subtractMoney(left: Money, right: Money): Money {
  assertSameCurrency(left, right);
  return createMoney(left.amountMinor - right.amountMinor, left.currency);
}

export function multiplyMoneyByQuantity(money: Money, quantity: number): Money {
  return createMoney(money.amountMinor * quantity, money.currency);
}

export function sumMoneyList(moneyList: readonly Money[], currency: CurrencyCode): Money {
  return moneyList.reduce((runningTotal, money) => addMoney(runningTotal, money), createZeroMoney(currency));
}

export function calculateBasisPointsShareOfMinorAmount(amountMinor: number, basisPoints: number): number {
  return Math.round((amountMinor * basisPoints) / basisPointsInOneWhole);
}

export function calculateExclusiveTaxMinor(taxableAmountMinor: number, taxRateBasisPoints: number): number {
  return calculateBasisPointsShareOfMinorAmount(taxableAmountMinor, taxRateBasisPoints);
}

export function calculateTaxIncludedInGrossMinor(grossAmountMinor: number, taxRateBasisPoints: number): number {
  const netAmountMinor = Math.round((grossAmountMinor * basisPointsInOneWhole) / (basisPointsInOneWhole + taxRateBasisPoints));
  return grossAmountMinor - netAmountMinor;
}

export function allocateMinorAmountProportionally(totalToAllocateMinor: number, weights: readonly number[]): number[] {
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  if (weightSum <= 0) return weights.map(() => 0);
  const exactShares = weights.map((weight) => (totalToAllocateMinor * weight) / weightSum);
  const flooredShares = exactShares.map((share) => Math.floor(share));
  let remainder = totalToAllocateMinor - flooredShares.reduce((sum, share) => sum + share, 0);
  const indexesByLargestFraction = exactShares
    .map((share, index) => ({ index, fraction: share - Math.floor(share) }))
    .sort((first, second) => second.fraction - first.fraction);
  for (const { index } of indexesByLargestFraction) {
    if (remainder <= 0) break;
    flooredShares[index] = (flooredShares[index] ?? 0) + 1;
    remainder -= 1;
  }
  return flooredShares;
}

export function readMinorUnitsPerMajorUnit(currency: CurrencyCode): number {
  return minorUnitsPerMajorUnitByCurrency[currency];
}

export function convertMajorInputToMinorUnits(majorAmountText: string, currency: CurrencyCode): number | null {
  const normalisedText = majorAmountText.replace(/[\s,]/g, "");
  if (!/^\d+(\.\d{0,2})?$/.test(normalisedText)) return null;
  const [wholePart = "0", fractionPart = ""] = normalisedText.split(".");
  const minorUnitsPerMajorUnit = readMinorUnitsPerMajorUnit(currency);
  const fractionDigits = Math.round(Math.log10(minorUnitsPerMajorUnit));
  const paddedFraction = fractionPart.padEnd(fractionDigits, "0").slice(0, fractionDigits);
  const amountMinor = Number(wholePart) * minorUnitsPerMajorUnit + Number(paddedFraction || "0");
  return Number.isSafeInteger(amountMinor) ? amountMinor : null;
}

export function convertMinorUnitsToMajorInputText(amountMinor: number, currency: CurrencyCode): string {
  const minorUnitsPerMajorUnit = readMinorUnitsPerMajorUnit(currency);
  const fractionDigits = Math.round(Math.log10(minorUnitsPerMajorUnit));
  return (amountMinor / minorUnitsPerMajorUnit).toFixed(fractionDigits);
}

function readCurrencyFormatter(currency: CurrencyCode, locale: string, compact: boolean): Intl.NumberFormat {
  const cacheKey = `${locale}|${currency}|${compact ? "compact" : "full"}`;
  const cachedFormatter = currencyFormatterCache.get(cacheKey);
  if (cachedFormatter) return cachedFormatter;
  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    ...(compact ? { notation: "compact", maximumFractionDigits: 1 } : {}),
  });
  currencyFormatterCache.set(cacheKey, formatter);
  return formatter;
}

export function formatMoneyForDisplay(money: Money, locale = "en-NG"): string {
  return readCurrencyFormatter(money.currency, locale, false).format(money.amountMinor / readMinorUnitsPerMajorUnit(money.currency));
}

export function formatMoneyCompactForDisplay(money: Money, locale = "en-NG"): string {
  return readCurrencyFormatter(money.currency, locale, true).format(money.amountMinor / readMinorUnitsPerMajorUnit(money.currency));
}

export function formatBasisPointsAsPercent(basisPoints: number): string {
  const percent = basisPoints / 100;
  return `${Number.isInteger(percent) ? percent.toFixed(0) : percent.toFixed(2).replace(/0$/, "")}%`;
}

import { describe, expect, it } from "vitest";

import { chooseChargeCurrencyForDisplayCurrency, findCurrencyForCountry, normalizeCountryCode } from "../../../src/configs/currency.config.js";
import {
  calculateCrossRateThroughUsDollar,
  convertMinorUnitsWithScaledRate,
  divideRoundingHalfUp,
  formatScaledRateAsDecimal,
  parseDecimalRateToScaledInteger,
} from "../../../src/utils/exchangeRate.util.js";
import { applyLockedExchangeRate } from "../../../src/utils/lockedRate.util.js";
import { CurrencyMismatchError, Money } from "../../../src/utils/money.util.js";

describe("Money", () => {
  it("adds, subtracts and multiplies within one currency", () => {
    const price = Money.of(150_000, "NGN");
    expect(price.multiplyByQuantity(3).add(Money.of(2_500, "NGN")).toDto()).toEqual({ amountMinor: 452_500, currency: "NGN" });
    expect(price.subtract(Money.of(50_000, "NGN")).amountMinor).toBe(100_000);
    expect(Money.of(10_001, "USD").calculateBasisPointsShareRoundingDown(500).amountMinor).toBe(500);
  });

  it("refuses to mix currencies", () => {
    expect(() => Money.of(100, "NGN").add(Money.of(100, "USD"))).toThrow(CurrencyMismatchError);
    expect(() => Money.of(100, "GBP").subtract(Money.of(1, "EUR"))).toThrow(CurrencyMismatchError);
    expect(() => Money.sum([Money.of(1, "KES")], "ZAR")).toThrow(CurrencyMismatchError);
  });

  it("rejects fractional amounts and unsupported currencies", () => {
    expect(() => Money.of(1.5, "USD")).toThrow(RangeError);
    expect(() => Money.of(100, "JPY")).toThrow(RangeError);
  });
});

describe("exchange rate arithmetic", () => {
  it("rounds half up with integer math", () => {
    expect(divideRoundingHalfUp(5n, 2n)).toBe(3n);
    expect(divideRoundingHalfUp(4n, 3n)).toBe(1n);
    expect(divideRoundingHalfUp(-5n, 2n)).toBe(-3n);
  });

  it("parses and formats decimal rates exactly", () => {
    expect(parseDecimalRateToScaledInteger("1550")).toBe(1_550_000_000_000n);
    expect(parseDecimalRateToScaledInteger("0.0000000015")).toBe(2n);
    expect(formatScaledRateAsDecimal(parseDecimalRateToScaledInteger("15.4"))).toBe("15.4");
    expect(() => parseDecimalRateToScaledInteger("-1")).toThrow(RangeError);
  });

  it("converts through the US dollar and rounds the result half up", () => {
    const nairaToPound = calculateCrossRateThroughUsDollar(parseDecimalRateToScaledInteger("1550"), parseDecimalRateToScaledInteger("0.78"));
    expect(formatScaledRateAsDecimal(nairaToPound)).toBe("0.000503226");
    expect(convertMinorUnitsWithScaledRate(1_000_000, nairaToPound, 2, 2)).toBe(503);
    expect(convertMinorUnitsWithScaledRate(1, 500_000_000n, 2, 2)).toBe(1);
    expect(convertMinorUnitsWithScaledRate(123, 1_000_000_000n, 2, 0)).toBe(1);
  });

  it("applies a locked rate only to money in the rate's source currency", () => {
    const rate = { sourceCurrency: "NGN", targetCurrency: "USD", scaledRate: 645_161n, rateText: "0.000645161", quotedAt: new Date() } as const;
    expect(applyLockedExchangeRate(Money.of(1_550_000, "NGN"), rate).toDto()).toEqual({ amountMinor: 1_000, currency: "USD" });
    expect(() => applyLockedExchangeRate(Money.of(100, "GBP"), rate)).toThrow(CurrencyMismatchError);
  });
});

describe("country to currency mapping", () => {
  it("maps supported countries and falls back to US dollars", () => {
    expect(findCurrencyForCountry("NG")).toEqual({ currency: "NGN", isCountrySupported: true });
    expect(findCurrencyForCountry("DE")).toEqual({ currency: "EUR", isCountrySupported: true });
    expect(findCurrencyForCountry("BR")).toEqual({ currency: "USD", isCountrySupported: false });
    expect(findCurrencyForCountry(null)).toEqual({ currency: "USD", isCountrySupported: false });
    expect(normalizeCountryCode(" gb ")).toBe("GB");
    expect(normalizeCountryCode("XX")).toBeNull();
    expect(normalizeCountryCode("NGA")).toBeNull();
  });

  it("charges in the display currency only when both payment providers support it", () => {
    expect(chooseChargeCurrencyForDisplayCurrency("NGN")).toBe("NGN");
    expect(chooseChargeCurrencyForDisplayCurrency("KES")).toBe("KES");
    expect(chooseChargeCurrencyForDisplayCurrency("GBP")).toBe("USD");
    expect(chooseChargeCurrencyForDisplayCurrency("EUR")).toBe("USD");
  });
});

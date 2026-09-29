import { STATIC_UNITS_PER_US_DOLLAR } from "../../../configs/exchangeRates.config.js";
import { SUPPORTED_CURRENCY_CODES, type CurrencyCode } from "../../../enums/currency.enum.js";
import { parseDecimalRateToScaledInteger } from "../../../utils/exchangeRate.util.js";

export interface FetchedExchangeRates {
  readonly source: string;
  readonly scaledUnitsPerUsDollar: Readonly<Partial<Record<CurrencyCode, bigint>>>;
}

export interface ExchangeRateProvider {
  fetchUnitsPerUsDollar(): Promise<FetchedExchangeRates>;
}

export class StaticExchangeRateProvider implements ExchangeRateProvider {
  public async fetchUnitsPerUsDollar(): Promise<FetchedExchangeRates> {
    return {
      source: "static-development-rates",
      scaledUnitsPerUsDollar: Object.fromEntries(
        SUPPORTED_CURRENCY_CODES.map((currency) => [currency, parseDecimalRateToScaledInteger(STATIC_UNITS_PER_US_DOLLAR[currency])]),
      ),
    };
  }
}

export class OpenExchangeRatesApiProvider implements ExchangeRateProvider {
  public async fetchUnitsPerUsDollar(): Promise<FetchedExchangeRates> {
    const response = await fetch("https://open.er-api.com/v6/latest/USD", { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`The exchange rate provider answered ${response.status}.`);
    const body = (await response.json()) as { rates?: Record<string, number> };
    const scaledUnitsPerUsDollar: Partial<Record<CurrencyCode, bigint>> = {};
    for (const currency of SUPPORTED_CURRENCY_CODES) {
      const rate = body.rates?.[currency];
      if (typeof rate === "number" && Number.isFinite(rate) && rate > 0) {
        scaledUnitsPerUsDollar[currency] = parseDecimalRateToScaledInteger(rate.toFixed(9));
      }
    }
    return { source: "open.er-api.com", scaledUnitsPerUsDollar };
  }
}

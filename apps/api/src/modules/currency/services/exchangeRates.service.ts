import { STATIC_UNITS_PER_US_DOLLAR } from "../../../configs/exchangeRates.config.js";
import { SUPPORTED_CURRENCY_CODES, type CurrencyCode } from "../../../enums/currency.enum.js";
import type { Clock } from "../../../interfaces/clock.interface.js";
import type {
  ConvertedMoney,
  CurrencyConverter,
  LockedExchangeRate,
  MoneyConversion,
} from "../../../interfaces/currencyConverter.interface.js";
import {
  calculateCrossRateThroughUsDollar,
  EXCHANGE_RATE_SCALE,
  formatScaledRateAsDecimal,
  parseDecimalRateToScaledInteger,
} from "../../../utils/exchangeRate.util.js";
import { applyLockedExchangeRate } from "../../../utils/lockedRate.util.js";
import type { Money } from "../../../utils/money.util.js";
import type { ExchangeRateRecord } from "../models/currency.model.js";
import type { ExchangeRatesRepository } from "../repositories/exchangeRates.repository.js";
import type { ExchangeRateProvider } from "./exchangeRateProvider.service.js";

const CACHE_LIFETIME_MILLISECONDS = 5 * 60 * 1000;

export class ExchangeRatesService implements CurrencyConverter {
  private cachedRates: ReadonlyMap<CurrencyCode, bigint> | undefined;
  private cachedAt = 0;

  public constructor(
    private readonly repository: ExchangeRatesRepository,
    private readonly provider: ExchangeRateProvider,
    private readonly clock: Clock,
  ) {}

  public async refreshExchangeRatesFromProvider(): Promise<readonly ExchangeRateRecord[]> {
    const fetched = await this.provider.fetchUnitsPerUsDollar();
    const fetchedAt = this.clock.now();
    const records = SUPPORTED_CURRENCY_CODES.flatMap((currency) => {
      const scaled = currency === "USD" ? EXCHANGE_RATE_SCALE : fetched.scaledUnitsPerUsDollar[currency];
      return scaled === undefined ? [] : [{ currency, scaledUnitsPerUsDollar: scaled, source: fetched.source, fetchedAt }];
    });
    await this.repository.replaceRates(records);
    this.cachedRates = undefined;
    return records;
  }

  public async listExchangeRates(): Promise<ReadonlyMap<CurrencyCode, bigint>> {
    const now = this.clock.now().getTime();
    if (this.cachedRates !== undefined && now - this.cachedAt < CACHE_LIFETIME_MILLISECONDS) return this.cachedRates;
    const stored = new Map((await this.repository.listAll()).map((rate) => [rate.currency, rate.scaledUnitsPerUsDollar]));
    const rates = new Map<CurrencyCode, bigint>();
    for (const currency of SUPPORTED_CURRENCY_CODES) {
      rates.set(currency, stored.get(currency) ?? parseDecimalRateToScaledInteger(STATIC_UNITS_PER_US_DOLLAR[currency]));
    }
    this.cachedRates = rates;
    this.cachedAt = now;
    return rates;
  }

  public async quoteExchangeRate(sourceCurrency: CurrencyCode, targetCurrency: CurrencyCode): Promise<LockedExchangeRate> {
    const rates = await this.listExchangeRates();
    const scaledRate =
      sourceCurrency === targetCurrency
        ? EXCHANGE_RATE_SCALE
        : calculateCrossRateThroughUsDollar(rates.get(sourceCurrency) ?? EXCHANGE_RATE_SCALE, rates.get(targetCurrency) ?? EXCHANGE_RATE_SCALE);
    return { sourceCurrency, targetCurrency, scaledRate, rateText: formatScaledRateAsDecimal(scaledRate), quotedAt: this.clock.now() };
  }

  public async convertMoney(money: Money, targetCurrency: CurrencyCode): Promise<ConvertedMoney> {
    const rate = await this.quoteExchangeRate(money.currency, targetCurrency);
    return { money: applyLockedExchangeRate(money, rate), rate };
  }

  public async prepareConversionInto(targetCurrency: CurrencyCode): Promise<MoneyConversion> {
    const lockedRates = new Map<CurrencyCode, LockedExchangeRate>();
    for (const currency of SUPPORTED_CURRENCY_CODES) lockedRates.set(currency, await this.quoteExchangeRate(currency, targetCurrency));
    return (money) => {
      const rate = lockedRates.get(money.currency);
      return rate === undefined ? money : applyLockedExchangeRate(money, rate);
    };
  }
}

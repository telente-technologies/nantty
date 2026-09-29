import type { CurrencyCode } from "../../../enums/currency.enum.js";
import type { ExchangeRateRecord } from "../models/currency.model.js";

export interface ExchangeRatesRepository {
  listAll(): Promise<readonly ExchangeRateRecord[]>;
  replaceRates(rates: readonly ExchangeRateRecord[]): Promise<void>;
}

export class InMemoryExchangeRatesRepository implements ExchangeRatesRepository {
  private readonly rates = new Map<CurrencyCode, ExchangeRateRecord>();

  public async listAll(): Promise<readonly ExchangeRateRecord[]> {
    return [...this.rates.values()];
  }

  public async replaceRates(rates: readonly ExchangeRateRecord[]): Promise<void> {
    for (const rate of rates) this.rates.set(rate.currency, rate);
  }
}

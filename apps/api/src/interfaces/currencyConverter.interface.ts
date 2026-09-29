import type { CurrencyCode } from "../enums/currency.enum.js";
import type { Money } from "../utils/money.util.js";

export interface LockedExchangeRate {
  readonly sourceCurrency: CurrencyCode;
  readonly targetCurrency: CurrencyCode;
  readonly scaledRate: bigint;
  readonly rateText: string;
  readonly quotedAt: Date;
}

export interface ConvertedMoney {
  readonly money: Money;
  readonly rate: LockedExchangeRate;
}

export type MoneyConversion = (money: Money) => Money;

export interface CurrencyConverter {
  quoteExchangeRate(sourceCurrency: CurrencyCode, targetCurrency: CurrencyCode): Promise<LockedExchangeRate>;
  convertMoney(money: Money, targetCurrency: CurrencyCode): Promise<ConvertedMoney>;
  prepareConversionInto(targetCurrency: CurrencyCode): Promise<MoneyConversion>;
}

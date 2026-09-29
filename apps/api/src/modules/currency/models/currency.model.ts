import type { CurrencyCode } from "../../../enums/currency.enum.js";

export interface ExchangeRateRecord {
  readonly currency: CurrencyCode;
  readonly scaledUnitsPerUsDollar: bigint;
  readonly source: string;
  readonly fetchedAt: Date;
}

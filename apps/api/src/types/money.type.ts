import type { CurrencyCode } from "../enums/currency.enum.js";

export type MinorUnits = number;

export interface MoneyAmount {
  readonly amount: MinorUnits;
  readonly currency: CurrencyCode;
}

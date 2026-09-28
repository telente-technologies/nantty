import type { Currency } from "../enums/currency.enum.js";

export type Kobo = number;

export interface Money {
  readonly amount: Kobo;
  readonly currency: Currency;
}

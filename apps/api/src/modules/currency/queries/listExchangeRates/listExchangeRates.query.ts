import { Query } from "@zudojs/cqrs";

import type { CurrencyCode } from "../../../../enums/currency.enum.js";

export class ListExchangeRatesQuery extends Query<"currency.listExchangeRates"> {
  public constructor(
    public readonly displayCurrency: CurrencyCode,
  ) {
    super("currency.listExchangeRates");
  }
}

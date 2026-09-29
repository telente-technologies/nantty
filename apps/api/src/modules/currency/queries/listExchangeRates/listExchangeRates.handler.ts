import { QueryHandler } from "@zudojs/cqrs";

import { SUPPORTED_CURRENCY_CODES } from "../../../../enums/currency.enum.js";
import type { LockedExchangeRate } from "../../../../interfaces/currencyConverter.interface.js";
import type { ExchangeRatesService } from "../../services/exchangeRates.service.js";
import type { ListExchangeRatesQuery } from "./listExchangeRates.query.js";

export class ListExchangeRatesHandler extends QueryHandler<ListExchangeRatesQuery, readonly LockedExchangeRate[]> {
  public readonly queryType = "currency.listExchangeRates" as const;

  public constructor(private readonly exchangeRates: ExchangeRatesService) {
    super();
  }

  public async execute(query: ListExchangeRatesQuery): Promise<readonly LockedExchangeRate[]> {
    return Promise.all(SUPPORTED_CURRENCY_CODES.map((currency) => this.exchangeRates.quoteExchangeRate(currency, query.displayCurrency)));
  }
}

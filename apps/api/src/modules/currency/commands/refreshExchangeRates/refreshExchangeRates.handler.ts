import { CommandHandler } from "@zudojs/cqrs";

import type { ExchangeRateRecord } from "../../models/currency.model.js";
import type { ExchangeRatesService } from "../../services/exchangeRates.service.js";
import type { RefreshExchangeRatesCommand } from "./refreshExchangeRates.command.js";

export class RefreshExchangeRatesHandler extends CommandHandler<RefreshExchangeRatesCommand, readonly ExchangeRateRecord[]> {
  public readonly commandType = "currency.refreshExchangeRates" as const;

  public constructor(private readonly exchangeRates: ExchangeRatesService) {
    super();
  }

  public execute(_command: RefreshExchangeRatesCommand): Promise<readonly ExchangeRateRecord[]> {
    return this.exchangeRates.refreshExchangeRatesFromProvider();
  }
}

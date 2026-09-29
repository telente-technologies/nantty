import { BaseModule, type ModuleContext } from "@zudojs/core";
import type { CommandBus, QueryBus } from "@zudojs/cqrs";

import { registerCommandHandlers, registerQueryHandlers } from "../../utils/cqrs.util.js";
import { RefreshExchangeRatesHandler } from "./commands/refreshExchangeRates/refreshExchangeRates.handler.js";
import { ListExchangeRatesHandler } from "./queries/listExchangeRates/listExchangeRates.handler.js";
import type { ExchangeRatesService } from "./services/exchangeRates.service.js";

export class CurrencyModule extends BaseModule {
  public readonly id = "currency";
  public readonly name = "currency";

  public constructor() {
    super({ version: "0.1.0" });
  }

  public override async onInitialize(context: ModuleContext): Promise<void> {
    context.logger.info("currency module initialized");
  }

  public override async onShutdown(context: ModuleContext): Promise<void> {
    context.logger.info("currency module stopped");
  }
}

export function registerCurrencyCommandAndQueryHandlers(commands: CommandBus, queries: QueryBus, exchangeRates: ExchangeRatesService): void {
  registerCommandHandlers(commands, [new RefreshExchangeRatesHandler(exchangeRates)]);
  registerQueryHandlers(queries, [new ListExchangeRatesHandler(exchangeRates)]);
}

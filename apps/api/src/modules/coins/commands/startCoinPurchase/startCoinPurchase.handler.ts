import { CommandHandler } from "@zudojs/cqrs";

import type { CoinsServices } from "../../services/coinsServices.service.js";
import type { StartedCoinPurchase } from "../../services/coinPurchases.service.js";
import type { StartCoinPurchaseCommand } from "./startCoinPurchase.command.js";

export class StartCoinPurchaseHandler extends CommandHandler<StartCoinPurchaseCommand, StartedCoinPurchase> {
  public readonly commandType = "coins.startCoinPurchase" as const;

  public constructor(private readonly service: CoinsServices) {
    super();
  }

  public execute(command: StartCoinPurchaseCommand): Promise<StartedCoinPurchase> {
    return this.service.purchases.startPurchase(command.request);
  }
}

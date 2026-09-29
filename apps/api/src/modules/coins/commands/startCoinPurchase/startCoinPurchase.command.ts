import { Command } from "@zudojs/cqrs";

import type { CoinPurchaseRequest } from "../../services/coinPurchases.service.js";

export class StartCoinPurchaseCommand extends Command<"coins.startCoinPurchase"> {
  public constructor(
    public readonly request: CoinPurchaseRequest,
  ) {
    super("coins.startCoinPurchase");
  }
}

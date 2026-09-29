import { CommandHandler } from "@zudojs/cqrs";

import type { CoinsServices } from "../../services/coinsServices.service.js";
import type { VerifiedCoinPurchase } from "../../services/coinPurchases.service.js";
import type { VerifyCoinPurchaseCommand } from "./verifyCoinPurchase.command.js";

export class VerifyCoinPurchaseHandler extends CommandHandler<VerifyCoinPurchaseCommand, VerifiedCoinPurchase> {
  public readonly commandType = "coins.verifyCoinPurchase" as const;

  public constructor(private readonly service: CoinsServices) {
    super();
  }

  public execute(command: VerifyCoinPurchaseCommand): Promise<VerifiedCoinPurchase> {
    return this.service.purchases.verifyPurchaseForUser(command.userId, command.reference);
  }
}

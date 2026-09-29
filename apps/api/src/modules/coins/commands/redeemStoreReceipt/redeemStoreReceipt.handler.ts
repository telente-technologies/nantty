import { CommandHandler } from "@zudojs/cqrs";

import type { CoinsServices } from "../../services/coinsServices.service.js";
import type { VerifiedCoinPurchase } from "../../services/coinPurchases.service.js";
import type { RedeemStoreReceiptCommand } from "./redeemStoreReceipt.command.js";

export class RedeemStoreReceiptHandler extends CommandHandler<RedeemStoreReceiptCommand, VerifiedCoinPurchase> {
  public readonly commandType = "coins.redeemStoreReceipt" as const;

  public constructor(private readonly service: CoinsServices) {
    super();
  }

  public execute(command: RedeemStoreReceiptCommand): Promise<VerifiedCoinPurchase> {
    return this.service.receipts.redeemStoreReceipt(command.request);
  }
}

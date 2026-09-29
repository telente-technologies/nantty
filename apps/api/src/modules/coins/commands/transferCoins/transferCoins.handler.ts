import { CommandHandler } from "@zudojs/cqrs";

import type { CoinTransferPosted } from "../../services/coinLedger.service.js";
import type { CoinsServices } from "../../services/coinsServices.service.js";
import type { TransferCoinsCommand } from "./transferCoins.command.js";

export class TransferCoinsHandler extends CommandHandler<TransferCoinsCommand, CoinTransferPosted> {
  public readonly commandType = "coins.transferCoins" as const;

  public constructor(private readonly service: CoinsServices) {
    super();
  }

  public execute(command: TransferCoinsCommand): Promise<CoinTransferPosted> {
    return this.service.wallet.transferCoins(command.request);
  }
}

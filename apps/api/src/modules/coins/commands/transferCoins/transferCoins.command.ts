import { Command } from "@zudojs/cqrs";

import type { CoinTransferRequest } from "../../services/coinWallet.service.js";

export class TransferCoinsCommand extends Command<"coins.transferCoins"> {
  public constructor(
    public readonly request: CoinTransferRequest,
  ) {
    super("coins.transferCoins");
  }
}

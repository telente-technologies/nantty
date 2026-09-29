import { Command } from "@zudojs/cqrs";

import type { CoinConversionRequest } from "../../services/creatorCashOut.service.js";

export class ConvertEarnedCoinsCommand extends Command<"creators.convertEarnedCoins"> {
  public constructor(
    public readonly request: CoinConversionRequest,
  ) {
    super("creators.convertEarnedCoins");
  }
}

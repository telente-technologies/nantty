import { Command } from "@zudojs/cqrs";

import type { CoinPackInput } from "../../models/coins.model.js";

export class SaveCoinPackCommand extends Command<"coins.saveCoinPack"> {
  public constructor(
    public readonly adminId: string,
    public readonly pack: CoinPackInput,
  ) {
    super("coins.saveCoinPack");
  }
}

import { Command } from "@zudojs/cqrs";

import type { NewCashbackPromoInput } from "../../services/cashback.service.js";

export class CreateCashbackPromoCommand extends Command<"loyalty.createCashbackPromo"> {
  public constructor(
    public readonly adminId: string,
    public readonly input: NewCashbackPromoInput,
  ) {
    super("loyalty.createCashbackPromo");
  }
}

import { Command } from "@zudojs/cqrs";

import type { CurrencyCode } from "../../../../enums/currency.enum.js";
import type { Principal } from "../../../../interfaces/principal.interface.js";

export class AddLiveProductCommand extends Command<"posts.addLiveProduct"> {
  public constructor(
    public readonly principal: Principal,
    public readonly sessionId: string,
    public readonly productId: string,
    public readonly pin: boolean,
    public readonly displayCurrency: CurrencyCode,
  ) {
    super("posts.addLiveProduct");
  }
}

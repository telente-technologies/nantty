import { Command } from "@zudojs/cqrs";

import type { CurrencyCode } from "../../../../enums/currency.enum.js";
import type { Principal } from "../../../../interfaces/principal.interface.js";

export class EndLiveSessionCommand extends Command<"posts.endLiveSession"> {
  public constructor(
    public readonly principal: Principal,
    public readonly sessionId: string,
    public readonly displayCurrency: CurrencyCode,
  ) {
    super("posts.endLiveSession");
  }
}

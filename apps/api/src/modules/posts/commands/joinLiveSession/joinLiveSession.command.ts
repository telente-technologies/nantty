import { Command } from "@zudojs/cqrs";

import type { CurrencyCode } from "../../../../enums/currency.enum.js";
import type { Principal } from "../../../../interfaces/principal.interface.js";

export class JoinLiveSessionCommand extends Command<"posts.joinLiveSession"> {
  public constructor(
    public readonly principal: Principal,
    public readonly sessionId: string,
    public readonly displayCurrency: CurrencyCode,
  ) {
    super("posts.joinLiveSession");
  }
}

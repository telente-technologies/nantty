import { Command } from "@zudojs/cqrs";

import type { CurrencyCode } from "../../../../enums/currency.enum.js";
import type { Principal } from "../../../../interfaces/principal.interface.js";

export class RepostPostCommand extends Command<"posts.repostPost"> {
  public constructor(
    public readonly principal: Principal,
    public readonly postId: string,
    public readonly text: string,
    public readonly displayCurrency: CurrencyCode,
  ) {
    super("posts.repostPost");
  }
}

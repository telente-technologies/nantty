import { Command } from "@zudojs/cqrs";

import type { CurrencyCode } from "../../../../enums/currency.enum.js";
import type { Principal } from "../../../../interfaces/principal.interface.js";

export class TagProductsCommand extends Command<"posts.tagProducts"> {
  public constructor(
    public readonly principal: Principal,
    public readonly postId: string,
    public readonly productIds: readonly string[],
    public readonly displayCurrency: CurrencyCode,
  ) {
    super("posts.tagProducts");
  }
}

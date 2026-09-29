import { Query } from "@zudojs/cqrs";

import type { CurrencyCode } from "../../../../enums/currency.enum.js";
import type { Principal } from "../../../../interfaces/principal.interface.js";

export class ListActiveStoriesQuery extends Query<"posts.listActiveStories"> {
  public constructor(
    public readonly principal: Principal,
    public readonly displayCurrency: CurrencyCode,
  ) {
    super("posts.listActiveStories");
  }
}

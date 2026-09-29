import { Query } from "@zudojs/cqrs";

import type { CurrencyCode } from "../../../../enums/currency.enum.js";
import type { PageRequest } from "../../../../types/pagination.type.js";
import type { Principal } from "../../../../interfaces/principal.interface.js";

export class GetFollowingFeedQuery extends Query<"feeds.getFollowingFeed"> {
  public constructor(
    public readonly principal: Principal,
    public readonly page: PageRequest,
    public readonly displayCurrency: CurrencyCode,
    public readonly country: string | null,
  ) {
    super("feeds.getFollowingFeed");
  }
}

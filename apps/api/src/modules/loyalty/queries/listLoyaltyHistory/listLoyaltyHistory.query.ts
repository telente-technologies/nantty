import { Query } from "@zudojs/cqrs";

import type { PageRequest } from "../../../../types/pagination.type.js";

export class ListLoyaltyHistoryQuery extends Query<"loyalty.listLoyaltyHistory"> {
  public constructor(
    public readonly userId: string,
    public readonly page: PageRequest,
  ) {
    super("loyalty.listLoyaltyHistory");
  }
}

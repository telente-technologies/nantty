import { Query } from "@zudojs/cqrs";

import type { CurrencyCode } from "../../../../enums/currency.enum.js";
import type { PageRequest } from "../../../../types/pagination.type.js";

export class ListLiveSessionsQuery extends Query<"posts.listLiveSessions"> {
  public constructor(
    public readonly page: PageRequest,
    public readonly displayCurrency: CurrencyCode,
  ) {
    super("posts.listLiveSessions");
  }
}

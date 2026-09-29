import { Query } from "@zudojs/cqrs";

import type { PageRequest } from "../../../../types/pagination.type.js";

export class ListCoinTransactionsQuery extends Query<"coins.listCoinTransactions"> {
  public constructor(
    public readonly userId: string,
    public readonly page: PageRequest,
  ) {
    super("coins.listCoinTransactions");
  }
}

import { QueryHandler } from "@zudojs/cqrs";

import type { CoinsServices } from "../../services/coinsServices.service.js";
import type { LedgerEntryRecord } from "../../../wallets/models/wallets.model.js";
import type { Page } from "../../../../types/pagination.type.js";
import type { ListCoinTransactionsQuery } from "./listCoinTransactions.query.js";

export class ListCoinTransactionsHandler extends QueryHandler<ListCoinTransactionsQuery, Page<LedgerEntryRecord>> {
  public readonly queryType = "coins.listCoinTransactions" as const;

  public constructor(private readonly service: CoinsServices) {
    super();
  }

  public execute(query: ListCoinTransactionsQuery): Promise<Page<LedgerEntryRecord>> {
    return this.service.wallet.listTransactions(query.userId, query.page);
  }
}

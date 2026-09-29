import { QueryHandler } from "@zudojs/cqrs";

import type { Page } from "../../../../types/pagination.type.js";
import type { LedgerEntryRecord } from "../../models/wallets.model.js";
import type { WalletsService } from "../../services/wallets.service.js";
import type { ListWalletTransactionsQuery } from "./listWalletTransactions.query.js";

export class ListWalletTransactionsHandler extends QueryHandler<ListWalletTransactionsQuery, Page<LedgerEntryRecord>> {
  public readonly queryType = "wallets.listWalletTransactions" as const;

  public constructor(private readonly service: WalletsService) {
    super();
  }

  public execute(query: ListWalletTransactionsQuery): Promise<Page<LedgerEntryRecord>> {
    return this.service.listStoreWalletTransactions(query.principal.userId, query.storeId, query.page);
  }
}

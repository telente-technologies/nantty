import { QueryHandler } from "@zudojs/cqrs";

import type { PayoutAccountRecord } from "../../models/wallets.model.js";
import type { WalletsService } from "../../services/wallets.service.js";
import type { ListPayoutAccountsQuery } from "./listPayoutAccounts.query.js";

export class ListPayoutAccountsHandler extends QueryHandler<ListPayoutAccountsQuery, readonly PayoutAccountRecord[]> {
  public readonly queryType = "wallets.listPayoutAccounts" as const;

  public constructor(private readonly service: WalletsService) {
    super();
  }

  public execute(query: ListPayoutAccountsQuery): Promise<readonly PayoutAccountRecord[]> {
    return this.service.listPayoutAccounts(query.principal.userId, query.storeId);
  }
}

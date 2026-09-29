import { QueryHandler } from "@zudojs/cqrs";

import type { Page } from "../../../../types/pagination.type.js";
import type { WithdrawalRecord } from "../../models/wallets.model.js";
import type { WalletsService } from "../../services/wallets.service.js";
import type { ListWithdrawalsQuery } from "./listWithdrawals.query.js";

export class ListWithdrawalsHandler extends QueryHandler<ListWithdrawalsQuery, Page<WithdrawalRecord>> {
  public readonly queryType = "wallets.listWithdrawals" as const;

  public constructor(private readonly service: WalletsService) {
    super();
  }

  public execute(query: ListWithdrawalsQuery): Promise<Page<WithdrawalRecord>> {
    return this.service.listWithdrawals(query.principal.userId, query.storeId, query.page);
  }
}

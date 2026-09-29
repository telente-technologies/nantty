import { QueryHandler } from "@zudojs/cqrs";

import type { LoyaltyRewardRecord } from "../../models/loyalty.model.js";
import type { LoyaltyServices } from "../../services/loyaltyServices.service.js";
import type { Page } from "../../../../types/pagination.type.js";
import type { ListLoyaltyHistoryQuery } from "./listLoyaltyHistory.query.js";

export class ListLoyaltyHistoryHandler extends QueryHandler<ListLoyaltyHistoryQuery, Page<LoyaltyRewardRecord>> {
  public readonly queryType = "loyalty.listLoyaltyHistory" as const;

  public constructor(private readonly service: LoyaltyServices) {
    super();
  }

  public execute(query: ListLoyaltyHistoryQuery): Promise<Page<LoyaltyRewardRecord>> {
    return this.service.points.listHistory(query.userId, query.page);
  }
}

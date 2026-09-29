import { QueryHandler } from "@zudojs/cqrs";

import type { CreatorPlanDto } from "../../dtos/creatorSubscriptions.dto.js";
import type { CreatorSubscriptionsServices } from "../../services/creatorSubscriptionsServices.service.js";
import type { ListCreatorPlansQuery } from "./listCreatorPlans.query.js";

export class ListCreatorPlansHandler extends QueryHandler<ListCreatorPlansQuery, readonly CreatorPlanDto[]> {
  public readonly queryType = "creatorSubscriptions.listCreatorPlans" as const;

  public constructor(private readonly service: CreatorSubscriptionsServices) {
    super();
  }

  public execute(query: ListCreatorPlansQuery): Promise<readonly CreatorPlanDto[]> {
    return this.service.plans.listPlans(query.creatorId, query.includeInactive);
  }
}

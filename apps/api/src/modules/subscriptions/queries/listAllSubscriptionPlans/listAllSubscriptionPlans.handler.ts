import { QueryHandler } from "@zudojs/cqrs";

import type { PlanRecord } from "../../models/subscriptions.model.js";
import type { SubscriptionPlansService } from "../../services/subscriptionPlans.service.js";
import type { ListAllSubscriptionPlansQuery } from "./listAllSubscriptionPlans.query.js";

export class ListAllSubscriptionPlansHandler extends QueryHandler<ListAllSubscriptionPlansQuery, readonly PlanRecord[]> {
  public readonly queryType = "subscriptions.listAllSubscriptionPlans" as const;

  public constructor(private readonly service: SubscriptionPlansService) {
    super();
  }

  public execute(query: ListAllSubscriptionPlansQuery): Promise<readonly PlanRecord[]> {
    return this.service.listAllPlans();
  }
}

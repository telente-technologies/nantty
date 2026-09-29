import { QueryHandler } from "@zudojs/cqrs";

import type { PlanRecord } from "../../models/subscriptions.model.js";
import type { SubscriptionPlansService } from "../../services/subscriptionPlans.service.js";
import type { ListSubscriptionPlansQuery } from "./listSubscriptionPlans.query.js";

export class ListSubscriptionPlansHandler extends QueryHandler<ListSubscriptionPlansQuery, readonly PlanRecord[]> {
  public readonly queryType = "subscriptions.listSubscriptionPlans" as const;

  public constructor(private readonly service: SubscriptionPlansService) {
    super();
  }

  public execute(query: ListSubscriptionPlansQuery): Promise<readonly PlanRecord[]> {
    return this.service.listPurchasablePlans(query.color);
  }
}

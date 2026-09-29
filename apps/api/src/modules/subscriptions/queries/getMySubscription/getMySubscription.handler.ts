import { QueryHandler } from "@zudojs/cqrs";

import type { SubscriptionBillingService } from "../../services/subscriptionBilling.service.js";
import type { SubscriptionRecord } from "../../models/subscriptions.model.js";
import type { GetMySubscriptionQuery } from "./getMySubscription.query.js";

export class GetMySubscriptionHandler extends QueryHandler<GetMySubscriptionQuery, SubscriptionRecord> {
  public readonly queryType = "subscriptions.getMySubscription" as const;

  public constructor(private readonly service: SubscriptionBillingService) {
    super();
  }

  public execute(query: GetMySubscriptionQuery): Promise<SubscriptionRecord> {
    return this.service.findSubscriptionForPrincipal(query.principal, query.profileType, query.storeId);
  }
}

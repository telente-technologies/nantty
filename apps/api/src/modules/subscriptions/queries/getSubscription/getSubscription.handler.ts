import { QueryHandler } from "@zudojs/cqrs";

import type { SubscriptionLifecycleService } from "../../services/subscriptionLifecycle.service.js";
import type { SubscriptionRecord } from "../../models/subscriptions.model.js";
import type { GetSubscriptionQuery } from "./getSubscription.query.js";

export class GetSubscriptionHandler extends QueryHandler<GetSubscriptionQuery, SubscriptionRecord> {
  public readonly queryType = "subscriptions.getSubscription" as const;

  public constructor(private readonly service: SubscriptionLifecycleService) {
    super();
  }

  public execute(query: GetSubscriptionQuery): Promise<SubscriptionRecord> {
    return this.service.findOrThrow(query.profileId);
  }
}

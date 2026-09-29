import { QueryHandler } from "@zudojs/cqrs";

import type { Page } from "../../../../types/pagination.type.js";
import type { SubscriptionLifecycleService } from "../../services/subscriptionLifecycle.service.js";
import type { SubscriptionRecord } from "../../models/subscriptions.model.js";
import type { ListSubscriptionsQuery } from "./listSubscriptions.query.js";

export class ListSubscriptionsHandler extends QueryHandler<ListSubscriptionsQuery, Page<SubscriptionRecord>> {
  public readonly queryType = "subscriptions.listSubscriptions" as const;

  public constructor(private readonly service: SubscriptionLifecycleService) {
    super();
  }

  public execute(query: ListSubscriptionsQuery): Promise<Page<SubscriptionRecord>> {
    return this.service.subscriptions.list(query.filter, query.page);
  }
}

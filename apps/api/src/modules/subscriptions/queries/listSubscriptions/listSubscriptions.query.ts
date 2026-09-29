import { Query } from "@zudojs/cqrs";

import type { PageRequest } from "../../../../types/pagination.type.js";
import type { SubscriptionFilter } from "../../models/subscriptions.model.js";

export class ListSubscriptionsQuery extends Query<"subscriptions.listSubscriptions"> {
  public constructor(
    public readonly filter: SubscriptionFilter,
    public readonly page: PageRequest,
  ) {
    super("subscriptions.listSubscriptions");
  }
}

import { QueryHandler } from "@zudojs/cqrs";

import type { CreatorSubscriptionRecord } from "../../models/creatorSubscriptions.model.js";
import type { CreatorSubscriptionsServices } from "../../services/creatorSubscriptionsServices.service.js";
import type { GetCreatorSubscriptionQuery } from "./getCreatorSubscription.query.js";

export class GetCreatorSubscriptionHandler extends QueryHandler<GetCreatorSubscriptionQuery, CreatorSubscriptionRecord> {
  public readonly queryType = "creatorSubscriptions.getCreatorSubscription" as const;

  public constructor(private readonly service: CreatorSubscriptionsServices) {
    super();
  }

  public execute(query: GetCreatorSubscriptionQuery): Promise<CreatorSubscriptionRecord> {
    return this.service.lifecycle.findSubscriptionForMember(query.userId, query.subscriptionId);
  }
}

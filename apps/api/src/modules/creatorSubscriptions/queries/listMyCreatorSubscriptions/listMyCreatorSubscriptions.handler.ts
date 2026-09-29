import { QueryHandler } from "@zudojs/cqrs";

import type { CreatorSubscriptionRecord } from "../../models/creatorSubscriptions.model.js";
import type { CreatorSubscriptionsServices } from "../../services/creatorSubscriptionsServices.service.js";
import type { ListMyCreatorSubscriptionsQuery } from "./listMyCreatorSubscriptions.query.js";

export class ListMyCreatorSubscriptionsHandler extends QueryHandler<ListMyCreatorSubscriptionsQuery, readonly CreatorSubscriptionRecord[]> {
  public readonly queryType = "creatorSubscriptions.listMyCreatorSubscriptions" as const;

  public constructor(private readonly service: CreatorSubscriptionsServices) {
    super();
  }

  public execute(query: ListMyCreatorSubscriptionsQuery): Promise<readonly CreatorSubscriptionRecord[]> {
    return this.service.lifecycle.listMySubscriptions(query.subscriberId);
  }
}

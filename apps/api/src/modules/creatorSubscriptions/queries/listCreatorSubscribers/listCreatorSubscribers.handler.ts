import { QueryHandler } from "@zudojs/cqrs";

import type { CreatorSubscriberDto } from "../../dtos/creatorSubscriptions.dto.js";
import type { CreatorSubscriptionsServices } from "../../services/creatorSubscriptionsServices.service.js";
import type { ListCreatorSubscribersQuery } from "./listCreatorSubscribers.query.js";

export class ListCreatorSubscribersHandler extends QueryHandler<ListCreatorSubscribersQuery, readonly CreatorSubscriberDto[]> {
  public readonly queryType = "creatorSubscriptions.listCreatorSubscribers" as const;

  public constructor(private readonly service: CreatorSubscriptionsServices) {
    super();
  }

  public execute(query: ListCreatorSubscribersQuery): Promise<readonly CreatorSubscriberDto[]> {
    return this.service.plans.listSubscribers(query.creatorId);
  }
}

import { QueryHandler } from "@zudojs/cqrs";

import type { StoreSummary } from "../../../../interfaces/storeAccess.interface.js";
import type { UserSummary } from "../../../../interfaces/userDirectory.interface.js";
import type { Page } from "../../../../types/pagination.type.js";
import { orderSummariesByIds } from "../../dtos/follows.dto.js";
import type { FollowsService } from "../../services/follows.service.js";
import type { ListFollowingQuery } from "./listFollowing.query.js";

export class ListFollowingHandler extends QueryHandler<ListFollowingQuery, Page<UserSummary | StoreSummary>> {
  public readonly queryType = "follows.listFollowing" as const;

  public constructor(private readonly followsService: FollowsService) {
    super();
  }

  public async execute(query: ListFollowingQuery): Promise<Page<UserSummary | StoreSummary>> {
    const { follows, userDirectory, storeAccess } = this.followsService.dependencies;
    const page = await follows.listFollowing(query.userId, query.targetType, query.page);
    const targetIds = page.items.map((record) => record.targetId);
    const summaries =
      query.targetType === "store" ? await storeAccess.findStoreSummaries(targetIds) : await userDirectory.findUserSummaries(targetIds);
    return { items: orderSummariesByIds<UserSummary | StoreSummary>(targetIds, summaries), nextCursor: page.nextCursor };
  }
}

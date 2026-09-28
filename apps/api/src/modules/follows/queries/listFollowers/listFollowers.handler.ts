import { QueryHandler } from "@zudojs/cqrs";

import type { UserSummary } from "../../../../interfaces/userDirectory.interface.js";
import type { Page } from "../../../../types/pagination.type.js";
import type { FollowsService } from "../../services/follows.service.js";
import { orderSummariesByIds } from "../../dtos/follows.dto.js";
import type { ListFollowersQuery } from "./listFollowers.query.js";

export class ListFollowersHandler extends QueryHandler<ListFollowersQuery, Page<UserSummary>> {
  public readonly queryType = "follows.listFollowers" as const;

  public constructor(private readonly followsService: FollowsService) {
    super();
  }

  public async execute(query: ListFollowersQuery): Promise<Page<UserSummary>> {
    const { follows, userDirectory } = this.followsService.dependencies;
    const page = await follows.listFollowers(query.targetType, query.targetId, query.page);
    const followerIds = page.items.map((record) => record.followerId);
    const summaries = await userDirectory.findUserSummaries(followerIds);
    return { items: orderSummariesByIds(followerIds, summaries), nextCursor: page.nextCursor };
  }
}

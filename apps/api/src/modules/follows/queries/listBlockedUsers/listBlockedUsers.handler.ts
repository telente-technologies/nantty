import { QueryHandler } from "@zudojs/cqrs";

import type { UserSummary } from "../../../../interfaces/userDirectory.interface.js";
import type { Page } from "../../../../types/pagination.type.js";
import { orderSummariesByIds } from "../../dtos/follows.dto.js";
import type { FollowsService } from "../../services/follows.service.js";
import type { ListBlockedUsersQuery } from "./listBlockedUsers.query.js";

export class ListBlockedUsersHandler extends QueryHandler<ListBlockedUsersQuery, Page<UserSummary>> {
  public readonly queryType = "follows.listBlockedUsers" as const;

  public constructor(private readonly followsService: FollowsService) {
    super();
  }

  public async execute(query: ListBlockedUsersQuery): Promise<Page<UserSummary>> {
    const { blocks, userDirectory } = this.followsService.dependencies;
    const page = await blocks.listBlockedByUser(query.principal.userId, query.page);
    const blockedIds = page.data.map((record) => record.blockedId);
    return { data: orderSummariesByIds(blockedIds, await userDirectory.findUserSummaries(blockedIds)), nextCursor: page.nextCursor };
  }
}

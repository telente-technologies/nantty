import { QueryHandler } from "@zudojs/cqrs";

import type { FollowStatus } from "../../models/follows.model.js";
import type { FollowsService } from "../../services/follows.service.js";
import type { GetFollowStatusQuery } from "./getFollowStatus.query.js";

export class GetFollowStatusHandler extends QueryHandler<GetFollowStatusQuery, FollowStatus> {
  public readonly queryType = "follows.getFollowStatus" as const;

  public constructor(private readonly followsService: FollowsService) {
    super();
  }

  public async execute(query: GetFollowStatusQuery): Promise<FollowStatus> {
    const { follows, blocks } = this.followsService.dependencies;
    const { viewerId, targetType, targetId } = query;
    if (targetType === "store") await this.followsService.findActiveStoreOrThrow(targetId);
    else await this.followsService.findUserSummaryOrThrow(targetId);
    const isUser = targetType === "user";
    return {
      following: viewerId === undefined ? false : await follows.isFollowing(viewerId, targetType, targetId),
      followedBy: viewerId === undefined || !isUser ? false : await follows.isFollowing(targetId, "user", viewerId),
      blocked: viewerId === undefined || !isUser ? false : await blocks.hasBlocked(viewerId, targetId),
      blockedBy: viewerId === undefined || !isUser ? false : await blocks.hasBlocked(targetId, viewerId),
      followersCount: await follows.countFollowers(targetType, targetId),
      followingCount: isUser ? await follows.countFollowing(targetId) : 0,
    };
  }
}

import type { SocialGraph } from "../../../interfaces/socialGraph.interface.js";
import type { BlocksRepository } from "../repositories/blocks.repository.js";
import type { FollowsRepository } from "../repositories/follows.repository.js";

export class RepositorySocialGraph implements SocialGraph {
  public constructor(private readonly follows: FollowsRepository, private readonly blocks: BlocksRepository) {}

  public async isBlockedEitherWay(userId: string, otherUserId: string): Promise<boolean> {
    return (await this.blocks.hasBlocked(userId, otherUserId)) || (await this.blocks.hasBlocked(otherUserId, userId));
  }

  public isFollowingUser(followerId: string, followedUserId: string): Promise<boolean> {
    return this.follows.isFollowing(followerId, "user", followedUserId);
  }

  public listFollowedUserIds(userId: string): Promise<readonly string[]> {
    return this.follows.listFollowedTargetIds(userId, "user");
  }

  public listFollowedStoreIds(userId: string): Promise<readonly string[]> {
    return this.follows.listFollowedTargetIds(userId, "store");
  }

  public countFollowers(targetType: "user" | "store", targetId: string): Promise<number> {
    return this.follows.countFollowers(targetType, targetId);
  }

  public listUserIdsBlockedEitherWay(userId: string): Promise<readonly string[]> {
    return this.blocks.listUserIdsBlockedEitherWay(userId);
  }
}

import type { EventBus } from "@zudojs/events";

import { forbidden, notFound, unprocessable } from "../../../errors/domain.error.js";
import type { Clock } from "../../../interfaces/clock.interface.js";
import type { StoreAccess, StoreSummary } from "../../../interfaces/storeAccess.interface.js";
import type { UserDirectory, UserSummary } from "../../../interfaces/userDirectory.interface.js";
import type { FollowTargetType } from "../models/follows.model.js";
import type { BlocksRepository } from "../repositories/blocks.repository.js";
import type { FollowsRepository } from "../repositories/follows.repository.js";

export interface FollowsDependencies {
  readonly follows: FollowsRepository;
  readonly blocks: BlocksRepository;
  readonly userDirectory: UserDirectory;
  readonly storeAccess: StoreAccess;
  readonly events: EventBus;
  readonly clock: Clock;
}

export class FollowsService {
  public constructor(public readonly dependencies: FollowsDependencies) {}

  public async findUserSummaryOrThrow(userId: string): Promise<UserSummary> {
    const [user] = await this.dependencies.userDirectory.findUserSummaries([userId]);
    if (user === undefined) throw notFound("User");
    return user;
  }

  public async findActiveStoreOrThrow(storeId: string): Promise<StoreSummary> {
    const [store] = await this.dependencies.storeAccess.findStoreSummaries([storeId]);
    if (store === undefined || store.status !== "active") throw notFound("Store");
    return store;
  }

  public async isBlockedEitherWay(userId: string, otherUserId: string): Promise<boolean> {
    const { blocks } = this.dependencies;
    return (await blocks.hasBlocked(userId, otherUserId)) || (await blocks.hasBlocked(otherUserId, userId));
  }

  public async findRecipientAfterCheckingFollowTarget(followerId: string, targetType: FollowTargetType, targetId: string): Promise<string> {
    if (targetType === "store") return (await this.findActiveStoreOrThrow(targetId)).ownerId;
    if (targetId === followerId) throw unprocessable("You cannot follow yourself.");
    await this.findUserSummaryOrThrow(targetId);
    if (await this.isBlockedEitherWay(followerId, targetId)) throw forbidden("You cannot follow this user.");
    return targetId;
  }
}

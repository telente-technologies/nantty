import { forbidden } from "../../../errors/domain.error.js";
import type { StoreSummary } from "../../../interfaces/storeAccess.interface.js";
import type { UserSummary } from "../../../interfaces/userDirectory.interface.js";
import type { Page, PageRequest } from "../../../types/pagination.type.js";
import { paginateSortedItems } from "../../../utils/pagination.util.js";
import type { FollowsService } from "./follows.service.js";

export type ConnectionTab = "followers" | "following" | "shopped" | "suggested" | "blocked";

export interface ConnectionDto {
  readonly id: string;
  readonly type: "user" | "store";
  readonly name: string;
  readonly username: string | null;
  readonly avatarUrl: string | null;
  readonly verified: boolean;
  readonly isFollowing: boolean;
}

const SUGGESTION_SOURCE_LIMIT = 30;
const SUGGESTION_COUNT = 30;

export class ConnectionsService {
  public constructor(private readonly followsService: FollowsService) {}

  public async listConnections(viewerId: string, userId: string, tab: ConnectionTab, page: PageRequest): Promise<Page<ConnectionDto>> {
    const { follows, blocks, userDirectory, storeAccess, orderLookup } = this.followsService.dependencies;
    const isSelf = viewerId === userId;
    if ((tab === "shopped" || tab === "suggested" || tab === "blocked") && !isSelf) throw forbidden("You can only see this list for yourself.");
    if (tab === "followers" || tab === "following") {
      const records = tab === "followers" ? await follows.listFollowers("user", userId, page) : await follows.listFollowing(userId, "user", page);
      const ids = records.data.map((record) => (tab === "followers" ? record.followerId : record.targetId));
      return { data: await this.presentUsers(viewerId, await userDirectory.findUserSummaries(ids)), nextCursor: records.nextCursor };
    }
    if (tab === "blocked") {
      const records = await blocks.listBlockedByUser(userId, page);
      const users = await userDirectory.findUserSummaries(records.data.map((record) => record.blockedId));
      return { data: users.map((user) => ({ ...this.convertUserToConnection(user), isFollowing: false })), nextCursor: records.nextCursor };
    }
    if (tab === "shopped") {
      const stores = await storeAccess.findStoreSummaries(await orderLookup.listStoreIdsBuyerHasPurchasedFrom(userId));
      const followedStoreIds = new Set(await follows.listFollowedTargetIds(viewerId, "store"));
      return paginateSortedItems(stores.map((store) => this.convertStoreToConnection(store, followedStoreIds.has(store.id))), page);
    }
    return paginateSortedItems(await this.suggestPeopleToFollow(viewerId), page);
  }

  public async searchPeople(viewerId: string | undefined, term: string): Promise<readonly ConnectionDto[]> {
    const { userDirectory, blocks } = this.followsService.dependencies;
    const blocked = new Set(viewerId === undefined ? [] : await blocks.listUserIdsBlockedEitherWay(viewerId));
    const users = (await userDirectory.searchUsers(term, SUGGESTION_COUNT)).filter((user) => !blocked.has(user.id) && user.id !== viewerId);
    return viewerId === undefined ? users.map((user) => ({ ...this.convertUserToConnection(user), isFollowing: false })) : this.presentUsers(viewerId, users);
  }

  private async suggestPeopleToFollow(viewerId: string): Promise<ConnectionDto[]> {
    const { follows, blocks, userDirectory } = this.followsService.dependencies;
    const followed = await follows.listFollowedTargetIds(viewerId, "user");
    const excluded = new Set([viewerId, ...followed, ...(await blocks.listUserIdsBlockedEitherWay(viewerId))]);
    const mutualCounts = new Map<string, number>();
    for (const followedId of followed.slice(0, SUGGESTION_SOURCE_LIMIT)) {
      for (const candidateId of await follows.listFollowedTargetIds(followedId, "user")) {
        if (!excluded.has(candidateId)) mutualCounts.set(candidateId, (mutualCounts.get(candidateId) ?? 0) + 1);
      }
    }
    const rankedIds = [...mutualCounts.entries()].sort((left, right) => right[1] - left[1]).slice(0, SUGGESTION_COUNT).map(([id]) => id);
    const users = await userDirectory.findUserSummaries(rankedIds);
    const byId = new Map(users.map((user) => [user.id, user]));
    return rankedIds.flatMap((id) => {
      const user = byId.get(id);
      return user === undefined ? [] : [{ ...this.convertUserToConnection(user), isFollowing: false }];
    });
  }

  private async presentUsers(viewerId: string, users: readonly UserSummary[]): Promise<ConnectionDto[]> {
    const followed = new Set(await this.followsService.dependencies.follows.listFollowedTargetIds(viewerId, "user"));
    return users.map((user) => ({ ...this.convertUserToConnection(user), isFollowing: followed.has(user.id) }));
  }

  private convertUserToConnection(user: UserSummary): Omit<ConnectionDto, "isFollowing"> {
    return { id: user.id, type: "user", name: user.name, username: user.username, avatarUrl: user.avatarUrl, verified: user.isSeller };
  }

  private convertStoreToConnection(store: StoreSummary, isFollowing: boolean): ConnectionDto {
    return { id: store.id, type: "store", name: store.name, username: store.slug, avatarUrl: store.logoUrl, verified: store.featured, isFollowing };
  }
}

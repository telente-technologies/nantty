import type { Page, PageRequest } from "../../../types/pagination.type.js";
import type { FollowRecord, FollowTargetType } from "../models/follows.model.js";

export interface FollowsRepository {
  follow(followerId: string, targetType: FollowTargetType, targetId: string, createdAt: Date): Promise<boolean>;
  unfollow(followerId: string, targetType: FollowTargetType, targetId: string): Promise<boolean>;
  isFollowing(followerId: string, targetType: FollowTargetType, targetId: string): Promise<boolean>;
  listFollowers(targetType: FollowTargetType, targetId: string, page: PageRequest): Promise<Page<FollowRecord>>;
  listFollowing(followerId: string, targetType: FollowTargetType, page: PageRequest): Promise<Page<FollowRecord>>;
  listFollowedTargetIds(followerId: string, targetType: FollowTargetType): Promise<readonly string[]>;
  countFollowers(targetType: FollowTargetType, targetId: string): Promise<number>;
  countFollowing(followerId: string): Promise<number>;
  removeUserFollowsBetween(userId: string, otherUserId: string): Promise<void>;
}

function paginateByCursorField(records: readonly FollowRecord[], field: "followerId" | "targetId", page: PageRequest): Page<FollowRecord> {
  let start = 0;
  if (page.cursor !== undefined) {
    const at = records.findIndex((record) => record[field] === page.cursor);
    if (at === -1) return { data: [], nextCursor: null };
    start = at + 1;
  }
  const items = records.slice(start, start + page.limit);
  const last = items.at(-1);
  return { data: items, nextCursor: last !== undefined && start + page.limit < records.length ? last[field] : null };
}

function sortNewestFirst(records: FollowRecord[]): FollowRecord[] {
  return records.sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
}

export class InMemoryFollowsRepository implements FollowsRepository {
  private readonly follows = new Map<string, FollowRecord>();

  public async follow(followerId: string, targetType: FollowTargetType, targetId: string, createdAt: Date): Promise<boolean> {
    const key = `${followerId}:${targetType}:${targetId}`;
    if (this.follows.has(key)) return false;
    this.follows.set(key, { followerId, targetType, targetId, createdAt });
    return true;
  }

  public async unfollow(followerId: string, targetType: FollowTargetType, targetId: string): Promise<boolean> {
    return this.follows.delete(`${followerId}:${targetType}:${targetId}`);
  }

  public async isFollowing(followerId: string, targetType: FollowTargetType, targetId: string): Promise<boolean> {
    return this.follows.has(`${followerId}:${targetType}:${targetId}`);
  }

  public async listFollowers(targetType: FollowTargetType, targetId: string, page: PageRequest): Promise<Page<FollowRecord>> {
    const matches = [...this.follows.values()].filter((record) => record.targetType === targetType && record.targetId === targetId);
    return paginateByCursorField(sortNewestFirst(matches), "followerId", page);
  }

  public async listFollowing(followerId: string, targetType: FollowTargetType, page: PageRequest): Promise<Page<FollowRecord>> {
    const matches = [...this.follows.values()].filter((record) => record.followerId === followerId && record.targetType === targetType);
    return paginateByCursorField(sortNewestFirst(matches), "targetId", page);
  }

  public async listFollowedTargetIds(followerId: string, targetType: FollowTargetType): Promise<readonly string[]> {
    return [...this.follows.values()]
      .filter((record) => record.followerId === followerId && record.targetType === targetType)
      .map((record) => record.targetId);
  }

  public async countFollowers(targetType: FollowTargetType, targetId: string): Promise<number> {
    return [...this.follows.values()].filter((record) => record.targetType === targetType && record.targetId === targetId).length;
  }

  public async countFollowing(followerId: string): Promise<number> {
    return [...this.follows.values()].filter((record) => record.followerId === followerId).length;
  }

  public async removeUserFollowsBetween(userId: string, otherUserId: string): Promise<void> {
    this.follows.delete(`${userId}:user:${otherUserId}`);
    this.follows.delete(`${otherUserId}:user:${userId}`);
  }
}

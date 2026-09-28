import { isUniqueConstraintViolation } from "../../../databases/prisma.database.js";
import type { Follow } from "../../../generated/prisma/client.js";
import { prisma } from "../../../integrations/database.integration.js";
import type { Page, PageRequest } from "../../../types/pagination.type.js";
import type { FollowRecord, FollowTargetType } from "../models/follows.model.js";
import type { FollowsRepository } from "./follows.repository.js";

function convertFollowRowToRecord(row: Follow): FollowRecord {
  return { followerId: row.followerId, targetType: row.followeeType === "store" ? "store" : "user", targetId: row.followeeId, createdAt: row.createdAt };
}

function buildFollowPage(rows: readonly Follow[], page: PageRequest, field: "followerId" | "followeeId"): Page<FollowRecord> {
  const items = rows.slice(0, page.limit);
  const last = items.at(-1);
  return { items: items.map(convertFollowRowToRecord), nextCursor: rows.length > page.limit && last !== undefined ? last[field] : null };
}

export class PrismaFollowsRepository implements FollowsRepository {
  public async follow(followerId: string, targetType: FollowTargetType, targetId: string, createdAt: Date): Promise<boolean> {
    try {
      await prisma().follow.create({ data: { followerId, followeeType: targetType, followeeId: targetId, createdAt } });
      return true;
    } catch (error) {
      if (isUniqueConstraintViolation(error)) return false;
      throw error;
    }
  }

  public async unfollow(followerId: string, targetType: FollowTargetType, targetId: string): Promise<boolean> {
    const result = await prisma().follow.deleteMany({ where: { followerId, followeeType: targetType, followeeId: targetId } });
    return result.count > 0;
  }

  public async isFollowing(followerId: string, targetType: FollowTargetType, targetId: string): Promise<boolean> {
    return (await prisma().follow.count({ where: { followerId, followeeType: targetType, followeeId: targetId } })) > 0;
  }

  public async listFollowers(targetType: FollowTargetType, targetId: string, page: PageRequest): Promise<Page<FollowRecord>> {
    const rows = await prisma().follow.findMany({
      where: { followeeType: targetType, followeeId: targetId },
      orderBy: [{ createdAt: "desc" }, { followerId: "desc" }],
      take: page.limit + 1,
      ...(page.cursor === undefined
        ? {}
        : { cursor: { followerId_followeeType_followeeId: { followerId: page.cursor, followeeType: targetType, followeeId: targetId } }, skip: 1 }),
    });
    return buildFollowPage(rows, page, "followerId");
  }

  public async listFollowing(followerId: string, targetType: FollowTargetType, page: PageRequest): Promise<Page<FollowRecord>> {
    const rows = await prisma().follow.findMany({
      where: { followerId, followeeType: targetType },
      orderBy: [{ createdAt: "desc" }, { followeeId: "desc" }],
      take: page.limit + 1,
      ...(page.cursor === undefined
        ? {}
        : { cursor: { followerId_followeeType_followeeId: { followerId, followeeType: targetType, followeeId: page.cursor } }, skip: 1 }),
    });
    return buildFollowPage(rows, page, "followeeId");
  }

  public async listFollowedTargetIds(followerId: string, targetType: FollowTargetType): Promise<readonly string[]> {
    const rows = await prisma().follow.findMany({ where: { followerId, followeeType: targetType }, select: { followeeId: true } });
    return rows.map((row) => row.followeeId);
  }

  public async countFollowers(targetType: FollowTargetType, targetId: string): Promise<number> {
    return prisma().follow.count({ where: { followeeType: targetType, followeeId: targetId } });
  }

  public async countFollowing(followerId: string): Promise<number> {
    return prisma().follow.count({ where: { followerId } });
  }

  public async removeUserFollowsBetween(userId: string, otherUserId: string): Promise<void> {
    await prisma().follow.deleteMany({
      where: {
        followeeType: "user",
        OR: [
          { followerId: userId, followeeId: otherUserId },
          { followerId: otherUserId, followeeId: userId },
        ],
      },
    });
  }
}

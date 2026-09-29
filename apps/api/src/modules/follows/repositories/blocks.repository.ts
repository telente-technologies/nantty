import { isUniqueConstraintViolation } from "../../../databases/prisma.database.js";
import { prisma } from "../../../integrations/database.integration.js";
import type { Page, PageRequest } from "../../../types/pagination.type.js";
import type { BlockRecord } from "../models/follows.model.js";

export interface BlocksRepository {
  block(blockerId: string, blockedId: string, createdAt: Date): Promise<boolean>;
  unblock(blockerId: string, blockedId: string): Promise<boolean>;
  hasBlocked(blockerId: string, blockedId: string): Promise<boolean>;
  listBlockedByUser(blockerId: string, page: PageRequest): Promise<Page<BlockRecord>>;
  listUserIdsBlockedEitherWay(userId: string): Promise<readonly string[]>;
}

export class InMemoryBlocksRepository implements BlocksRepository {
  private readonly blocks = new Map<string, BlockRecord>();

  public async block(blockerId: string, blockedId: string, createdAt: Date): Promise<boolean> {
    const key = `${blockerId}:${blockedId}`;
    if (this.blocks.has(key)) return false;
    this.blocks.set(key, { blockerId, blockedId, createdAt });
    return true;
  }

  public async unblock(blockerId: string, blockedId: string): Promise<boolean> {
    return this.blocks.delete(`${blockerId}:${blockedId}`);
  }

  public async hasBlocked(blockerId: string, blockedId: string): Promise<boolean> {
    return this.blocks.has(`${blockerId}:${blockedId}`);
  }

  public async listBlockedByUser(blockerId: string, page: PageRequest): Promise<Page<BlockRecord>> {
    const records = [...this.blocks.values()]
      .filter((record) => record.blockerId === blockerId)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
    let start = 0;
    if (page.cursor !== undefined) {
      const at = records.findIndex((record) => record.blockedId === page.cursor);
      if (at === -1) return { data: [], nextCursor: null };
      start = at + 1;
    }
    const items = records.slice(start, start + page.limit);
    const last = items.at(-1);
    return { data: items, nextCursor: last !== undefined && start + page.limit < records.length ? last.blockedId : null };
  }

  public async listUserIdsBlockedEitherWay(userId: string): Promise<readonly string[]> {
    const ids = new Set<string>();
    for (const record of this.blocks.values()) {
      if (record.blockerId === userId) ids.add(record.blockedId);
      if (record.blockedId === userId) ids.add(record.blockerId);
    }
    return [...ids];
  }
}

export class PrismaBlocksRepository implements BlocksRepository {
  public async block(blockerId: string, blockedId: string, createdAt: Date): Promise<boolean> {
    try {
      await prisma().block.create({ data: { blockerId, blockedId, createdAt } });
      return true;
    } catch (error) {
      if (isUniqueConstraintViolation(error)) return false;
      throw error;
    }
  }

  public async unblock(blockerId: string, blockedId: string): Promise<boolean> {
    return (await prisma().block.deleteMany({ where: { blockerId, blockedId } })).count > 0;
  }

  public async hasBlocked(blockerId: string, blockedId: string): Promise<boolean> {
    return (await prisma().block.count({ where: { blockerId, blockedId } })) > 0;
  }

  public async listBlockedByUser(blockerId: string, page: PageRequest): Promise<Page<BlockRecord>> {
    const rows = await prisma().block.findMany({
      where: { blockerId },
      orderBy: [{ createdAt: "desc" }, { blockedId: "desc" }],
      take: page.limit + 1,
      ...(page.cursor === undefined ? {} : { cursor: { blockerId_blockedId: { blockerId, blockedId: page.cursor } }, skip: 1 }),
    });
    const items = rows.slice(0, page.limit);
    const last = items.at(-1);
    return { data: items, nextCursor: rows.length > page.limit && last !== undefined ? last.blockedId : null };
  }

  public async listUserIdsBlockedEitherWay(userId: string): Promise<readonly string[]> {
    const rows = await prisma().block.findMany({ where: { OR: [{ blockerId: userId }, { blockedId: userId }] } });
    return [...new Set(rows.map((row) => (row.blockerId === userId ? row.blockedId : row.blockerId)))];
  }
}

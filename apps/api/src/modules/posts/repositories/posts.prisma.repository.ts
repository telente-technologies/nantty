import type { Post, Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../../integrations/database.integration.js";
import type { Page, PageRequest } from "../../../types/pagination.type.js";
import { buildPageFromFetchedRows, buildPrismaPageArguments, mapPageItems } from "../../../utils/pagination.util.js";
import type { CounterField, NewPostInput, PostKind, PostListFilter, PostMedia, PostRecord } from "../models/posts.model.js";
import type { PostsRepository } from "./posts.repository.js";

function convertPostRowToRecord(row: Post): PostRecord {
  return {
    id: row.id,
    authorId: row.authorId,
    storeId: row.storeId,
    kind: row.kind as PostKind,
    text: row.text,
    media: (Array.isArray(row.media) ? row.media : []) as unknown as PostMedia[],
    audience: "everyone",
    topics: row.topics,
    productIds: row.productIds,
    repostOfId: row.repostOfId,
    likeCount: row.likeCount,
    commentCount: row.commentCount,
    repostCount: row.repostCount,
    shareCount: row.shareCount,
    viewCount: row.viewCount,
    expiresAt: row.expiresAt,
    deletedAt: row.deletedAt,
    createdAt: row.createdAt,
  };
}

function buildVisiblePostsWhere(filter: PostListFilter, now: Date): Prisma.PostWhereInput {
  const ownership: Prisma.PostWhereInput[] = [
    ...(filter.authorIds === undefined ? [] : [{ authorId: { in: [...filter.authorIds] } }]),
    ...(filter.storeIds === undefined ? [] : [{ storeId: { in: [...filter.storeIds] } }]),
  ];
  return {
    deletedAt: null,
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    ...(ownership.length === 0 ? {} : { AND: [{ OR: ownership }] }),
    ...(filter.kinds === undefined ? {} : { kind: { in: [...filter.kinds] } }),
    ...(filter.topic === undefined ? {} : { topics: { has: filter.topic } }),
    ...(filter.excludeAuthorIds === undefined || filter.excludeAuthorIds.length === 0 ? {} : { authorId: { notIn: [...filter.excludeAuthorIds] } }),
    ...(filter.createdAfter === undefined ? {} : { createdAt: { gt: filter.createdAfter } }),
  };
}

export class PrismaPostsRepository implements PostsRepository {
  public async create(input: NewPostInput): Promise<PostRecord> {
    const row = await prisma().post.create({
      data: {
        ...input,
        media: input.media.map((item) => ({ url: item.url, type: item.type })),
        topics: [...input.topics],
        productIds: [...input.productIds],
      },
    });
    return convertPostRowToRecord(row);
  }

  public async findById(id: string): Promise<PostRecord | undefined> {
    const row = await prisma().post.findUnique({ where: { id } });
    return row === null ? undefined : convertPostRowToRecord(row);
  }

  public async findManyByIds(ids: readonly string[]): Promise<readonly PostRecord[]> {
    const rows = await prisma().post.findMany({ where: { id: { in: [...ids] } } });
    return rows.map(convertPostRowToRecord);
  }

  public async markDeleted(id: string, deletedAt: Date): Promise<void> {
    await prisma().post.updateMany({ where: { id, deletedAt: null }, data: { deletedAt } });
  }

  public async addTaggedProducts(id: string, productIds: readonly string[]): Promise<PostRecord | undefined> {
    const existing = await this.findById(id);
    if (existing === undefined) return undefined;
    const merged = [...new Set([...existing.productIds, ...productIds])];
    return convertPostRowToRecord(await prisma().post.update({ where: { id }, data: { productIds: merged } }));
  }

  public async changeCounter(id: string, field: CounterField, delta: number): Promise<void> {
    const where = delta < 0 ? { id, [field]: { gte: -delta } } : { id };
    await prisma().post.updateMany({ where, data: { [field]: delta < 0 ? { decrement: -delta } : { increment: delta } } });
  }

  public async listVisible(filter: PostListFilter, now: Date, page: PageRequest): Promise<Page<PostRecord>> {
    const rows = await prisma().post.findMany({
      where: buildVisiblePostsWhere(filter, now),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...buildPrismaPageArguments(page),
    });
    return mapPageItems(buildPageFromFetchedRows(rows, page), convertPostRowToRecord);
  }

  public async listRecentCandidates(filter: PostListFilter, now: Date, limit: number): Promise<readonly PostRecord[]> {
    const rows = await prisma().post.findMany({
      where: buildVisiblePostsWhere(filter, now),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
    });
    return rows.map(convertPostRowToRecord);
  }
}

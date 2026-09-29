import { randomUUID } from "node:crypto";

import type { Page, PageRequest } from "../../../types/pagination.type.js";
import { compareByNewestFirst, paginateSortedItems } from "../../../utils/pagination.util.js";
import type { CounterField, NewPostInput, PostKind, PostListFilter, PostRecord } from "../models/posts.model.js";

export interface PostsRepository {
  create(input: NewPostInput): Promise<PostRecord>;
  findById(id: string): Promise<PostRecord | undefined>;
  findManyByIds(ids: readonly string[]): Promise<readonly PostRecord[]>;
  markDeleted(id: string, deletedAt: Date): Promise<void>;
  addTaggedProducts(id: string, productIds: readonly string[]): Promise<PostRecord | undefined>;
  changeCounter(id: string, field: CounterField, delta: number): Promise<void>;
  listVisible(filter: PostListFilter, now: Date, page: PageRequest): Promise<Page<PostRecord>>;
  listRecentCandidates(filter: PostListFilter, now: Date, limit: number): Promise<readonly PostRecord[]>;
  summarizeAuthorContent(authorId: string): Promise<AuthorContentSummary>;
}

export interface AuthorContentSummary {
  readonly postCount: number;
  readonly viewCount: number;
}

export const CREATOR_CONTENT_KINDS: readonly PostKind[] = ["post", "clip"];

export function isPostVisibleAt(post: PostRecord, now: Date): boolean {
  return post.deletedAt === null && (post.expiresAt === null || post.expiresAt > now);
}

export function postMatchesFilter(post: PostRecord, filter: PostListFilter): boolean {
  const byAuthorOrStore =
    (filter.authorIds === undefined && filter.storeIds === undefined) ||
    (filter.authorIds?.includes(post.authorId) ?? false) ||
    (post.storeId !== null && (filter.storeIds?.includes(post.storeId) ?? false));
  return (
    byAuthorOrStore &&
    (filter.kinds === undefined || filter.kinds.includes(post.kind)) &&
    (filter.topic === undefined || post.topics.includes(filter.topic)) &&
    !(filter.excludeAuthorIds?.includes(post.authorId) ?? false) &&
    (filter.createdAfter === undefined || post.createdAt > filter.createdAfter)
  );
}

export class InMemoryPostsRepository implements PostsRepository {
  private readonly posts = new Map<string, PostRecord>();

  public async create(input: NewPostInput): Promise<PostRecord> {
    const post: PostRecord = {
      ...input,
      id: randomUUID(),
      audience: "everyone",
      likeCount: 0,
      commentCount: 0,
      repostCount: 0,
      shareCount: 0,
      viewCount: 0,
      deletedAt: null,
    };
    this.posts.set(post.id, post);
    return post;
  }

  public async findById(id: string): Promise<PostRecord | undefined> {
    return this.posts.get(id);
  }

  public async findManyByIds(ids: readonly string[]): Promise<readonly PostRecord[]> {
    return ids.map((id) => this.posts.get(id)).filter((post): post is PostRecord => post !== undefined);
  }

  public async markDeleted(id: string, deletedAt: Date): Promise<void> {
    const post = this.posts.get(id);
    if (post !== undefined) this.posts.set(id, { ...post, deletedAt });
  }

  public async addTaggedProducts(id: string, productIds: readonly string[]): Promise<PostRecord | undefined> {
    const post = this.posts.get(id);
    if (post === undefined) return undefined;
    const updated = { ...post, productIds: [...new Set([...post.productIds, ...productIds])] };
    this.posts.set(id, updated);
    return updated;
  }

  public async changeCounter(id: string, field: CounterField, delta: number): Promise<void> {
    const post = this.posts.get(id);
    if (post !== undefined) this.posts.set(id, { ...post, [field]: Math.max(0, post[field] + delta) });
  }

  public async listVisible(filter: PostListFilter, now: Date, page: PageRequest): Promise<Page<PostRecord>> {
    const matches = [...this.posts.values()]
      .filter((post) => isPostVisibleAt(post, now) && postMatchesFilter(post, filter))
      .sort(compareByNewestFirst);
    return paginateSortedItems(matches, page);
  }

  public async listRecentCandidates(filter: PostListFilter, now: Date, limit: number): Promise<readonly PostRecord[]> {
    return (await this.listVisible(filter, now, { limit })).data;
  }

  public async summarizeAuthorContent(authorId: string): Promise<AuthorContentSummary> {
    const posts = [...this.posts.values()].filter((post) => post.authorId === authorId && post.deletedAt === null && CREATOR_CONTENT_KINDS.includes(post.kind));
    return { postCount: posts.length, viewCount: posts.reduce((total, post) => total + post.viewCount, 0) };
  }
}

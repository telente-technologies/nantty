import { randomUUID } from "node:crypto";

import type { Page, PageRequest } from "../../../types/pagination.type.js";
import { paginateSortedItems } from "../../../utils/pagination.util.js";
import type { CommentRecord } from "../models/posts.model.js";

export interface NewCommentInput {
  readonly postId: string;
  readonly authorId: string;
  readonly parentId: string | null;
  readonly text: string;
  readonly createdAt: Date;
}

export interface PostInteractionsRepository {
  addLike(postId: string, userId: string, createdAt: Date): Promise<boolean>;
  removeLike(postId: string, userId: string): Promise<boolean>;
  listPostIdsLikedByUser(userId: string, postIds: readonly string[]): Promise<ReadonlySet<string>>;
  listLikersAmongUsers(postIds: readonly string[], userIds: readonly string[]): Promise<ReadonlyMap<string, readonly string[]>>;
  createComment(input: NewCommentInput): Promise<CommentRecord>;
  findComment(commentId: string): Promise<CommentRecord | undefined>;
  markCommentDeleted(commentId: string, deletedAt: Date): Promise<boolean>;
  listComments(postId: string, page: PageRequest): Promise<Page<CommentRecord>>;
}

function groupLikersByPost(likes: readonly { postId: string; userId: string }[]): ReadonlyMap<string, readonly string[]> {
  const grouped = new Map<string, string[]>();
  for (const like of likes) grouped.set(like.postId, [...(grouped.get(like.postId) ?? []), like.userId]);
  return grouped;
}

export class InMemoryPostInteractionsRepository implements PostInteractionsRepository {
  private readonly likes = new Map<string, { postId: string; userId: string; createdAt: Date }>();
  private readonly comments = new Map<string, CommentRecord>();

  public async addLike(postId: string, userId: string, createdAt: Date): Promise<boolean> {
    const key = `${postId}:${userId}`;
    if (this.likes.has(key)) return false;
    this.likes.set(key, { postId, userId, createdAt });
    return true;
  }

  public async removeLike(postId: string, userId: string): Promise<boolean> {
    return this.likes.delete(`${postId}:${userId}`);
  }

  public async listPostIdsLikedByUser(userId: string, postIds: readonly string[]): Promise<ReadonlySet<string>> {
    return new Set(postIds.filter((postId) => this.likes.has(`${postId}:${userId}`)));
  }

  public async listLikersAmongUsers(postIds: readonly string[], userIds: readonly string[]): Promise<ReadonlyMap<string, readonly string[]>> {
    const wanted = new Set(userIds);
    return groupLikersByPost([...this.likes.values()].filter((like) => postIds.includes(like.postId) && wanted.has(like.userId)));
  }

  public async createComment(input: NewCommentInput): Promise<CommentRecord> {
    const comment: CommentRecord = { ...input, id: randomUUID(), deletedAt: null };
    this.comments.set(comment.id, comment);
    return comment;
  }

  public async findComment(commentId: string): Promise<CommentRecord | undefined> {
    return this.comments.get(commentId);
  }

  public async markCommentDeleted(commentId: string, deletedAt: Date): Promise<boolean> {
    const comment = this.comments.get(commentId);
    if (comment === undefined || comment.deletedAt !== null) return false;
    this.comments.set(commentId, { ...comment, deletedAt });
    return true;
  }

  public async listComments(postId: string, page: PageRequest): Promise<Page<CommentRecord>> {
    const matches = [...this.comments.values()]
      .filter((comment) => comment.postId === postId && comment.deletedAt === null)
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id));
    return paginateSortedItems(matches, page);
  }
}

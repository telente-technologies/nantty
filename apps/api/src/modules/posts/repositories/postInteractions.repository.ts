import { randomUUID } from "node:crypto";

import type { Page, PageRequest } from "../../../types/pagination.type.js";
import { paginateSortedItems } from "../../../utils/pagination.util.js";
import type { CommentRecord } from "../models/posts.model.js";

export interface NewCommentInput {
  readonly postId: string;
  readonly authorId: string;
  readonly parentCommentId: string | null;
  readonly rootCommentId: string | null;
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
  findCommentsByIds(commentIds: readonly string[]): Promise<readonly CommentRecord[]>;
  markCommentDeleted(commentId: string, deletedAt: Date): Promise<boolean>;
  changeReplyCount(commentIds: readonly string[], delta: number): Promise<void>;
  listTopLevelComments(postId: string, page: PageRequest): Promise<Page<CommentRecord>>;
  listThreadReplies(rootCommentId: string, page: PageRequest): Promise<Page<CommentRecord>>;
  listDirectReplies(parentCommentId: string, page: PageRequest): Promise<Page<CommentRecord>>;
  listEarliestThreadReplies(rootCommentIds: readonly string[], limitPerThread: number): Promise<ReadonlyMap<string, readonly CommentRecord[]>>;
}

export function isCommentShownInThread(comment: CommentRecord): boolean {
  return comment.deletedAt === null || comment.replyCount > 0;
}

function compareOldestFirst(left: CommentRecord, right: CommentRecord): number {
  return left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id);
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
    const comment: CommentRecord = { ...input, id: randomUUID(), likeCount: 0, replyCount: 0, deletedAt: null };
    this.comments.set(comment.id, comment);
    return comment;
  }

  public async findComment(commentId: string): Promise<CommentRecord | undefined> {
    return this.comments.get(commentId);
  }

  public async findCommentsByIds(commentIds: readonly string[]): Promise<readonly CommentRecord[]> {
    return commentIds.map((commentId) => this.comments.get(commentId)).filter((comment): comment is CommentRecord => comment !== undefined);
  }

  public async markCommentDeleted(commentId: string, deletedAt: Date): Promise<boolean> {
    const comment = this.comments.get(commentId);
    if (comment === undefined || comment.deletedAt !== null) return false;
    this.comments.set(commentId, { ...comment, deletedAt });
    return true;
  }

  public async changeReplyCount(commentIds: readonly string[], delta: number): Promise<void> {
    for (const commentId of new Set(commentIds)) {
      const comment = this.comments.get(commentId);
      if (comment !== undefined) this.comments.set(commentId, { ...comment, replyCount: Math.max(0, comment.replyCount + delta) });
    }
  }

  public async listTopLevelComments(postId: string, page: PageRequest): Promise<Page<CommentRecord>> {
    return this.paginateShownComments((comment) => comment.postId === postId && comment.parentCommentId === null, page);
  }

  public async listThreadReplies(rootCommentId: string, page: PageRequest): Promise<Page<CommentRecord>> {
    return this.paginateShownComments((comment) => comment.rootCommentId === rootCommentId, page);
  }

  public async listDirectReplies(parentCommentId: string, page: PageRequest): Promise<Page<CommentRecord>> {
    return this.paginateShownComments((comment) => comment.parentCommentId === parentCommentId, page);
  }

  public async listEarliestThreadReplies(rootCommentIds: readonly string[], limitPerThread: number): Promise<ReadonlyMap<string, readonly CommentRecord[]>> {
    const previews = new Map<string, readonly CommentRecord[]>();
    for (const rootCommentId of new Set(rootCommentIds)) {
      previews.set(rootCommentId, (await this.listThreadReplies(rootCommentId, { limit: limitPerThread })).data);
    }
    return previews;
  }

  private paginateShownComments(matches: (comment: CommentRecord) => boolean, page: PageRequest): Page<CommentRecord> {
    const shown = [...this.comments.values()].filter((comment) => matches(comment) && isCommentShownInThread(comment)).sort(compareOldestFirst);
    return paginateSortedItems(shown, page);
  }
}

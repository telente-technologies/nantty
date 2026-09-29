import type { CommentDto, TopLevelCommentDto } from "../dtos/posts.dto.js";
import type { CommentRecord } from "../models/posts.model.js";
import type { PostsDependencies } from "./posts.service.js";
import { convertUserToAuthor, indexById, type PostPresenter } from "./postPresenter.service.js";

export const PREVIEW_REPLIES_PER_COMMENT = 2;
export const DELETED_COMMENT_TEXT = "This comment was deleted.";

export class CommentPresenter {
  public constructor(private readonly dependencies: PostsDependencies, private readonly postPresenter: PostPresenter) {}

  public async presentComments(comments: readonly CommentRecord[], viewerId: string | undefined): Promise<CommentDto[]> {
    const { engagement, interactions } = this.dependencies;
    const commentIds = comments.map((comment) => comment.id);
    const loadedIds = new Set(commentIds);
    const missingParentIds = comments.map((comment) => comment.parentCommentId).filter((id): id is string => id !== null && !loadedIds.has(id));
    const parents = indexById([...comments, ...(await interactions.findCommentsByIds([...new Set(missingParentIds)]))]);
    const [users, likeCounts, liked] = await Promise.all([
      this.postPresenter.findUsers([...parents.values()].map((comment) => comment.authorId)),
      engagement.countLikesForComments(commentIds),
      viewerId === undefined ? new Set<string>() : engagement.listCommentIdsLikedByUser(viewerId, commentIds),
    ]);
    return comments.map((comment) => {
      const deleted = comment.deletedAt !== null;
      const parent = comment.parentCommentId === null ? undefined : parents.get(comment.parentCommentId);
      const parentAuthor = parent === undefined || parent.deletedAt !== null ? undefined : users.get(parent.authorId);
      return {
        id: comment.id,
        postId: comment.postId,
        parentCommentId: comment.parentCommentId,
        rootCommentId: comment.rootCommentId,
        replyToCommentId: comment.parentCommentId,
        text: deleted ? DELETED_COMMENT_TEXT : comment.text,
        author: deleted ? null : convertUserToAuthor(users.get(comment.authorId)),
        likes: likeCounts.get(comment.id) ?? comment.likeCount,
        liked: liked.has(comment.id),
        replyCount: comment.replyCount,
        ...(parentAuthor === undefined ? {} : { replyingTo: { userId: parentAuthor.id, username: parentAuthor.username } }),
        ...(deleted ? { deleted: true as const } : {}),
        createdAt: comment.createdAt.toISOString(),
      };
    });
  }

  public async presentTopLevelComments(comments: readonly CommentRecord[], viewerId: string | undefined): Promise<TopLevelCommentDto[]> {
    const threadsWithReplies = comments.filter((comment) => comment.replyCount > 0).map((comment) => comment.id);
    const previews = threadsWithReplies.length === 0 ? new Map<string, readonly CommentRecord[]>() : await this.dependencies.interactions.listEarliestThreadReplies(threadsWithReplies, PREVIEW_REPLIES_PER_COMMENT);
    const presented = indexById(await this.presentComments([...comments, ...[...previews.values()].flat()], viewerId));
    return comments.map((comment) => ({
      ...(presented.get(comment.id) as CommentDto),
      previewReplies: (previews.get(comment.id) ?? []).map((reply) => presented.get(reply.id) as CommentDto),
    }));
  }
}

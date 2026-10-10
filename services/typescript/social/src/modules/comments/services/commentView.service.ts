import type { HandlerContext } from "../../../types/handlerContext.type.js";
import type { UserSummary } from "../../../interfaces/identityDirectory.interface.js";
import { blockRepository } from "../../blocks/repositories/block.repository.js";
import type { MentionEntity } from "../../mentions/models/mention.model.js";
import type { CommentVideoReply, CommentView } from "../models/comment.model.js";
import { commentRepository, type CommentRow } from "../repositories/comment.repository.js";

const placeholderAuthor = (id: string): UserSummary => ({ id, name: "", username: "", avatarUrl: null, verified: false, isCreator: false });

export async function buildCommentViews(context: HandlerContext, viewerId: string | undefined, rows: readonly CommentRow[], postAuthorId?: string): Promise<CommentView[]> {
  if (rows.length === 0) return [];
  const db = context.database.client;
  const commentIds = rows.map((row) => row.id);
  const parentIds = [...new Set(rows.flatMap((row) => (row.parentCommentId === null ? [] : [row.parentCommentId])))];
  const [parents, liked, videoReplyRows] = await Promise.all([
    parentIds.length === 0 ? [] : commentRepository.findManyByIds(db, parentIds),
    viewerId === undefined ? new Set<string>() : commentRepository.likedCommentIds(db, viewerId, commentIds),
    commentRepository.videoRepliesFor(db, commentIds),
  ]);
  const savedIds =
    viewerId === undefined
      ? new Set<string>()
      : new Set(
          (
            await db.savedItem.findMany({
              where: { userId: viewerId, type: "comment", targetId: { in: commentIds } },
              select: { targetId: true },
            })
          ).map((row) => row.targetId),
        );
  const authorIds = [...new Set([...rows.map((row) => row.authorId), ...parents.map((parent) => parent.authorId)])];
  const [authors, blockedViewer] = await Promise.all([
    context.directory.findUserSummaries(authorIds),
    postAuthorId === undefined ? new Set<string>() : blockRepository.blockersOfViewer(db, postAuthorId, authorIds),
  ]);
  const videoRepliesByComment = new Map<string, CommentVideoReply[]>();
  for (const reply of videoReplyRows) {
    if (reply.replyToCommentId === null) continue;
    const list = videoRepliesByComment.get(reply.replyToCommentId) ?? [];
    list.push({ clipId: reply.id, thumbnailUrl: reply.media[0]?.posterUrl ?? null, createdAt: reply.createdAt.toISOString() });
    videoRepliesByComment.set(reply.replyToCommentId, list);
  }
  const parentAuthorByCommentId = new Map(parents.map((parent) => [parent.id, parent.authorId]));
  return rows.map((row) => {
    const parentAuthorId = row.parentCommentId === null ? undefined : parentAuthorByCommentId.get(row.parentCommentId);
    const parentAuthor = parentAuthorId === undefined ? undefined : authors.get(parentAuthorId);
    return {
      id: row.id,
      postId: row.postId,
      parentCommentId: row.parentCommentId,
      rootCommentId: row.rootCommentId,
      author: authors.get(row.authorId) ?? placeholderAuthor(row.authorId),
      text: row.text,
      createdAt: row.createdAt.toISOString(),
      likes: row.likeCount,
      liked: liked.has(row.id),
      bookmarked: savedIds.has(row.id),
      replyCount: row.replyCount,
      depth: row.depth,
      isPinned: row.isPinned,
      pinnedAt: row.pinnedAt?.toISOString() ?? null,
      ...(parentAuthor === undefined ? {} : { replyingTo: { userId: parentAuthor.id, username: parentAuthor.username } }),
      mentions: row.mentions as unknown as MentionEntity[],
      videoReplies: videoRepliesByComment.get(row.id) ?? [],
      videoReplyBlocked: blockedViewer.has(row.authorId),
    };
  });
}

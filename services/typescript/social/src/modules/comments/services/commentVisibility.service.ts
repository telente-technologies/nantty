import type { Db } from "../../../types/database.type.js";
import { postRepository } from "../../posts/repositories/post.repository.js";
import { commentRepository, type CommentRow } from "../repositories/comment.repository.js";
import { descendantPathPrefix, threadRootIdOf, type ThreadPlacementSource } from "./commentThread.service.js";

const ancestorIdsOf = (comment: Pick<ThreadPlacementSource, "path">): string[] => (comment.path === "" ? [] : comment.path.split("/"));

export async function hasHiddenAmong(db: Db, ids: readonly string[], exceptAuthorId?: string): Promise<boolean> {
  if (ids.length === 0) return false;
  const found = await db.comment.findFirst({ where: { id: { in: [...ids] }, hiddenAt: { not: null }, ...(exceptAuthorId === undefined ? {} : { authorId: { not: exceptAuthorId } }) }, select: { id: true } });
  return found !== null;
}

export const isUnderHiddenAncestor = (db: Db, comment: Pick<ThreadPlacementSource, "path">, exceptAuthorId?: string): Promise<boolean> =>
  hasHiddenAmong(db, ancestorIdsOf(comment), exceptAuthorId);

export const isHiddenOrUnderHidden = (db: Db, comment: Pick<ThreadPlacementSource, "id" | "path">): Promise<boolean> =>
  hasHiddenAmong(db, [...ancestorIdsOf(comment), comment.id]);

export async function findCommentVisibleToViewer(db: Db, commentId: string, viewerId: string | undefined): Promise<CommentRow | null> {
  const comment = await commentRepository.findById(db, commentId, viewerId);
  if (comment === null) return null;
  return (await isUnderHiddenAncestor(db, comment, viewerId)) ? null : comment;
}

export async function publicSubtreeSize(db: Db, comment: ThreadPlacementSource): Promise<number> {
  const rows = await db.comment.findMany({
    where: { rootCommentId: threadRootIdOf(comment), path: { startsWith: descendantPathPrefix(comment) }, deletedAt: null },
    select: { id: true, path: true, hiddenAt: true },
  });
  const hiddenIds = new Set(rows.filter((row) => row.hiddenAt !== null).map((row) => row.id));
  return 1 + rows.filter((row) => row.hiddenAt === null && !row.path.split("/").some((id) => hiddenIds.has(id))).length;
}

export async function shiftPublicCountsFor(db: Db, comment: CommentRow, direction: 1 | -1): Promise<void> {
  if (comment.parentCommentId !== null) await commentRepository.incrementReplies(db, comment.parentCommentId, direction);
  if (await isUnderHiddenAncestor(db, comment)) return;
  await postRepository.incrementCounter(db, comment.postId, "commentCount", direction * (await publicSubtreeSize(db, comment)));
}

export const lockPostCommentCounts = (db: Db, postId: string): Promise<boolean> => postRepository.incrementCounterIfNotDeleted(db, postId, "commentCount", 0);

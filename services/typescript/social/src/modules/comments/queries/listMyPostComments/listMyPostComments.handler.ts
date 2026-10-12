import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { Page } from "../../../../types/pagination.type.js";
import { buildPageFromOverfetchedRows } from "../../../../utils/cursor.util.js";
import type { MyPostCommentItem, MyPostSummary } from "../../models/myPostComments.model.js";
import { commentRepository } from "../../repositories/comment.repository.js";
import { myPostCommentsRepository } from "../../repositories/myPostComments.repository.js";
import { buildCommentViews } from "../../services/commentView.service.js";
import type { ListMyPostCommentsQuery } from "./listMyPostComments.query.js";

const previewRepliesPerComment = 3;
const postExcerptLength = 140;

export function createListMyPostCommentsHandler(context: HandlerContext): Handler<ListMyPostCommentsQuery, Page<MyPostCommentItem>> {
  return async (query) => {
    const db = context.database.client;
    const page = buildPageFromOverfetchedRows(await myPostCommentsRepository.page(db, query), query.limit);
    const topLevelVisible = page.data.filter((row) => row.parentCommentId === null && row.hiddenAt === null).map((row) => row.id);
    const [previews, replied, posts] = await Promise.all([
      commentRepository.previewRepliesFor(db, topLevelVisible, previewRepliesPerComment),
      myPostCommentsRepository.parentsRepliedBy(db, query.ownerId, page.data.map((row) => row.id)),
      myPostCommentsRepository.postSummaries(db, [...new Set(page.data.map((row) => row.postId))]),
    ]);
    const everyRow = [...page.data, ...[...previews.values()].flat()];
    const views = new Map((await buildCommentViews(context, query.ownerId, everyRow, query.ownerId)).map((view) => [view.id, view]));
    const summaries = new Map(posts.map((post): [string, MyPostSummary] => {
      const media = post.media[0];
      return [post.id, { id: post.id, kind: post.kind, text: post.text.slice(0, postExcerptLength), thumbnailUrl: media?.posterUrl ?? (media?.type === "image" ? (media.url ?? null) : null) }];
    }));
    const data = page.data.flatMap((row): MyPostCommentItem[] => {
      const view = views.get(row.id);
      const post = summaries.get(row.postId);
      if (view === undefined || post === undefined) return [];
      const hidden = row.hiddenAt !== null;
      return [{
        ...view,
        previewReplies: (previews.get(row.id) ?? []).flatMap((reply) => views.get(reply.id) ?? []),
        post,
        hidden,
        hiddenAt: row.hiddenAt?.toISOString() ?? null,
        needsReply: !hidden && row.parentCommentId === null && row.authorId !== query.ownerId && !replied.has(row.id),
      }];
    });
    return { data, nextCursor: page.nextCursor };
  };
}

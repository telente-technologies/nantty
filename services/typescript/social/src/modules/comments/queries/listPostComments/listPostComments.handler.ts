import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { Page } from "../../../../types/pagination.type.js";
import { buildPageFromOverfetchedRows } from "../../../../utils/cursor.util.js";
import { loadPostVisibleToViewer } from "../../../posts/services/postAccess.service.js";
import type { CommentWithReplies } from "../../models/comment.model.js";
import { commentRepository } from "../../repositories/comment.repository.js";
import { buildCommentViews } from "../../services/commentView.service.js";
import type { ListPostCommentsQuery } from "./listPostComments.query.js";

const previewRepliesPerComment = 2;

export function createListPostCommentsHandler(context: HandlerContext): Handler<ListPostCommentsQuery, Page<CommentWithReplies>> {
  return async ({ viewerId, postId, cursor, limit }) => {
    const post = await loadPostVisibleToViewer(context, viewerId, postId);
    const db = context.database.client;
    const page = buildPageFromOverfetchedRows(await commentRepository.pageTopLevel(db, postId, limit, cursor), limit);
    const previews = await commentRepository.previewRepliesFor(db, page.data.map((row) => row.id), previewRepliesPerComment);
    const everyRow = [...page.data, ...[...previews.values()].flat()];
    const views = new Map((await buildCommentViews(context, viewerId, everyRow, post.authorId)).map((view) => [view.id, view]));
    const data = page.data.flatMap((row) => {
      const view = views.get(row.id);
      if (view === undefined) return [];
      const previewReplies = (previews.get(row.id) ?? []).flatMap((reply) => views.get(reply.id) ?? []);
      return [{ ...view, previewReplies }];
    });
    return { data, nextCursor: page.nextCursor };
  };
}

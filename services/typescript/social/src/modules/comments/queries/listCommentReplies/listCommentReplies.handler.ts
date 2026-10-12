import { notFound } from "../../../../errors/social.error.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { Page } from "../../../../types/pagination.type.js";
import { buildPageFromOverfetchedRows } from "../../../../utils/cursor.util.js";
import { loadPostVisibleToViewer } from "../../../posts/services/postAccess.service.js";
import { assertViewerMayReadConversation } from "../../../posts/services/postSubscriberAccess.service.js";
import type { CommentView } from "../../models/comment.model.js";
import { commentRepository } from "../../repositories/comment.repository.js";
import { buildCommentViews } from "../../services/commentView.service.js";
import { findCommentVisibleToViewer } from "../../services/commentVisibility.service.js";
import type { ListCommentRepliesQuery } from "./listCommentReplies.query.js";

export function createListCommentRepliesHandler(context: HandlerContext): Handler<ListCommentRepliesQuery, Page<CommentView>> {
  return async ({ viewerId, commentId, cursor, limit }) => {
    const db = context.database.client;
    const parent = await findCommentVisibleToViewer(db, commentId, viewerId);
    if (parent === null) throw notFound("COMMENT_NOT_FOUND", "Comment not found.");
    const post = await loadPostVisibleToViewer(context, viewerId, parent.postId);
    await assertViewerMayReadConversation(context, viewerId, post);
    const page = buildPageFromOverfetchedRows(await commentRepository.pageReplies(db, commentId, viewerId, limit, cursor), limit);
    return { data: await buildCommentViews(context, viewerId, page.data, post.authorId), nextCursor: page.nextCursor };
  };
}

import { notFound } from "../../../../errors/social.error.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { loadPostVisibleToViewer } from "../../../posts/services/postAccess.service.js";
import type { CommentView } from "../../models/comment.model.js";
import { buildCommentViews } from "../../services/commentView.service.js";
import { findCommentVisibleToViewer } from "../../services/commentVisibility.service.js";
import type { GetCommentQuery } from "./getComment.query.js";

export function createGetCommentHandler(context: HandlerContext): Handler<GetCommentQuery, CommentView> {
  return async ({ viewerId, commentId }) => {
    const comment = await findCommentVisibleToViewer(context.database.client, commentId, viewerId);
    if (comment === null) throw notFound("COMMENT_NOT_FOUND", "Comment not found");
    const post = await loadPostVisibleToViewer(context, viewerId, comment.postId);
    const [view] = await buildCommentViews(context, viewerId, [comment], post.authorId);
    return view as CommentView;
  };
}

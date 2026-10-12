import { maximumVisibleThreadDepth } from "../../../../constants/social.constant.js";
import { notFound } from "../../../../errors/social.error.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { buildPageFromOverfetchedRows } from "../../../../utils/cursor.util.js";
import { loadPostVisibleToViewer } from "../../../posts/services/postAccess.service.js";
import { assertViewerMayReadConversation } from "../../../posts/services/postSubscriberAccess.service.js";
import type { CommentThreadPage, CommentView } from "../../models/comment.model.js";
import { commentRepository } from "../../repositories/comment.repository.js";
import { commentThreadRepository } from "../../repositories/commentThread.repository.js";
import { assembleThreadTree } from "../../services/commentThread.service.js";
import { buildCommentViews } from "../../services/commentView.service.js";
import { findCommentVisibleToViewer } from "../../services/commentVisibility.service.js";
import { flattenThreadNodeSources, toThreadReplyViews } from "../../services/threadReplyView.service.js";
import type { GetCommentThreadQuery } from "./getCommentThread.query.js";

export function createGetCommentThreadHandler(context: HandlerContext): Handler<GetCommentThreadQuery, CommentThreadPage> {
  return async ({ viewerId, commentId, cursor, limit }) => {
    const db = context.database.client;
    const focus = await findCommentVisibleToViewer(db, commentId, viewerId);
    if (focus === null) throw notFound("COMMENT_NOT_FOUND", "Comment not found.");
    const post = await loadPostVisibleToViewer(context, viewerId, focus.postId);
    await assertViewerMayReadConversation(context, viewerId, post);
    const page = buildPageFromOverfetchedRows(await commentRepository.pageReplies(db, focus.id, viewerId, limit, cursor), limit);
    const [descendants, ancestors] = await Promise.all([
      commentThreadRepository.descendantsWithinDepth(db, viewerId, focus, page.data, focus.depth + maximumVisibleThreadDepth),
      commentThreadRepository.ancestors(db, viewerId, focus),
    ]);
    const tree = assembleThreadTree(page.data, descendants, { baseDepth: focus.depth, maximumRelativeDepth: maximumVisibleThreadDepth });
    const views = new Map((await buildCommentViews(context, viewerId, [focus, ...ancestors, ...flattenThreadNodeSources(tree)], post.authorId)).map((view) => [view.id, view]));
    return {
      data: toThreadReplyViews(tree, views, post.authorId, true),
      nextCursor: page.nextCursor,
      focus: views.get(focus.id) as CommentView,
      ancestors: ancestors.flatMap((row) => views.get(row.id) ?? []),
      maximumVisibleDepth: maximumVisibleThreadDepth,
    };
  };
}

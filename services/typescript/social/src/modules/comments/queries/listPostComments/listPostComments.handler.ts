import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { Page } from "../../../../types/pagination.type.js";
import { loadPostVisibleToViewer } from "../../../posts/services/postAccess.service.js";
import { assertViewerMayReadConversation } from "../../../posts/services/postSubscriberAccess.service.js";
import type { CommentWithReplies } from "../../models/comment.model.js";
import { buildCommentViews } from "../../services/commentView.service.js";
import { loadPreviewChains, loadRankedRootsPage } from "../../services/rankedConversation.service.js";
import type { ListPostCommentsQuery } from "./listPostComments.query.js";

export function createListPostCommentsHandler(context: HandlerContext): Handler<ListPostCommentsQuery, Page<CommentWithReplies>> {
  return async ({ viewerId, postId, cursor, limit }) => {
    const post = await loadPostVisibleToViewer(context, viewerId, postId);
    await assertViewerMayReadConversation(context, viewerId, post);
    const page = await loadRankedRootsPage(context, viewerId, post, cursor, limit);
    const chains = await loadPreviewChains(context, viewerId, post.authorId, page.roots);
    const everyRow = [...page.roots, ...[...chains.values()].flat()];
    const views = new Map((await buildCommentViews(context, viewerId, everyRow, post.authorId)).map((view) => [view.id, view]));
    const data = page.roots.flatMap((row) => {
      const view = views.get(row.id);
      if (view === undefined) return [];
      const previewReplies = (chains.get(row.id) ?? []).flatMap((reply) => views.get(reply.id) ?? []);
      return [{ ...view, previewReplies }];
    });
    return { data, nextCursor: page.nextCursor };
  };
}

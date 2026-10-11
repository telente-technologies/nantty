import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { Page } from "../../../../types/pagination.type.js";
import { loadPostVisibleToViewer } from "../../../posts/services/postAccess.service.js";
import { assertViewerMayReadConversation } from "../../../posts/services/postSubscriberAccess.service.js";
import type { QuoteThreadItem, RankedCommentItem } from "../../models/comment.model.js";
import { buildCommentViews } from "../../services/commentView.service.js";
import { pageQuotesOnly } from "../../services/conversationQuotes.service.js";
import { loadPreviewChains, loadRankedRootsPage } from "../../services/rankedConversation.service.js";
import type { ListPostCommentsQuery } from "./listPostComments.query.js";

export type PostCommentsItem = RankedCommentItem | QuoteThreadItem;

export function createListPostCommentsHandler(context: HandlerContext): Handler<ListPostCommentsQuery, Page<PostCommentsItem>> {
  return async ({ viewerId, postId, filter, cursor, limit }) => {
    const post = await loadPostVisibleToViewer(context, viewerId, postId);
    await assertViewerMayReadConversation(context, viewerId, post);
    if (filter === "quotes") return pageQuotesOnly(context, viewerId, post, cursor, limit);
    const page = await loadRankedRootsPage(context, viewerId, post, cursor, limit);
    const chains = await loadPreviewChains(context, viewerId, post.authorId, page.roots);
    const everyRow = [...page.roots, ...[...chains.values()].flat()];
    const views = new Map((await buildCommentViews(context, viewerId, everyRow, post.authorId)).map((view) => [view.id, view]));
    const data = page.order.flatMap((entry): PostCommentsItem[] => {
      if (entry.type === "quote") return page.quotes.has(entry.id) ? [page.quotes.get(entry.id) as QuoteThreadItem] : [];
      const view = views.get(entry.id);
      if (view === undefined) return [];
      const previewReplies = (chains.get(entry.id) ?? []).flatMap((reply) => views.get(reply.id) ?? []);
      return [{ type: "comment", ...view, previewReplies }];
    });
    return { data, nextCursor: page.nextCursor };
  };
}

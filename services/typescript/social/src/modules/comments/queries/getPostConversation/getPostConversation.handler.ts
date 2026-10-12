import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { Page } from "../../../../types/pagination.type.js";
import { buildPageFromOverfetchedRows, decodeOffsetCursor, encodeOffsetCursor } from "../../../../utils/cursor.util.js";
import { loadPostVisibleToViewer } from "../../../posts/services/postAccess.service.js";
import { assertViewerMayReadConversation } from "../../../posts/services/postSubscriberAccess.service.js";
import type { QuoteThreadItem, RankedThreadItem, ThreadReplyView } from "../../models/comment.model.js";
import type { CommentRow } from "../../repositories/comment.repository.js";
import { commentThreadRepository } from "../../repositories/commentThread.repository.js";
import { assembleThreadTree } from "../../services/commentThread.service.js";
import { buildCommentViews } from "../../services/commentView.service.js";
import { pageQuotesOnly } from "../../services/conversationQuotes.service.js";
import { flattenThreadNodeSources, toThreadReplyViews } from "../../services/threadReplyView.service.js";
import { loadPreviewChains, loadRankedRootsPage } from "../../services/rankedConversation.service.js";
import { maximumPreviewChainLength } from "../../services/commentChain.service.js";
import type { GetPostConversationQuery } from "./getPostConversation.query.js";

const inlinePreviewDepth = 2;

export const preferAuthorReply = (postAuthorId: string) => (children: readonly CommentRow[]): readonly CommentRow[] => {
  const preferred = children.find((child) => child.authorId === postAuthorId) ?? children[0];
  return preferred === undefined ? [] : [preferred];
};

export type ConversationItem = RankedThreadItem | QuoteThreadItem;

const asComments = (views: readonly ThreadReplyView[]): RankedThreadItem[] => views.map((view) => ({ type: "comment", ...view }));

export function createGetPostConversationHandler(context: HandlerContext): Handler<GetPostConversationQuery, Page<ConversationItem>> {
  return async ({ viewerId, postId, sort, filter, cursor, limit }) => {
    const db = context.database.client;
    const post = await loadPostVisibleToViewer(context, viewerId, postId);
    await assertViewerMayReadConversation(context, viewerId, post);
    if (filter === "quotes") return pageQuotesOnly(context, viewerId, post, cursor, limit);
    const normalizedSort = sort === "top" ? "relevant" : sort;
    if (normalizedSort === "relevant") {
      const ranked = await loadRankedRootsPage(context, viewerId, post, cursor, limit);
      const chains = await loadPreviewChains(context, viewerId, post.authorId, ranked.roots);
      const chainIds = new Set([...chains.values()].flat().map((row) => row.id));
      const rankedTree = assembleThreadTree(ranked.roots, [...chains.values()].flat(), { baseDepth: 0, maximumRelativeDepth: maximumPreviewChainLength, chooseChildren: (children) => children.filter((child) => chainIds.has(child.id)) });
      const rankedViews = new Map((await buildCommentViews(context, viewerId, flattenThreadNodeSources(rankedTree), post.authorId)).map((view) => [view.id, view]));
      const commentItems = new Map(asComments(toThreadReplyViews(rankedTree, rankedViews, post.authorId, false)).map((item) => [item.id, item]));
      const data = ranked.order.flatMap((entry): ConversationItem[] => {
        const item = entry.type === "quote" ? ranked.quotes.get(entry.id) : commentItems.get(entry.id);
        return item === undefined ? [] : [item];
      });
      return { data, nextCursor: ranked.nextCursor };
    }
    const offset = normalizedSort === "latest" ? 0 : decodeOffsetCursor(cursor);
    const rows = await commentThreadRepository.pageConversationRoots(db, postId, viewerId, normalizedSort, limit, offset, normalizedSort === "latest" ? cursor : undefined);
    const page = buildPageFromOverfetchedRows(rows, limit);
    const descendants = await commentThreadRepository.previewDescendants(db, viewerId, page.data, inlinePreviewDepth);
    const tree = assembleThreadTree(page.data, descendants, { baseDepth: 0, maximumRelativeDepth: inlinePreviewDepth, chooseChildren: preferAuthorReply(post.authorId) });
    const views = new Map((await buildCommentViews(context, viewerId, flattenThreadNodeSources(tree), post.authorId)).map((view) => [view.id, view]));
    const nextCursor = page.nextCursor === null ? null : normalizedSort === "latest" ? page.nextCursor : encodeOffsetCursor(offset + limit);
    return { data: asComments(toThreadReplyViews(tree, views, post.authorId, false)), nextCursor };
  };
}

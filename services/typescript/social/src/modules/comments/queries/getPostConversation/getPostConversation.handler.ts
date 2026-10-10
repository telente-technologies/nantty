import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { Page } from "../../../../types/pagination.type.js";
import { buildPageFromOverfetchedRows, decodeOffsetCursor, encodeOffsetCursor } from "../../../../utils/cursor.util.js";
import { loadPostVisibleToViewer } from "../../../posts/services/postAccess.service.js";
import { assertViewerMayReadConversation } from "../../../posts/services/postSubscriberAccess.service.js";
import type { ThreadReplyView } from "../../models/comment.model.js";
import type { CommentRow } from "../../repositories/comment.repository.js";
import { commentThreadRepository } from "../../repositories/commentThread.repository.js";
import { assembleThreadTree } from "../../services/commentThread.service.js";
import { buildCommentViews } from "../../services/commentView.service.js";
import { flattenThreadNodeSources, toThreadReplyViews } from "../../services/threadReplyView.service.js";
import { loadPreviewChains, loadRankedRootsPage } from "../../services/rankedConversation.service.js";
import { maximumPreviewChainLength } from "../../services/commentChain.service.js";
import type { GetPostConversationQuery } from "./getPostConversation.query.js";

const inlinePreviewDepth = 2;

export const preferAuthorReply = (postAuthorId: string) => (children: readonly CommentRow[]): readonly CommentRow[] => {
  const preferred = children.find((child) => child.authorId === postAuthorId) ?? children[0];
  return preferred === undefined ? [] : [preferred];
};

export function createGetPostConversationHandler(context: HandlerContext): Handler<GetPostConversationQuery, Page<ThreadReplyView>> {
  return async ({ viewerId, postId, sort, cursor, limit }) => {
    const db = context.database.client;
    const post = await loadPostVisibleToViewer(context, viewerId, postId);
    await assertViewerMayReadConversation(context, viewerId, post);
    const normalizedSort = sort === "top" ? "relevant" : sort;
    if (normalizedSort === "relevant") {
      const ranked = await loadRankedRootsPage(context, viewerId, post, cursor, limit);
      const chains = await loadPreviewChains(context, viewerId, post.authorId, ranked.roots);
      const chainIds = new Set([...chains.values()].flat().map((row) => row.id));
      const rankedTree = assembleThreadTree(ranked.roots, [...chains.values()].flat(), { baseDepth: 0, maximumRelativeDepth: maximumPreviewChainLength, chooseChildren: (children) => children.filter((child) => chainIds.has(child.id)) });
      const rankedViews = new Map((await buildCommentViews(context, viewerId, flattenThreadNodeSources(rankedTree), post.authorId)).map((view) => [view.id, view]));
      return { data: toThreadReplyViews(rankedTree, rankedViews, post.authorId, false), nextCursor: ranked.nextCursor };
    }
    const offset = normalizedSort === "latest" ? 0 : decodeOffsetCursor(cursor);
    const rows = await commentThreadRepository.pageConversationRoots(db, postId, normalizedSort, limit, offset, normalizedSort === "latest" ? cursor : undefined);
    const page = buildPageFromOverfetchedRows(rows, limit);
    const descendants = await commentThreadRepository.previewDescendants(db, page.data, inlinePreviewDepth);
    const tree = assembleThreadTree(page.data, descendants, { baseDepth: 0, maximumRelativeDepth: inlinePreviewDepth, chooseChildren: preferAuthorReply(post.authorId) });
    const views = new Map((await buildCommentViews(context, viewerId, flattenThreadNodeSources(tree), post.authorId)).map((view) => [view.id, view]));
    const nextCursor = page.nextCursor === null ? null : normalizedSort === "latest" ? page.nextCursor : encodeOffsetCursor(offset + limit);
    return { data: toThreadReplyViews(tree, views, post.authorId, false), nextCursor };
  };
}

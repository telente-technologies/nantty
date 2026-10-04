import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { Page } from "../../../../types/pagination.type.js";
import { buildPageFromOverfetchedRows } from "../../../../utils/cursor.util.js";
import { followRepository } from "../../../follows/repositories/follow.repository.js";
import { filterAuthorsVisibleToViewer } from "../../../follows/services/profileAccess.service.js";
import type { PostView } from "../../models/post.model.js";
import { postRepository } from "../../repositories/post.repository.js";
import { loadPostVisibleToViewer } from "../../services/postAccess.service.js";
import { buildPostViews } from "../../services/postView.service.js";
import { selectQuotesVisibleToViewer } from "../../services/quoteVisibility.service.js";
import { resolveCurrentViewerContentPolicy, sensitiveLabelFilterForViewer } from "../../services/sensitiveContent.service.js";
import type { ListPostQuotesQuery } from "./listPostQuotes.query.js";

export function createListPostQuotesHandler(context: HandlerContext): Handler<ListPostQuotesQuery, Page<PostView>> {
  return async ({ viewerId, postId, cursor, limit }) => {
    await loadPostVisibleToViewer(context, viewerId, postId);
    const db = context.database.client;
    const policy = await resolveCurrentViewerContentPolicy(context, viewerId);
    const page = buildPageFromOverfetchedRows(await postRepository.pageQuotesOf(db, postId, limit, cursor, sensitiveLabelFilterForViewer(policy)), limit);
    const authorIds = [...new Set(page.data.map((row) => row.authorId))];
    const [visibleAuthors, followedAuthors] = await Promise.all([
      filterAuthorsVisibleToViewer(context, viewerId, authorIds),
      viewerId === undefined ? new Set<string>() : followRepository.followedAccountIds(db, viewerId, authorIds),
    ]);
    const visible = selectQuotesVisibleToViewer(page.data, { viewerId, visibleAuthors, followedAuthors, withheldLabels: policy.withheldLabels });
    return { data: await buildPostViews(context, viewerId, visible, policy), nextCursor: page.nextCursor };
  };
}

import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { Page } from "../../../../types/pagination.type.js";
import { buildPageFromOverfetchedRows } from "../../../../utils/cursor.util.js";
import { blockRepository } from "../../../blocks/repositories/block.repository.js";
import { followRepository } from "../../../follows/repositories/follow.repository.js";
import type { PostView } from "../../../posts/models/post.model.js";
import { buildPostViews } from "../../../posts/services/postView.service.js";
import { feedRepository } from "../../repositories/feed.repository.js";
import type { GetFollowingFeedQuery } from "./getFollowingFeed.query.js";

export function createGetFollowingFeedHandler(context: HandlerContext): Handler<GetFollowingFeedQuery, Page<PostView>> {
  return async ({ viewerId, kinds, cursor, limit }) => {
    const db = context.database.client;
    const [followed, hidden] = await Promise.all([followRepository.allFollowedAccountIds(db, viewerId), blockRepository.everyoneBlockedByOrBlocking(db, viewerId)]);
    const authorIds = [viewerId, ...followed.filter((accountId) => !hidden.has(accountId))];
    const page = buildPageFromOverfetchedRows(await feedRepository.pageFollowing(db, authorIds, kinds, limit, cursor), limit);
    return { data: await buildPostViews(context, viewerId, page.data), nextCursor: page.nextCursor };
  };
}

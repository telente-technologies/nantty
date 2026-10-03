import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { Page } from "../../../../types/pagination.type.js";
import type { PostView } from "../../../posts/models/post.model.js";
import { createGetFollowingFeedHandler } from "../getFollowingFeed/getFollowingFeed.handler.js";
import { buildRankedFeedPage } from "../../services/rankedFeed.service.js";
import type { ListClipsQuery } from "./listClips.query.js";

export function createListClipsHandler(context: HandlerContext): Handler<ListClipsQuery, Page<PostView>> {
  const followingFeed = createGetFollowingFeedHandler(context);
  return async ({ viewerId, tab, cursor, limit }) => {
    if (tab === "following" && viewerId !== undefined) return followingFeed({ viewerId, kinds: ["clip"], cursor, limit });
    const personalized = viewerId !== undefined && (await context.directory.hasPersonalizationConsent(viewerId));
    return buildRankedFeedPage(context, { viewerId, personalized, kinds: ["clip"], cursor, limit });
  };
}

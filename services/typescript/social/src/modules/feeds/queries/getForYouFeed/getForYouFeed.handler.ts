import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { Page } from "../../../../types/pagination.type.js";
import type { PostView } from "../../../posts/models/post.model.js";
import { buildRankedFeedPage } from "../../services/rankedFeed.service.js";
import type { GetForYouFeedQuery } from "./getForYouFeed.query.js";

export function createGetForYouFeedHandler(context: HandlerContext): Handler<GetForYouFeedQuery, Page<PostView>> {
  return async (query) => {
    const personalized = query.viewerId !== undefined && (await context.directory.hasPersonalizationConsent(query.viewerId));
    return buildRankedFeedPage(context, { ...query, personalized, kinds: ["post", "clip"] });
  };
}

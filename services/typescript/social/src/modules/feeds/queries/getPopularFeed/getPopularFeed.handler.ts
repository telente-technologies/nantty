import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { Page } from "../../../../types/pagination.type.js";
import type { PostView } from "../../../posts/models/post.model.js";
import { buildRankedFeedPage } from "../../services/rankedFeed.service.js";
import type { GetPopularFeedQuery } from "./getPopularFeed.query.js";

export function createGetPopularFeedHandler(context: HandlerContext): Handler<GetPopularFeedQuery, Page<PostView>> {
  return (query) => buildRankedFeedPage(context, { ...query, personalized: false, kinds: ["post", "clip"] });
}

import type { HttpRouter } from "@zudojs/http";

import type { HandlerContext } from "../../types/handlerContext.type.js";
import type { RouteFactory } from "../../utils/route.util.js";
import { createRecordFeedInteractionHandler } from "./commands/recordFeedInteraction/recordFeedInteraction.handler.js";
import { createRecordFeedFeedbackHandler } from "./commands/recordFeedFeedback/recordFeedFeedback.handler.js";
import { createFeedsController } from "./controllers/feeds.controller.js";
import { createGetFollowingFeedHandler } from "./queries/getFollowingFeed/getFollowingFeed.handler.js";
import { createGetForYouFeedHandler } from "./queries/getForYouFeed/getForYouFeed.handler.js";
import { createGetPopularFeedHandler } from "./queries/getPopularFeed/getPopularFeed.handler.js";
import { createListClipsHandler } from "./queries/listClips/listClips.handler.js";
import { registerFeedsRoutes } from "./routes/feeds.routes.js";

export function mountFeedsModule(router: HttpRouter, route: RouteFactory, context: HandlerContext): void {
  registerFeedsRoutes(router, createFeedsController(route, {
    getForYouFeed: createGetForYouFeedHandler(context),
    getFollowingFeed: createGetFollowingFeedHandler(context),
    getPopularFeed: createGetPopularFeedHandler(context),
    listClips: createListClipsHandler(context),
    recordFeedFeedback: createRecordFeedFeedbackHandler(context),
    recordFeedInteraction: createRecordFeedInteractionHandler(context),
  }));
}

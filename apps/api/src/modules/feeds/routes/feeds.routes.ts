import type { HttpRouter } from "@zudojs/http";

import type { WebKit } from "../../../loaders/web.loader.js";
import { describeRoute } from "../../../utils/openapi.util.js";
import type { FeedsController } from "../controllers/feeds.controller.js";
import { FeedInteractionBodySchema, FeedQuerySchema } from "../validators/feeds.validator.js";

const BASE_PATH = "/api/v1/feeds";

export function registerFeedsRoutes(router: HttpRouter, controller: FeedsController, web: WebKit): void {
  const feedRead = web.guard.requirePermission("feed:read");
  const query = { query: FeedQuerySchema };
  router.get(`${BASE_PATH}/for-you`, controller.forYou, { ...feedRead, ...describeRoute("feeds", "Ranked For You feed (optional topic chip)", query) });
  router.get(`${BASE_PATH}/following`, controller.following, { ...feedRead, ...describeRoute("feeds", "Posts from people and stores I follow", query) });
  router.get(`${BASE_PATH}/clips`, controller.clips, { ...feedRead, ...describeRoute("feeds", "Suggested clips", query) });
  router.post(`${BASE_PATH}/interactions`, controller.recordInteraction, { ...feedRead, ...describeRoute("feeds", "Record a feed interaction", { body: FeedInteractionBodySchema }) });
}

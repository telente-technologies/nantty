import type { HttpRouter } from "@zudojs/http";

import type { WebKit } from "../../../loaders/web.loader.js";
import { describeRoute } from "../../../utils/openapi.util.js";
import type { SearchController } from "../controllers/search.controller.js";
import { SearchQuerySchema } from "../validators/search.validator.js";

export function registerSearchRoutes(router: HttpRouter, controller: SearchController, web: WebKit): void {
  router.get("/api/v1/search", controller.search, {
    ...web.guard.allowAnyone(),
    ...describeRoute("search", "Search products, stores and people", { query: SearchQuerySchema }),
  });
}

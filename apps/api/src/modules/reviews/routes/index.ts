import type { HttpRouter } from "@zudojs/http";

import type { AppDependencies } from "../../../container.js";
// zudojs:route-imports:start
import { registerReviewsRoutes } from "./reviews.routes.js";
// zudojs:route-imports:end

export function registerReviewsModuleRoutes(router: HttpRouter, deps: AppDependencies): void {
  // zudojs:routes:start
  registerReviewsRoutes(router, deps.reviewsController, deps.web);
  // zudojs:routes:end
}

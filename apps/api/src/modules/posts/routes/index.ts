import type { HttpRouter } from "@zudojs/http";

import type { AppDependencies } from "../../../container.js";
// zudojs:route-imports:start
import { registerLiveRoutes, registerPostsRoutes, registerStoriesRoutes } from "./posts.routes.js";
// zudojs:route-imports:end

export function registerPostsModuleRoutes(router: HttpRouter, deps: AppDependencies): void {
  // zudojs:routes:start
  registerPostsRoutes(router, deps.postsController, deps.web);
  registerLiveRoutes(router, deps.liveController, deps.web);
  registerStoriesRoutes(router, deps.storiesController, deps.web);
  // zudojs:routes:end
}

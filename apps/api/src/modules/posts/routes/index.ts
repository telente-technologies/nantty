import type { HttpRouter } from "@zudojs/http";

import type { AppDependencies } from "../../../container.js";
// zudojs:route-imports:start
import { registerLiveRoutes, registerPostsRoutes } from "./posts.routes.js";
// zudojs:route-imports:end

export function registerPostsModuleRoutes(router: HttpRouter, deps: AppDependencies): void {
  // zudojs:routes:start
  registerPostsRoutes(router, deps.postsController, deps.web);
  registerLiveRoutes(router, deps.liveController, deps.web);
  // zudojs:routes:end
}

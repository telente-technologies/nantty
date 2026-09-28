import type { HttpRouter } from "@zudojs/http";

import type { AppDependencies } from "../../../container.js";
// zudojs:route-imports:start
import { registerUsersRoutes } from "./users.routes.js";
// zudojs:route-imports:end

export function registerUsersModuleRoutes(router: HttpRouter, deps: AppDependencies): void {
  // zudojs:routes:start
  registerUsersRoutes(router, deps.usersController, deps.web);
  // zudojs:routes:end
}

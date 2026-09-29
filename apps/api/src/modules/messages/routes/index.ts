import type { HttpRouter } from "@zudojs/http";

import type { AppDependencies } from "../../../container.js";
// zudojs:route-imports:start
import { registerMessagesRoutes } from "./messages.routes.js";
// zudojs:route-imports:end

export function registerMessagesModuleRoutes(router: HttpRouter, deps: AppDependencies): void {
  // zudojs:routes:start
  registerMessagesRoutes(router, deps.messagesController, deps.web);
  // zudojs:routes:end
}

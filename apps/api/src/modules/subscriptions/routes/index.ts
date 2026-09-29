import type { HttpRouter } from "@zudojs/http";

import type { AppDependencies } from "../../../container.js";
// zudojs:route-imports:start
import { registerSubscriptionsRoutes } from "./subscriptions.routes.js";
// zudojs:route-imports:end

export function registerSubscriptionsModuleRoutes(router: HttpRouter, deps: AppDependencies): void {
  // zudojs:routes:start
  registerSubscriptionsRoutes(router, { subscriptions: deps.subscriptionsController, seller: deps.sellerSubscriptionsController, plansAdmin: deps.subscriptionPlansAdminController }, deps.web);
  // zudojs:routes:end
}

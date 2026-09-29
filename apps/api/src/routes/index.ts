import type { HttpRouter } from "@zudojs/http";

import type { AppDependencies } from "../container.js";
import { registerHealthRoutes } from "./health.routes.js";
// zudojs:route-imports:start
import { registerAuthModuleRoutes } from "../modules/auth/routes/index.js";
import { registerUsersModuleRoutes } from "../modules/users/routes/index.js";
import { registerStoresModuleRoutes } from "../modules/stores/routes/index.js";
import { registerCategoriesModuleRoutes } from "../modules/categories/routes/index.js";
import { registerProductsModuleRoutes } from "../modules/products/routes/index.js";
import { registerCartsModuleRoutes } from "../modules/carts/routes/index.js";
import { registerOrdersModuleRoutes } from "../modules/orders/routes/index.js";
import { registerPaymentsModuleRoutes } from "../modules/payments/routes/index.js";
import { registerEscrowsModuleRoutes } from "../modules/escrows/routes/index.js";
import { registerWalletsModuleRoutes } from "../modules/wallets/routes/index.js";
import { registerPostsModuleRoutes } from "../modules/posts/routes/index.js";
import { registerFeedsModuleRoutes } from "../modules/feeds/routes/index.js";
import { registerFollowsModuleRoutes } from "../modules/follows/routes/index.js";
import { registerReviewsModuleRoutes } from "../modules/reviews/routes/index.js";
import { registerNotificationsModuleRoutes } from "../modules/notifications/routes/index.js";
import { registerMessagesModuleRoutes } from "../modules/messages/routes/index.js";
import { registerSearchModuleRoutes } from "../modules/search/routes/index.js";
import { registerMediaModuleRoutes } from "../modules/media/routes/index.js";
import { registerWaitlistModuleRoutes } from "../modules/waitlist/routes/index.js";
import { registerAuditModuleRoutes } from "../modules/audit/routes/index.js";
import { registerCurrencyModuleRoutes } from "../modules/currency/routes/index.js";
import { registerCreatorsModuleRoutes } from "../modules/creators/routes/index.js";
import { registerVerificationsModuleRoutes } from "../modules/verifications/routes/index.js";
import { registerSubscriptionsModuleRoutes } from "../modules/subscriptions/routes/index.js";
import { registerModerationModuleRoutes } from "../modules/moderation/routes/index.js";
import { registerSupportModuleRoutes } from "../modules/support/routes/index.js";
import { registerAutomationModuleRoutes } from "../modules/automation/routes/index.js";
import { registerAdminModuleRoutes } from "../modules/admin/routes/index.js";
import { registerCoinsModuleRoutes } from "../modules/coins/routes/index.js";
import { registerCreatorSubscriptionsModuleRoutes } from "../modules/creatorSubscriptions/routes/index.js";
import { registerLoyaltyModuleRoutes } from "../modules/loyalty/routes/index.js";
// zudojs:route-imports:end

export function registerRoutes(router: HttpRouter, deps: AppDependencies): void {
  registerHealthRoutes(router, deps.health);
  // zudojs:routes:start
  registerAuthModuleRoutes(router, deps);
  registerUsersModuleRoutes(router, deps);
  registerStoresModuleRoutes(router, deps);
  registerCategoriesModuleRoutes(router, deps);
  registerProductsModuleRoutes(router, deps);
  registerCartsModuleRoutes(router, deps);
  registerOrdersModuleRoutes(router, deps);
  registerPaymentsModuleRoutes(router, deps);
  registerEscrowsModuleRoutes(router, deps);
  registerWalletsModuleRoutes(router, deps);
  registerPostsModuleRoutes(router, deps);
  registerFeedsModuleRoutes(router, deps);
  registerFollowsModuleRoutes(router, deps);
  registerReviewsModuleRoutes(router, deps);
  registerNotificationsModuleRoutes(router, deps);
  registerMessagesModuleRoutes(router, deps);
  registerSearchModuleRoutes(router, deps);
  registerMediaModuleRoutes(router, deps);
  registerWaitlistModuleRoutes(router, deps);
  registerAuditModuleRoutes(router, deps);
  registerCurrencyModuleRoutes(router, deps);
  registerCreatorsModuleRoutes(router, deps);
  registerVerificationsModuleRoutes(router, deps);
  registerSubscriptionsModuleRoutes(router, deps);
  registerAdminModuleRoutes(router, deps);
  registerCoinsModuleRoutes(router, deps);
  registerCreatorSubscriptionsModuleRoutes(router, deps);
  registerModerationModuleRoutes(router, deps);
  registerSupportModuleRoutes(router, deps);
  registerAutomationModuleRoutes(router, deps);
  registerLoyaltyModuleRoutes(router, deps);
  // zudojs:routes:end
}

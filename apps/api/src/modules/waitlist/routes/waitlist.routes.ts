import type { HttpRouter } from "@zudojs/http";

import type { WebKit } from "../../../loaders/web.loader.js";
import { PageQuerySchema } from "../../../utils/pagination.util.js";
import { describeRoute } from "../../../utils/openapi.util.js";
import type { WaitlistController } from "../controllers/waitlist.controller.js";
import { JoinWaitlistBodySchema } from "../validators/waitlist.validator.js";

const TAG = "waitlist";

export function registerWaitlistRoutes(router: HttpRouter, controller: WaitlistController, web: WebKit): void {
  const adminOnly = web.guard.requirePermission("waitlist:read");
  router.post("/api/v1/waitlist", controller.join, { ...web.guard.allowAnyone(web.limitSensitiveRequests), ...describeRoute(TAG, "Join the waitlist", { body: JoinWaitlistBodySchema }) });
  router.get("/api/v1/admin/waitlist", controller.list, { ...adminOnly, ...describeRoute(TAG, "List waitlist entries", { query: PageQuerySchema }) });
  router.get("/api/v1/admin/waitlist/count", controller.count, { ...adminOnly, ...describeRoute(TAG, "Count waitlist entries") });
}

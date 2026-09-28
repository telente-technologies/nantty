import type { HttpRouter } from "@zudojs/http";

import type { WebKit } from "../../../loaders/web.loader.js";
import { describeRoute } from "../../../utils/openapi.util.js";
import type { AuditController } from "../controllers/audit.controller.js";
import { AuditEventParamsSchema, ListAuditEventsQuerySchema } from "../validators/audit.validator.js";

const BASE_PATH = "/api/v1/admin/audit-events";

export function registerAuditRoutes(router: HttpRouter, controller: AuditController, web: WebKit): void {
  const adminOnly = web.guard.requirePermission("audit:read");
  router.get(BASE_PATH, controller.list, { ...adminOnly, ...describeRoute("audit", "List audit events", { query: ListAuditEventsQuerySchema }) });
  router.get(`${BASE_PATH}/:id`, controller.get, { ...adminOnly, ...describeRoute("audit", "Get an audit event", { params: AuditEventParamsSchema }) });
}

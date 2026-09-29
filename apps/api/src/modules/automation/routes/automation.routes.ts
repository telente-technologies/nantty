import type { HttpRouter } from "@zudojs/http";

import type { WebKit } from "../../../loaders/web.loader.js";
import { describeRoute } from "../../../utils/openapi.util.js";
import type { AutomationController } from "../controllers/automation.controller.js";
import { CreateRuleBodySchema, ListExecutionsQuerySchema, RuleParamsSchema, UpdateRuleBodySchema } from "../validators/automation.validator.js";

const TAG = "automation";
const RULES = "/api/v1/admin/automation/rules";

export function registerAutomationRoutes(router: HttpRouter, controller: AutomationController, web: WebKit): void {
  const manager = web.guard.requirePermission("automation:manage");
  const byId = { params: RuleParamsSchema };
  router.get("/api/v1/admin/automation/catalog", controller.describeCatalog, { ...manager, ...describeRoute(TAG, "Triggers, operators and actions rules can use") });
  router.get(RULES, controller.listRules, { ...manager, ...describeRoute(TAG, "List automation rules") });
  router.post(RULES, controller.createRule, { ...manager, ...describeRoute(TAG, "Create an automation rule", { body: CreateRuleBodySchema }) });
  router.get(`${RULES}/:id`, controller.getRule, { ...manager, ...describeRoute(TAG, "Get an automation rule", byId) });
  router.patch(`${RULES}/:id`, controller.updateRule, { ...manager, ...describeRoute(TAG, "Update an automation rule", { ...byId, body: UpdateRuleBodySchema }) });
  router.delete(`${RULES}/:id`, controller.deleteRule, { ...manager, ...describeRoute(TAG, "Delete an automation rule", byId) });
  router.get(`${RULES}/:id/executions`, controller.listExecutions, { ...manager, ...describeRoute(TAG, "Execution log for a rule", { ...byId, query: ListExecutionsQuerySchema }) });
}

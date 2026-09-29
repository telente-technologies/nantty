import type { HttpRouter } from "@zudojs/http";

import type { WebKit } from "../../../loaders/web.loader.js";
import { describeRoute } from "../../../utils/openapi.util.js";
import type { ModerationController } from "../controllers/moderation.controller.js";
import {
  IdParamsSchema,
  ListAppealsQuerySchema,
  ListCasesQuerySchema,
  ResolveAppealBodySchema,
  SubmitAppealBodySchema,
  SubmitReportBodySchema,
  TakeActionBodySchema,
} from "../validators/moderation.validator.js";

const TAG = "moderation";
const ADMIN = "/api/v1/admin/moderation";

export function registerModerationRoutes(router: HttpRouter, controller: ModerationController, web: WebKit): void {
  const reporter = web.guard.requirePermission("reports:create", web.limitSensitiveRequests);
  const reviewer = web.guard.requirePermission("moderation:review");
  const appealsReviewer = web.guard.requirePermission("moderation:appeals");
  const byId = { params: IdParamsSchema };
  router.post("/api/v1/reports", controller.submitReport, { ...reporter, ...describeRoute(TAG, "Report a post, comment, user, product, live or message", { body: SubmitReportBodySchema }) });
  router.get("/api/v1/reports/me", controller.listMyReports, { ...web.guard.requirePermission("reports:create"), ...describeRoute(TAG, "List my reports and their outcomes") });
  router.get("/api/v1/moderation/decisions/me", controller.listMyDecisions, { ...web.guard.requireSignedInUser(), ...describeRoute(TAG, "List moderation decisions that affect me") });
  router.post("/api/v1/moderation/decisions/:id/appeals", controller.submitAppeal, {
    ...web.guard.requireSignedInUser(),
    ...describeRoute(TAG, "Appeal a moderation decision (affected user only)", { ...byId, body: SubmitAppealBodySchema }),
  });
  router.get(`${ADMIN}/cases`, controller.listCases, { ...reviewer, ...describeRoute(TAG, "Moderation queue", { query: ListCasesQuerySchema }) });
  router.get(`${ADMIN}/cases/:id`, controller.getCase, { ...reviewer, ...describeRoute(TAG, "Moderation case with reports and decisions", byId) });
  router.post(`${ADMIN}/cases/:id/actions`, controller.takeAction, {
    ...reviewer,
    ...describeRoute(TAG, "Hide, remove, warn, suspend, revoke verification or dismiss", { ...byId, body: TakeActionBodySchema }),
  });
  router.get(`${ADMIN}/appeals`, controller.listAppeals, { ...appealsReviewer, ...describeRoute(TAG, "Appeals queue", { query: ListAppealsQuerySchema }) });
  router.post(`${ADMIN}/appeals/:id/decision`, controller.resolveAppeal, {
    ...appealsReviewer,
    ...describeRoute(TAG, "Uphold or overturn an appeal", { ...byId, body: ResolveAppealBodySchema }),
  });
}

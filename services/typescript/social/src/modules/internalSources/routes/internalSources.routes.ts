import type { HttpRouter } from "@nantty/fastify-platform";

import type { createInternalSourcesController } from "../controllers/internalSources.controller.js";

export function registerInternalSourcesRoutes(router: HttpRouter, controller: ReturnType<typeof createInternalSourcesController>): void {
  router.get("/api/v1/internal/search-sources/:collection/:id", controller.searchSource);
  router.get("/api/v1/internal/moderation/targets/:type/:id", controller.moderationTarget);
  router.get("/api/v1/internal/moderation/conversations/:conversationId/reportability", controller.chatReportability);
  router.get("/api/v1/internal/ad-sources/content", controller.adContentSources);
  router.get("/api/v1/internal/audience-sources/accounts/:accountId/followers", controller.followers);
  router.get("/api/v1/internal/audience-sources/accounts/:accountId/engagers", controller.engagers);
  router.get("/api/v1/internal/save-counts", controller.saveCounts);
  router.get("/api/v1/internal/ownership/:kind/:id", controller.ownership);
  router.get("/api/v1/internal/accounts/:accountId/activity-counts", controller.activityCounts);
}

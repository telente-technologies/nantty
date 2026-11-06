import type { Container } from "../../../container.js";
import type { RouteDefinition } from "../../../types/route.type.js";
import { AdminEmailController } from "../controllers/adminEmail.controller.js";
import { LegalNoticeController } from "../controllers/legalNotice.controller.js";

export function createBulkCampaignRoutes(container: Container): readonly RouteDefinition[] {
  const email = new AdminEmailController(container);
  const legal = new LegalNoticeController(container);
  return [
    { method: "GET", path: "/api/v1/admin/support/email/templates", handler: email.listTemplates },
    { method: "GET", path: "/api/v1/admin/support/email/segments", handler: email.listSegments },
    { method: "GET", path: "/api/v1/admin/support/email/sends", handler: email.listSends },
    { method: "GET", path: "/api/v1/admin/support/email/deliveries/failed", handler: email.listFailedDeliveries },
    { method: "GET", path: "/api/v1/admin/support/notifications/push/deliveries/failed", handler: email.listFailedPushDeliveries },
    { method: "POST", path: "/api/v1/admin/support/email/preview", handler: email.preview },
    { method: "POST", path: "/api/v1/admin/support/email/send", handler: email.send },
    { method: "GET", path: "/api/v1/admin/legal/versions/:versionId/notice-draft", handler: legal.getDraft },
    { method: "PUT", path: "/api/v1/admin/legal/versions/:versionId/notice-draft", handler: legal.updateDraft },
    { method: "POST", path: "/api/v1/admin/legal/versions/:versionId/notice-draft/test-send", handler: legal.testSend },
    { method: "GET", path: "/api/v1/admin/legal/versions/:versionId/notice-preview", handler: legal.preview },
    { method: "GET", path: "/api/v1/admin/legal/notices", handler: legal.listNotices },
    { method: "GET", path: "/api/v1/admin/legal/notices/:noticeId", handler: legal.getNotice },
    { method: "POST", path: "/api/v1/admin/legal/notices", handler: legal.queueNotice },
  ];
}

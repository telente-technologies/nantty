import type { HttpRouter } from "@zudojs/http";

import type { createStoreInboxController } from "../controllers/storeInbox.controller.js";

export function registerStoreInboxRoutes(router: HttpRouter, controller: ReturnType<typeof createStoreInboxController>): void {
  const base = "/api/v1/internal/stores/:storeId/conversations";
  router.get(base, controller.list);
  router.post(`${base}/open`, controller.open);
  router.get(`${base}/:conversationId`, controller.get);
  router.post(`${base}/:conversationId/messages`, controller.reply);
  router.post(`${base}/:conversationId/read`, controller.read);
  router.post("/api/v1/conversations/stores/:storeId/messages", controller.buyerSend);
}

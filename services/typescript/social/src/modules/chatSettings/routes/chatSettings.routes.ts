import type { HttpRouter } from "@zudojs/http";

import type { createChatSettingsController } from "../controllers/chatSettings.controller.js";

export function registerChatSettingsRoutes(router: HttpRouter, controller: ReturnType<typeof createChatSettingsController>): void {
  router.get("/api/v1/chat/settings", controller.get);
  router.patch("/api/v1/chat/settings", controller.update);
}

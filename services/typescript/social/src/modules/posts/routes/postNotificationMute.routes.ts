import type { HttpRouter } from "@zudojs/http";

import type { createPostNotificationMuteController } from "../controllers/postNotificationMute.controller.js";

export function registerPostNotificationMuteRoutes(router: HttpRouter, controller: ReturnType<typeof createPostNotificationMuteController>): void {
  router.get("/api/v1/posts/:postId/notifications-mute", controller.getMute);
  router.put("/api/v1/posts/:postId/notifications-mute", controller.mute);
  router.delete("/api/v1/posts/:postId/notifications-mute", controller.unmute);
}

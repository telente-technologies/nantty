import type { HttpRouter } from "@nantty/fastify-platform";

import type { createPostNotificationsController } from "../controllers/postNotifications.controller.js";

export function registerPostNotificationsRoutes(router: HttpRouter, controller: ReturnType<typeof createPostNotificationsController>): void {
  router.get("/api/v1/users/:userId/post-notifications", controller.get);
  router.put("/api/v1/users/:userId/post-notifications", controller.set);
  router.get("/api/v1/internal/post-notification-subscribers/:accountId", controller.subscribers);
}

import type { HttpRouter } from "@nantty/fastify-platform";

import type { createStreaksController } from "../controllers/streaks.controller.js";

export function registerStreaksRoutes(router: HttpRouter, controller: ReturnType<typeof createStreaksController>): void {
  router.post("/api/v1/conversations/:conversationId/streak/restore", controller.restore);
  router.post("/api/v1/conversations/:conversationId/streak/celebrated", controller.celebrated);
}

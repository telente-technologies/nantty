import type { HttpRouter } from "@nantty/fastify-platform";

import type { createMentionsController } from "../controllers/mentions.controller.js";

export function registerMentionsRoutes(router: HttpRouter, controller: ReturnType<typeof createMentionsController>): void {
  router.get("/api/v1/mentions/candidates", controller.candidates);
  router.post("/api/v1/mentions/resolve", controller.resolve);
}

import type { HttpRouter } from "@nantty/fastify-platform";

import type { createChannelsController } from "../controllers/channels.controller.js";

export function registerChannelsRoutes(router: HttpRouter, controller: ReturnType<typeof createChannelsController>): void {
  router.post("/api/v1/channels", controller.create);
  router.post("/api/v1/channels/:channelId/subscribe", controller.subscribe);
  router.delete("/api/v1/channels/:channelId/subscribe", controller.unsubscribe);
}

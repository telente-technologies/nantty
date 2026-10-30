import type { HttpRouter } from "@nantty/fastify-platform";

import type { createBlocksController } from "../controllers/blocks.controller.js";

export function registerBlocksRoutes(router: HttpRouter, controller: ReturnType<typeof createBlocksController>): void {
  router.post("/api/v1/users/:userId/block", controller.blockUser);
  router.delete("/api/v1/users/:userId/block", controller.unblockUser);
  router.get("/api/v1/users/me/blocked", controller.listBlockedUsers);
}

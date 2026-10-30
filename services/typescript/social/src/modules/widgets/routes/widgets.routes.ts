import type { HttpRouter } from "@nantty/fastify-platform";

import type { createWidgetsController } from "../controllers/widgets.controller.js";

export function registerWidgetsRoutes(router: HttpRouter, controller: ReturnType<typeof createWidgetsController>): void {
  router.get("/api/v1/widgets/stories", controller.stories);
}

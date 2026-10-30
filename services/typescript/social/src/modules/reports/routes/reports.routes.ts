import type { HttpRouter } from "@nantty/fastify-platform";

import type { createReportsController } from "../controllers/reports.controller.js";

export function registerReportsRoutes(router: HttpRouter, controller: ReturnType<typeof createReportsController>): void {
  router.post("/api/v1/reports", controller.submit);
}

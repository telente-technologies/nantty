import type { HttpRouter } from "@zudojs/http";

import type { createContentPreferencesController } from "../controllers/contentPreferences.controller.js";

export function registerContentPreferencesRoutes(router: HttpRouter, controller: ReturnType<typeof createContentPreferencesController>): void {
  router.get("/api/v1/me/content-preferences", controller.get);
  router.put("/api/v1/me/content-preferences", controller.update);
}

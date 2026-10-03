import type { HttpRouter } from "@zudojs/http";

import type { createSoundsController } from "../controllers/sounds.controller.js";

export function registerSoundsRoutes(router: HttpRouter, controller: ReturnType<typeof createSoundsController>): void {
  router.get("/api/v1/sounds", controller.search);
  router.post("/api/v1/sounds", controller.create);
  router.get("/api/v1/sounds/trending", controller.trending);
  router.get("/api/v1/sounds/saved", controller.saved);
  router.get("/api/v1/sounds/:soundId", controller.get);
  router.patch("/api/v1/sounds/:soundId", controller.update);
  router.get("/api/v1/sounds/:soundId/clips", controller.clips);
  router.post("/api/v1/sounds/:soundId/save", controller.save);
  router.delete("/api/v1/sounds/:soundId/save", controller.unsave);
}

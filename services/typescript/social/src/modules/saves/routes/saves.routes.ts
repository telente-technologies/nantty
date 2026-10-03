import type { HttpRouter } from "@zudojs/http";

import type { createSavesController } from "../controllers/saves.controller.js";

export function registerSavesRoutes(router: HttpRouter, controller: ReturnType<typeof createSavesController>): void {
  router.post("/api/v1/saves", controller.saveItem);
  router.delete("/api/v1/saves", controller.unsaveItem);
  router.get("/api/v1/saves", controller.listSavedItems);
  router.get("/api/v1/saves/collections", controller.listSaveCollections);
  router.post("/api/v1/saves/collections", controller.createSaveCollection);
  router.patch("/api/v1/saves/:saveId", controller.moveSavedItem);
}

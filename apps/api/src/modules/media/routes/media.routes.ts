import type { HttpRouter } from "@zudojs/http";

import type { WebKit } from "../../../loaders/web.loader.js";
import { describeRoute } from "../../../utils/openapi.util.js";
import type { MediaController } from "../controllers/media.controller.js";
import { CreateUploadBodySchema, MediaParamsSchema, UploadQuerySchema } from "../validators/media.validator.js";

const TAG = "media";

export function registerMediaRoutes(router: HttpRouter, controller: MediaController, web: WebKit): void {
  const { guard } = web;
  const uploader = guard.requirePermission("media:upload");
  router.post("/api/v1/media/uploads", controller.createUpload, { ...uploader, ...describeRoute(TAG, "Get a signed upload URL", { body: CreateUploadBodySchema }) });
  router.put("/api/v1/media/uploads/:id", controller.upload, {
    ...guard.allowAnyone(),
    ...describeRoute(TAG, "Upload a file to a signed URL", { params: MediaParamsSchema, query: UploadQuerySchema }),
  });
  router.get("/api/v1/media/:id", controller.download, { ...guard.allowAnyone(), ...describeRoute(TAG, "Download a file", { params: MediaParamsSchema }) });
  router.delete("/api/v1/media/:id", controller.remove, { ...uploader, ...describeRoute(TAG, "Delete my file", { params: MediaParamsSchema }) });
}

import type { HttpRouter } from "@zudojs/http";

import type { WebKit } from "../../../loaders/web.loader.js";
import { describeRoute } from "../../../utils/openapi.util.js";
import type { MediaController } from "../controllers/media.controller.js";
import type { MediaFilesController } from "../controllers/mediaFiles.controller.js";
import {
  CreateUploadBodySchema,
  MediaFileParamsSchema,
  MediaParamsSchema,
  UploadChunkParamsSchema,
  UploadParamsSchema,
} from "../validators/media.validator.js";

const TAG = "media";

export function registerMediaRoutes(router: HttpRouter, controller: MediaController, filesController: MediaFilesController, web: WebKit): void {
  const { guard } = web;
  const uploader = guard.requirePermission("media:upload");
  router.post("/api/v1/media/uploads", controller.createUpload, { ...uploader, ...describeRoute(TAG, "Start a chunked upload", { body: CreateUploadBodySchema }) });
  router.put("/api/v1/media/uploads/:uploadId/chunks/:chunkIndex", controller.uploadChunk, {
    ...uploader,
    ...describeRoute(TAG, "Upload one chunk (application/octet-stream, X-Chunk-Sha256 header)", { params: UploadChunkParamsSchema }),
  });
  router.get("/api/v1/media/uploads/:uploadId", controller.getUpload, { ...uploader, ...describeRoute(TAG, "Get upload progress", { params: UploadParamsSchema }) });
  router.post("/api/v1/media/uploads/:uploadId/complete", controller.completeUpload, {
    ...uploader,
    ...describeRoute(TAG, "Assemble the chunks and start processing", { params: UploadParamsSchema }),
  });
  router.get("/api/v1/media/files/*key", filesController.downloadPublicFile, {
    ...guard.allowAnyone(),
    ...describeRoute(TAG, "Download a processed public file", { params: MediaFileParamsSchema }),
  });
  router.get("/api/v1/media/:mediaId/original", filesController.downloadOriginal, {
    ...guard.requireSignedInUser(),
    ...describeRoute(TAG, "Download a private original (owner or authorised admin)", { params: MediaParamsSchema }),
  });
  router.get("/api/v1/media/:mediaId", controller.getMedia, { ...guard.allowAnyone(), ...describeRoute(TAG, "Get a media asset", { params: MediaParamsSchema }) });
  router.delete("/api/v1/media/:mediaId", controller.remove, { ...uploader, ...describeRoute(TAG, "Delete my media", { params: MediaParamsSchema }) });
}

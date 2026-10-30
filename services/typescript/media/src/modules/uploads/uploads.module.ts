import type { FastifyInstance } from "fastify";

import type { HandlerContext } from "../../types/handlerContext.type.js";
import type { RouteFactory } from "../../utils/route.util.js";
import { createGetMediaAssetHandler } from "../assets/queries/getMediaAsset/getMediaAsset.handler.js";
import { createAbortUploadSessionHandler } from "./commands/abortUploadSession/abortUploadSession.handler.js";
import { createCompleteUploadSessionHandler } from "./commands/completeUploadSession/completeUploadSession.handler.js";
import { createCreateUploadSessionHandler } from "./commands/createUploadSession/createUploadSession.handler.js";
import { createUploadChunkHandler } from "./commands/uploadChunk/uploadChunk.handler.js";
import { createUploadsController } from "./controllers/uploads.controller.js";
import { createGetChunkUploadUrlHandler } from "./queries/getChunkUploadUrl/getChunkUploadUrl.handler.js";
import { createGetChunkUploadUrlsHandler } from "./queries/getChunkUploadUrls/getChunkUploadUrls.handler.js";
import { createGetUploadSessionHandler } from "./queries/getUploadSession/getUploadSession.handler.js";
import { registerUploadsRoutes } from "./routes/uploads.routes.js";

export function mountUploadsModule(app: FastifyInstance, route: RouteFactory, context: HandlerContext): void {
  registerUploadsRoutes(app, createUploadsController(route, {
    createUploadSession: createCreateUploadSessionHandler(context),
    uploadChunk: createUploadChunkHandler(context),
    completeUploadSession: createCompleteUploadSessionHandler(context),
    abortUploadSession: createAbortUploadSessionHandler(context),
    getUploadSession: createGetUploadSessionHandler(context),
    getChunkUploadUrl: createGetChunkUploadUrlHandler(context),
    getChunkUploadUrls: createGetChunkUploadUrlsHandler(context),
    getMediaAsset: createGetMediaAssetHandler(context),
  }));
}

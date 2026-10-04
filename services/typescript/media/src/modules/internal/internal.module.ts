import type { HttpRouter } from "@zudojs/http";

import type { HandlerContext } from "../../types/handlerContext.type.js";
import type { RouteFactory } from "../../utils/route.util.js";
import { createCreatePrivateAccessUrlHandler } from "./commands/createPrivateAccessUrl/createPrivateAccessUrl.handler.js";
import { createCreateUploadIntentHandler } from "./commands/createUploadIntent/createUploadIntent.handler.js";
import { createCompleteUploadSessionHandler } from "../uploads/commands/completeUploadSession/completeUploadSession.handler.js";
import { createDeleteMediaHandler } from "./commands/deleteMedia/deleteMedia.handler.js";
import { createReviewHeldMediaHandler } from "./commands/reviewHeldMedia/reviewHeldMedia.handler.js";
import { createInternalController } from "./controllers/internal.controller.js";
import { createGetAudioFingerprintHandler } from "./queries/getAudioFingerprint/getAudioFingerprint.handler.js";
import { createGetInternalMediaHandler } from "./queries/getInternalMedia/getInternalMedia.handler.js";
import { registerInternalRoutes } from "./routes/internal.routes.js";

export function mountInternalModule(router: HttpRouter, route: RouteFactory, context: HandlerContext): void {
  registerInternalRoutes(router, createInternalController(route, {
    createUploadIntent: createCreateUploadIntentHandler(context),
    getInternalMedia: createGetInternalMediaHandler(context),
    createPrivateAccessUrl: createCreatePrivateAccessUrlHandler(context),
    reviewHeldMedia: createReviewHeldMediaHandler(context),
    completeUploadSession: createCompleteUploadSessionHandler(context),
    deleteMedia: createDeleteMediaHandler(context),
    getAudioFingerprint: createGetAudioFingerprintHandler(context),
  }));
}

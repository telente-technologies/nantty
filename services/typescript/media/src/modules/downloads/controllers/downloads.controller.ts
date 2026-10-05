import type { Handler } from "../../../types/handlerContext.type.js";
import type { RouteFactory } from "../../../utils/route.util.js";
import type { RequestDownloadVariantCommand } from "../commands/requestDownloadVariant/requestDownloadVariant.command.js";
import type { DownloadVariantView } from "../models/downloadVariant.model.js";
import { downloadVariantBodySchema, downloadVariantParamsSchema } from "../validators/downloads.validator.js";

export interface DownloadsHandlers {
  readonly requestDownloadVariant: Handler<RequestDownloadVariantCommand, DownloadVariantView>;
}

export function createDownloadsController(route: RouteFactory, handlers: DownloadsHandlers) {
  return {
    requestVariant: route({ authentication: "internal", params: downloadVariantParamsSchema, body: downloadVariantBodySchema }, ({ params, body }) =>
      handlers.requestDownloadVariant({ mediaId: params.mediaId, requesterId: body.requesterId, watermarkHandle: body.watermarkHandle, stripAudio: body.stripAudio ?? false })),
  };
}

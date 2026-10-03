import { notFound } from "../../../../errors/media.error.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { MediaAssetView } from "../../models/mediaAsset.model.js";
import { mediaAssetRepository } from "../../repositories/mediaAsset.repository.js";
import { buildMediaAssetView } from "../../services/mediaAssetView.service.js";

export interface GetMediaAssetQuery {
  readonly viewerId: string;
  readonly mediaId: string;
}

export function createGetMediaAssetHandler(context: HandlerContext): Handler<GetMediaAssetQuery, MediaAssetView> {
  return async (query) => {
    const asset = await mediaAssetRepository.findById(context.database.client, query.mediaId);
    if (asset === null || asset.status === "deleted") throw notFound("MEDIA_NOT_FOUND", "Media not found");
    const visibleToEveryone = !asset.isPrivate && asset.status === "ready";
    if (!visibleToEveryone && asset.ownerId !== query.viewerId) throw notFound("MEDIA_NOT_FOUND", "Media not found");
    return buildMediaAssetView(context, asset);
  };
}

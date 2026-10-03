import { notFound } from "../../../../errors/media.error.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { mediaAssetRepository } from "../../../assets/repositories/mediaAsset.repository.js";
import { buildMediaAssetView } from "../../../assets/services/mediaAssetView.service.js";

export interface InternalMediaView {
  readonly id: string;
  readonly ownerId: string;
  readonly purpose: string;
  readonly kind: string;
  readonly status: string;
  readonly isPrivate: boolean;
  readonly sizeBytes: number;
  readonly displayUrl: string | null;
  readonly asset: Awaited<ReturnType<typeof buildMediaAssetView>>;
}

export function createGetInternalMediaHandler(context: HandlerContext): Handler<{ readonly mediaId: string }, InternalMediaView> {
  return async (query) => {
    const asset = await mediaAssetRepository.findById(context.database.client, query.mediaId);
    if (asset === null) throw notFound("MEDIA_NOT_FOUND", "Media not found");
    const view = await buildMediaAssetView(context, asset);
    const largestImage = [...view.variants].filter((variant) => variant.format === "jpeg").sort((left, right) => right.width - left.width)[0];
    return { id: asset.id, ownerId: asset.ownerId, purpose: asset.purpose, kind: asset.kind, status: asset.status, isPrivate: asset.isPrivate, sizeBytes: Number(asset.sizeBytes), displayUrl: largestImage?.url ?? view.posterUrl ?? null, asset: view };
  };
}

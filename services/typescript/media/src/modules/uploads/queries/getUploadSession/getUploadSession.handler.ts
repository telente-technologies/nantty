import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { mediaAssetRepository } from "../../../assets/repositories/mediaAsset.repository.js";
import { buildMediaAssetView, toClientStatus } from "../../../assets/services/mediaAssetView.service.js";
import { requireOwnedUploadSession } from "../../services/uploadAccess.service.js";
import type { GetUploadSessionQuery, UploadSessionStatusView } from "./getUploadSession.query.js";

export function createGetUploadSessionHandler(context: HandlerContext): Handler<GetUploadSessionQuery, UploadSessionStatusView> {
  return async (query) => {
    const session = await requireOwnedUploadSession(context, query.ownerId, { uploadId: query.uploadId });
    const asset = await mediaAssetRepository.findById(context.database.client, session.mediaId);
    const open = session.status === "uploading" && session.expiresAt > context.clock.now();
    const uploadedChunks = !open ? Array.from({ length: session.totalChunks }, (_, index) => index) : session.s3UploadId === null ? [] : (await context.storage.listParts(session.bucket, session.objectKey, session.s3UploadId)).map((part) => part.partNumber - 1).sort((left, right) => left - right);
    if (asset === null || asset.status === "uploading") return { status: "uploading", uploadedChunks };
    return { status: toClientStatus(asset.status), uploadedChunks, media: await buildMediaAssetView(context, asset) };
  };
}

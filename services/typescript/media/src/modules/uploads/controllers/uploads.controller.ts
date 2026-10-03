import type { Handler } from "../../../types/handlerContext.type.js";
import type { RouteFactory } from "../../../utils/route.util.js";
import type { MediaAssetView } from "../../assets/models/mediaAsset.model.js";
import type { AbortUploadSessionCommand } from "../commands/abortUploadSession/abortUploadSession.handler.js";
import type { CompletedUploadView, CompleteUploadSessionCommand } from "../commands/completeUploadSession/completeUploadSession.command.js";
import type { CreateUploadSessionCommand, UploadSessionView } from "../commands/createUploadSession/createUploadSession.command.js";
import type { UploadChunkCommand } from "../commands/uploadChunk/uploadChunk.command.js";
import type { ChunkUploadUrlView, GetChunkUploadUrlQuery } from "../queries/getChunkUploadUrl/getChunkUploadUrl.handler.js";
import type { GetUploadSessionQuery, UploadSessionStatusView } from "../queries/getUploadSession/getUploadSession.query.js";
import type { GetMediaAssetQuery } from "../../assets/queries/getMediaAsset/getMediaAsset.handler.js";
import type { ChunkUploadUrlsView, GetChunkUploadUrlsQuery } from "../queries/getChunkUploadUrls/getChunkUploadUrls.handler.js";
import { chunkParamsSchema, chunkUrlsBodySchema, createUploadSessionBodySchema, mediaParamsSchema, uploadParamsSchema } from "../validators/uploads.validator.js";

export interface UploadsHandlers {
  readonly createUploadSession: Handler<CreateUploadSessionCommand, UploadSessionView>;
  readonly uploadChunk: Handler<UploadChunkCommand, { readonly uploadedChunks: readonly number[] }>;
  readonly completeUploadSession: Handler<CompleteUploadSessionCommand, CompletedUploadView>;
  readonly abortUploadSession: Handler<AbortUploadSessionCommand, undefined>;
  readonly getUploadSession: Handler<GetUploadSessionQuery, UploadSessionStatusView>;
  readonly getChunkUploadUrl: Handler<GetChunkUploadUrlQuery, ChunkUploadUrlView>;
  readonly getChunkUploadUrls: Handler<GetChunkUploadUrlsQuery, ChunkUploadUrlsView>;
  readonly getMediaAsset: Handler<GetMediaAssetQuery, MediaAssetView>;
}

export function createUploadsController(route: RouteFactory, handlers: UploadsHandlers) {
  return {
    create: route({ authentication: "user", body: createUploadSessionBodySchema, successStatus: 201 }, ({ principal, body, idempotencyKey }) =>
      handlers.createUploadSession({ ownerId: principal.accountId, fileName: body.fileName, mimeType: body.mimeType, sizeBytes: body.sizeBytes, purpose: body.purpose, sha256: body.sha256, idempotencyKey })),
    status: route({ authentication: "user", params: uploadParamsSchema }, ({ principal, params }) => handlers.getUploadSession({ ownerId: principal.accountId, uploadId: params.uploadId })),
    uploadChunk: route({ authentication: "user", params: chunkParamsSchema, rawBody: true }, ({ principal, params, rawBody, sha256Header }) =>
      handlers.uploadChunk({ ownerId: principal.accountId, uploadId: params.uploadId, chunkIndex: params.chunkIndex, bytes: rawBody, sha256: sha256Header })),
    chunkUrl: route({ authentication: "user", params: chunkParamsSchema }, ({ principal, params }) => handlers.getChunkUploadUrl({ ownerId: principal.accountId, uploadId: params.uploadId, chunkIndex: params.chunkIndex })),
    chunkUrls: route({ authentication: "user", params: uploadParamsSchema, body: chunkUrlsBodySchema }, ({ principal, params, body }) => handlers.getChunkUploadUrls({ ownerId: principal.accountId, uploadId: params.uploadId, chunkIndexes: body.chunkIndexes })),
    complete: route({ authentication: "user", params: uploadParamsSchema }, ({ principal, params }) => handlers.completeUploadSession({ ownerId: principal.accountId, lookup: { uploadId: params.uploadId } })),
    completeByMedia: route({ authentication: "user", params: mediaParamsSchema }, ({ principal, params }) => handlers.completeUploadSession({ ownerId: principal.accountId, lookup: { mediaId: params.mediaId } })),
    abort: route({ authentication: "user", params: uploadParamsSchema }, ({ principal, params }) => handlers.abortUploadSession({ ownerId: principal.accountId, uploadId: params.uploadId })),
    getMedia: route({ authentication: "user", params: mediaParamsSchema }, ({ principal, params }) => handlers.getMediaAsset({ viewerId: principal.accountId, mediaId: params.mediaId })),
  };
}

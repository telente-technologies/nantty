import { maximumPresignedBatchSize } from "../../../../constants/media.constant.js";
import { badRequest } from "../../../../errors/media.error.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { requireOpenUploadSession, requireOwnedUploadSession } from "../../services/uploadAccess.service.js";
import { presignChunkTarget, type ChunkUploadTarget } from "../../services/chunkUploadTarget.service.js";

export interface GetChunkUploadUrlsQuery {
  readonly ownerId: string;
  readonly uploadId: string;
  readonly chunkIndexes: readonly number[];
}

export interface ChunkUploadUrlsView {
  readonly urls: readonly (ChunkUploadTarget & { readonly chunkIndex: number })[];
}

export function createGetChunkUploadUrlsHandler(context: HandlerContext): Handler<GetChunkUploadUrlsQuery, ChunkUploadUrlsView> {
  return async (query) => {
    const session = await requireOwnedUploadSession(context, query.ownerId, { uploadId: query.uploadId });
    requireOpenUploadSession(session, context.clock.now());
    const chunkIndexes = [...new Set(query.chunkIndexes)];
    if (chunkIndexes.length === 0 || chunkIndexes.length > maximumPresignedBatchSize) throw badRequest("INVALID_PART_BATCH", `Ask for 1 to ${maximumPresignedBatchSize} chunks at a time.`);
    return { urls: await Promise.all(chunkIndexes.map(async (chunkIndex) => ({ chunkIndex, ...(await presignChunkTarget(context, session, chunkIndex)) }))) };
  };
}

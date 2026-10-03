import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { presignChunkTarget, type ChunkUploadTarget } from "../../services/chunkUploadTarget.service.js";
import { requireOpenUploadSession, requireOwnedUploadSession } from "../../services/uploadAccess.service.js";

export interface GetChunkUploadUrlQuery {
  readonly ownerId: string;
  readonly uploadId: string;
  readonly chunkIndex: number;
}

export type ChunkUploadUrlView = ChunkUploadTarget;

export function createGetChunkUploadUrlHandler(context: HandlerContext): Handler<GetChunkUploadUrlQuery, ChunkUploadUrlView> {
  return async (query) => {
    const session = await requireOwnedUploadSession(context, query.ownerId, { uploadId: query.uploadId });
    requireOpenUploadSession(session, context.clock.now());
    return presignChunkTarget(context, session, query.chunkIndex);
  };
}

import { createHash } from "node:crypto";

import { badRequest, forbidden, unprocessable } from "../../../../errors/media.error.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { expectedChunkBytes } from "../../../../utils/chunkPlan.util.js";
import { requireOpenUploadSession, requireOwnedUploadSession } from "../../services/uploadAccess.service.js";
import type { UploadChunkCommand } from "./uploadChunk.command.js";

export function createUploadChunkHandler(context: HandlerContext): Handler<UploadChunkCommand, { readonly uploadedChunks: readonly number[] }> {
  return async (command) => {
    if (!context.config.allowProxiedChunks) throw forbidden("PROXIED_CHUNKS_DISABLED", "Upload each chunk to the signed URL from GET /uploads/:id/chunks/:i/url.");
    const session = await requireOwnedUploadSession(context, command.ownerId, { uploadId: command.uploadId });
    requireOpenUploadSession(session, context.clock.now());
    if (session.s3UploadId === null) throw badRequest("CHUNKS_NOT_SUPPORTED", "This upload takes a single PUT to the signed URL.");
    if (command.chunkIndex < 0 || command.chunkIndex >= session.totalChunks) throw badRequest("CHUNK_OUT_OF_RANGE", "Chunk index out of range");
    const expected = expectedChunkBytes(command.chunkIndex, Number(session.sizeBytes), session.chunkSizeBytes, session.totalChunks);
    if (command.bytes.byteLength !== expected) throw unprocessable("CHUNK_SIZE_MISMATCH", `Chunk ${command.chunkIndex} must be ${expected} bytes.`);
    if (command.sha256 !== undefined && createHash("sha256").update(command.bytes).digest("hex") !== command.sha256) throw unprocessable("CHUNK_CHECKSUM_MISMATCH", "The chunk did not match its X-Chunk-Sha256 header.");
    await context.storage.uploadPart(session.bucket, session.objectKey, session.s3UploadId, command.chunkIndex + 1, command.bytes);
    const parts = await context.storage.listParts(session.bucket, session.objectKey, session.s3UploadId);
    return { uploadedChunks: parts.map((part) => part.partNumber - 1).sort((left, right) => left - right) };
  };
}

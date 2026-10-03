import { presignedPartLifetimeSeconds } from "../../../constants/media.constant.js";
import { badRequest } from "../../../errors/media.error.js";
import type { HandlerContext } from "../../../types/handlerContext.type.js";
import { expectedChunkBytes } from "../../../utils/chunkPlan.util.js";
import type { uploadSessionRepository } from "../repositories/uploadSession.repository.js";

export interface ChunkUploadTarget {
  readonly url: string;
  readonly method: "PUT";
  readonly expectedBytes: number;
  readonly expiresAt: string;
}

type Session = NonNullable<Awaited<ReturnType<typeof uploadSessionRepository.findById>>>;

export async function presignChunkTarget(context: HandlerContext, session: Session, chunkIndex: number): Promise<ChunkUploadTarget> {
  if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= session.totalChunks) throw badRequest("CHUNK_OUT_OF_RANGE", "Chunk index out of range");
  const expiresAt = new Date(context.clock.now().getTime() + presignedPartLifetimeSeconds * 1000).toISOString();
  const expectedBytes = expectedChunkBytes(chunkIndex, Number(session.sizeBytes), session.chunkSizeBytes, session.totalChunks);
  const url = session.s3UploadId === null
    ? (await context.storage.presignPut(session.bucket, session.objectKey, session.mimeType, presignedPartLifetimeSeconds, Number(session.sizeBytes))).url
    : await context.storage.presignUploadPart(session.bucket, session.objectKey, session.s3UploadId, chunkIndex + 1, presignedPartLifetimeSeconds);
  return { url, method: "PUT", expectedBytes, expiresAt };
}

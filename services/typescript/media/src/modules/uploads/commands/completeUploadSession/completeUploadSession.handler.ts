import { mediaJobQueueName, processMediaJobType } from "../../../../constants/media.constant.js";
import { conflict, unprocessable } from "../../../../errors/media.error.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { deterministicUuid } from "../../../../utils/deterministicUuid.util.js";
import { mediaAssetRepository } from "../../../assets/repositories/mediaAsset.repository.js";
import { mediaEvents } from "../../../assets/services/mediaEvents.service.js";
import { uploadSessionRepository } from "../../repositories/uploadSession.repository.js";
import { requireOwnedUploadSession } from "../../services/uploadAccess.service.js";
import type { CompletedUploadView, CompleteUploadSessionCommand } from "./completeUploadSession.command.js";

type Session = NonNullable<Awaited<ReturnType<typeof uploadSessionRepository.findById>>>;

async function assembleUpload(context: HandlerContext, session: Session): Promise<void> {
  if (session.s3UploadId === null) {
    const head = await context.storage.headObject(session.bucket, session.objectKey);
    if (head === undefined) throw conflict("UPLOAD_NOT_RECEIVED", "The file has not been uploaded yet.");
    if (head.sizeBytes !== Number(session.sizeBytes)) {
      await context.storage.deleteObject(session.bucket, session.objectKey);
      throw unprocessable("SIZE_MISMATCH", "The uploaded file does not match the declared size.");
    }
    return;
  }
  const parts = await context.storage.listParts(session.bucket, session.objectKey, session.s3UploadId);
  const present = new Set(parts.map((part) => part.partNumber));
  const missing = Array.from({ length: session.totalChunks }, (_, index) => index).filter((index) => !present.has(index + 1));
  if (missing.length > 0) throw conflict("CHUNKS_MISSING", "Some chunks are missing");
  const ordered = [...parts].sort((left, right) => left.partNumber - right.partNumber).slice(0, session.totalChunks);
  if (ordered.reduce((sum, part) => sum + part.sizeBytes, 0) !== Number(session.sizeBytes)) throw unprocessable("SIZE_MISMATCH", "The uploaded chunks do not match the declared size.");
  await context.storage.completeMultipartUpload(session.bucket, session.objectKey, session.s3UploadId, ordered);
}

export function createCompleteUploadSessionHandler(context: HandlerContext): Handler<CompleteUploadSessionCommand, CompletedUploadView> {
  return async (command) => {
    const session = await requireOwnedUploadSession(context, command.ownerId, command.lookup);
    if (session.status === "completed") return { mediaId: session.mediaId, status: "processing" };
    if (session.status !== "uploading" || session.expiresAt <= context.clock.now()) throw conflict("UPLOAD_CLOSED", "This upload can no longer be completed.");
    await assembleUpload(context, session);
    const now = context.clock.now();
    await context.database.transaction(async (transaction) => {
      await uploadSessionRepository.update(transaction, session.id, { status: "completed", completedAt: now });
      const asset = await mediaAssetRepository.update(transaction, session.mediaId, { status: "uploaded" });
      await mediaEvents.uploaded(transaction, { ...asset, variants: [] }, now);
    });
    await context.jobs.enqueueJob(mediaJobQueueName, { id: deterministicUuid(`process:${session.mediaId}`), type: processMediaJobType, payload: { mediaId: session.mediaId } });
    return { mediaId: session.mediaId, status: "processing" };
  };
}

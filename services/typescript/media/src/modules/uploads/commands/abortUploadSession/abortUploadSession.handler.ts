import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { mediaAssetRepository } from "../../../assets/repositories/mediaAsset.repository.js";
import { uploadSessionRepository } from "../../repositories/uploadSession.repository.js";
import { requireOwnedUploadSession } from "../../services/uploadAccess.service.js";

export interface AbortUploadSessionCommand {
  readonly ownerId: string;
  readonly uploadId: string;
}

export async function abortOpenUploadSession(context: HandlerContext, session: { readonly id: string; readonly mediaId: string; readonly bucket: string; readonly objectKey: string; readonly s3UploadId: string | null }, status: "aborted" | "expired"): Promise<void> {
  if (session.s3UploadId !== null) await context.storage.abortMultipartUpload(session.bucket, session.objectKey, session.s3UploadId).catch(() => undefined);
  else await context.storage.deleteObject(session.bucket, session.objectKey).catch(() => undefined);
  await context.database.transaction(async (transaction) => {
    await uploadSessionRepository.update(transaction, session.id, { status });
    await mediaAssetRepository.update(transaction, session.mediaId, { status: "deleted", deletedAt: context.clock.now() });
  });
}

export function createAbortUploadSessionHandler(context: HandlerContext): Handler<AbortUploadSessionCommand, undefined> {
  return async (command) => {
    const session = await requireOwnedUploadSession(context, command.ownerId, { uploadId: command.uploadId });
    if (session.status === "uploading") await abortOpenUploadSession(context, session, "aborted");
    return undefined;
  };
}

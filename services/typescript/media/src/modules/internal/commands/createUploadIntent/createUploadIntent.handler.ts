import { randomUUID } from "node:crypto";

import { presignedPartLifetimeSeconds, uploadSessionLifetimeHours } from "../../../../constants/media.constant.js";
import type { MediaPurposeName } from "../../../../constants/purposePolicy.constant.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { derivativeKeyFor, quarantineKeyFor } from "../../../../utils/objectKeys.util.js";
import { requireUploadAllowed } from "../../../../utils/purposePolicy.util.js";
import { uploadSessionRepository } from "../../../uploads/repositories/uploadSession.repository.js";

export interface CreateUploadIntentCommand {
  readonly accountId: string;
  readonly purpose: Extract<MediaPurposeName, "avatar" | "banner">;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly fileName: string | undefined;
}

export interface UploadIntentView {
  readonly mediaId: string;
  readonly uploadId: string;
  readonly uploadUrl: string;
  readonly method: "PUT";
  readonly headers: Readonly<Record<string, string>>;
  readonly publicUrl: string;
  readonly expiresAt: string;
  readonly maximumSize: number;
}

export function createCreateUploadIntentHandler(context: HandlerContext): Handler<CreateUploadIntentCommand, UploadIntentView> {
  return async (command) => {
    const rule = requireUploadAllowed(command.purpose, command.contentType, command.sizeBytes);
    const mediaId = randomUUID();
    const bucket = context.config.storage.quarantineBucket;
    const objectKey = quarantineKeyFor(command.accountId, mediaId);
    const now = context.clock.now();
    const presigned = await context.storage.presignPut(bucket, objectKey, command.contentType, presignedPartLifetimeSeconds, command.sizeBytes);
    const session = await context.database.transaction(async (transaction) => {
      await transaction.mediaAsset.create({ data: { id: mediaId, ownerId: command.accountId, purpose: command.purpose, kind: rule.kind, declaredMimeType: command.contentType, sizeBytes: command.sizeBytes, quarantineBucket: bucket, quarantineKey: objectKey } });
      return uploadSessionRepository.create(transaction, {
        ownerId: command.accountId, mediaId, purpose: command.purpose, fileName: command.fileName ?? command.purpose, mimeType: command.contentType, sizeBytes: command.sizeBytes, mode: "single", objectKey, bucket,
        chunkSizeBytes: command.sizeBytes, totalChunks: 1, expiresAt: new Date(now.getTime() + uploadSessionLifetimeHours * 3_600_000),
      });
    });
    return {
      mediaId, uploadId: session.id, uploadUrl: presigned.url, method: "PUT", headers: presigned.headers, publicUrl: context.urls.publicUrl(derivativeKeyFor(mediaId, false, "display.jpg")),
      expiresAt: new Date(now.getTime() + presignedPartLifetimeSeconds * 1000).toISOString(), maximumSize: rule.maximumBytes,
    };
  };
}

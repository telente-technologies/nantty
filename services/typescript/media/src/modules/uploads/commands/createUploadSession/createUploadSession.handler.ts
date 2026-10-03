import { randomUUID } from "node:crypto";

import { maximumActiveUploadSessionsPerAccount, presignedPartLifetimeSeconds, uploadSessionLifetimeHours } from "../../../../constants/media.constant.js";
import { purposePolicies } from "../../../../constants/purposePolicy.constant.js";
import { tooManyRequests } from "../../../../errors/media.error.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { planUpload } from "../../../../utils/chunkPlan.util.js";
import { quarantineKeyFor } from "../../../../utils/objectKeys.util.js";
import { requireUploadAllowed } from "../../../../utils/purposePolicy.util.js";
import { uploadSessionRepository } from "../../repositories/uploadSession.repository.js";
import type { CreateUploadSessionCommand, UploadSessionView } from "./createUploadSession.command.js";

function viewOf(context: HandlerContext, session: { id: string; mediaId: string; mode: string; chunkSizeBytes: number; totalChunks: number; expiresAt: Date }, plan: { recommendedParallelism: number }, single?: { url: string; headers: Record<string, string> }): UploadSessionView {
  return {
    mode: session.mode === "single" ? "single" : "multipart", uploadId: session.id, mediaId: session.mediaId, partSizeBytes: session.chunkSizeBytes, partCount: session.totalChunks, recommendedParallelism: plan.recommendedParallelism,
    chunkSizeBytes: session.chunkSizeBytes, totalChunks: session.totalChunks, uploadedChunks: [], uploadMode: context.config.allowProxiedChunks ? "proxied" : "presigned", expiresAt: session.expiresAt.toISOString(),
    ...(single === undefined ? {} : { url: single.url, headers: single.headers }),
  };
}

export function createCreateUploadSessionHandler(context: HandlerContext): Handler<CreateUploadSessionCommand, UploadSessionView> {
  return async (command) => {
    const db = context.database.client;
    const now = context.clock.now();
    const rule = requireUploadAllowed(command.purpose, command.mimeType, command.sizeBytes);
    if (command.idempotencyKey !== undefined) {
      const existing = await uploadSessionRepository.findByIdempotencyKey(db, command.ownerId, command.idempotencyKey);
      if (existing !== null) {
        const resumed = planUpload(Number(existing.sizeBytes));
        const single = existing.mode === "single" ? await context.storage.presignPut(existing.bucket, existing.objectKey, existing.mimeType, presignedPartLifetimeSeconds, Number(existing.sizeBytes)) : undefined;
        return viewOf(context, existing, resumed, single === undefined ? undefined : { url: single.url, headers: { ...single.headers } });
      }
    }
    if ((await uploadSessionRepository.countActive(db, command.ownerId, now)) >= maximumActiveUploadSessionsPerAccount) throw tooManyRequests("UPLOAD_QUOTA_EXCEEDED", "Finish or cancel your pending uploads first.");
    const mediaId = randomUUID();
    const bucket = context.config.storage.quarantineBucket;
    const objectKey = quarantineKeyFor(command.ownerId, mediaId);
    const plan = planUpload(command.sizeBytes);
    const single = plan.mode === "single" ? await context.storage.presignPut(bucket, objectKey, command.mimeType, presignedPartLifetimeSeconds, command.sizeBytes) : undefined;
    const s3UploadId = plan.mode === "single" ? null : await context.storage.createMultipartUpload(bucket, objectKey, command.mimeType);
    const isPrivate = purposePolicies[command.purpose].isPrivate;
    try {
      const session = await context.database.transaction(async (transaction) => {
        await transaction.mediaAsset.create({
          data: { id: mediaId, ownerId: command.ownerId, purpose: command.purpose, kind: rule.kind, isPrivate, declaredMimeType: command.mimeType, sizeBytes: command.sizeBytes, sha256: command.sha256?.toLowerCase() ?? null, quarantineBucket: bucket, quarantineKey: objectKey },
        });
        return uploadSessionRepository.create(transaction, {
          ownerId: command.ownerId, mediaId, purpose: command.purpose, fileName: command.fileName.slice(0, 255), mimeType: command.mimeType, sizeBytes: command.sizeBytes, sha256: command.sha256?.toLowerCase() ?? null,
          idempotencyKey: command.idempotencyKey ?? null, objectKey, bucket, s3UploadId, mode: plan.mode, chunkSizeBytes: plan.partSizeBytes, totalChunks: plan.partCount, expiresAt: new Date(now.getTime() + uploadSessionLifetimeHours * 3_600_000),
        });
      });
      return viewOf(context, session, plan, single === undefined ? undefined : { url: single.url, headers: { ...single.headers } });
    } catch (error) {
      if (s3UploadId !== null) await context.storage.abortMultipartUpload(bucket, objectKey, s3UploadId).catch(() => undefined);
      throw error;
    }
  };
}

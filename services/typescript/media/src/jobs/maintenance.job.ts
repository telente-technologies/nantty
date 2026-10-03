import type { Logger } from "@zudojs/logger";

import { mediaJobQueueName, processMediaJobType } from "../constants/media.constant.js";
import { abortOpenUploadSession } from "../modules/uploads/commands/abortUploadSession/abortUploadSession.handler.js";
import { uploadSessionRepository } from "../modules/uploads/repositories/uploadSession.repository.js";
import { deleteExpiredMedia } from "../modules/assets/services/mediaDeletion.service.js";
import type { HandlerContext } from "../types/handlerContext.type.js";
import { deterministicUuid } from "../utils/deterministicUuid.util.js";

const stalledUploadedAssetMilliseconds = 5 * 60 * 1000;

export async function expireAbandonedUploadSessions(context: HandlerContext, batchSize = 100): Promise<number> {
  const expired = await uploadSessionRepository.findExpiredOpen(context.database.client, context.clock.now(), batchSize);
  for (const session of expired) await abortOpenUploadSession(context, session, "expired");
  return expired.length;
}

export async function requeueStalledUploadedAssets(context: HandlerContext): Promise<number> {
  const cutoff = new Date(context.clock.now().getTime() - stalledUploadedAssetMilliseconds);
  const stalled = await context.database.client.mediaAsset.findMany({ where: { status: "uploaded", updatedAt: { lt: cutoff } }, select: { id: true }, take: 200 });
  for (const asset of stalled) await context.jobs.enqueueJob(mediaJobQueueName, { id: deterministicUuid(`process:${asset.id}`), type: processMediaJobType, payload: { mediaId: asset.id } });
  return stalled.length;
}

export async function runMediaMaintenance(context: HandlerContext): Promise<{ readonly expiredSessions: number; readonly deletedMedia: number; readonly requeued: number }> {
  const expiredSessions = await expireAbandonedUploadSessions(context);
  const deletedMedia = await deleteExpiredMedia(context);
  const requeued = await requeueStalledUploadedAssets(context);
  return { expiredSessions, deletedMedia, requeued };
}

export function startMaintenanceJob(context: HandlerContext, logger: Logger, intervalMs: number): () => void {
  const timer = setInterval(() => {
    runMediaMaintenance(context).catch((error: unknown) => logger.warn("media maintenance failed", { error: error instanceof Error ? error.message : String(error) }));
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}

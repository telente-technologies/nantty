import { deleteMediaJobType, mediaJobQueueName, muteMediaAudioJobType } from "../../../constants/media.constant.js";
import type { HandlerContext } from "../../../types/handlerContext.type.js";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function extractExpiredMediaIds(body: unknown): { readonly eventId: string; readonly mediaIds: readonly string[] } | undefined {
  const envelope = body as { id?: unknown; type?: unknown; data?: { mediaIds?: unknown } } | null;
  if (envelope === null || typeof envelope !== "object" || envelope.type !== "chatMedia.expired" || typeof envelope.id !== "string") return undefined;
  const mediaIds = Array.isArray(envelope.data?.mediaIds) ? envelope.data.mediaIds.filter((value): value is string => typeof value === "string" && uuidPattern.test(value)) : [];
  return mediaIds.length === 0 ? undefined : { eventId: envelope.id, mediaIds };
}

const audioRemedyModes: Readonly<Record<string, "mute" | "restore">> = { "clipAudio.muteRequested": "mute", "clipAudio.restoreRequested": "restore" };

export function extractAudioRemedyRequest(body: unknown): { readonly eventId: string; readonly mode: "mute" | "restore"; readonly claimId: string | null; readonly mediaIds: readonly string[] } | undefined {
  const envelope = body as { id?: unknown; type?: unknown; data?: { mediaIds?: unknown; claimId?: unknown } } | null;
  if (envelope === null || typeof envelope !== "object" || typeof envelope.type !== "string" || typeof envelope.id !== "string") return undefined;
  const mode = audioRemedyModes[envelope.type];
  if (mode === undefined) return undefined;
  const mediaIds = Array.isArray(envelope.data?.mediaIds) ? envelope.data.mediaIds.filter((value): value is string => typeof value === "string" && uuidPattern.test(value)) : [];
  return { eventId: envelope.id, mode, claimId: typeof envelope.data?.claimId === "string" ? envelope.data.claimId : null, mediaIds };
}

export async function handleDomainEventForMedia(context: HandlerContext, body: unknown): Promise<void> {
  const remedy = extractAudioRemedyRequest(body);
  if (remedy !== undefined) {
    for (const mediaId of remedy.mediaIds) {
      await context.jobs.enqueueJob(mediaJobQueueName, { id: `${remedy.eventId}:${mediaId}`, type: muteMediaAudioJobType, payload: { mediaId, claimId: remedy.claimId, mode: remedy.mode } });
    }
    return;
  }
  const expired = extractExpiredMediaIds(body);
  if (expired === undefined) return;
  await context.jobs.enqueueJob(mediaJobQueueName, { id: expired.eventId, type: deleteMediaJobType, payload: { mediaIds: expired.mediaIds, reason: "chatMediaExpired" } });
}

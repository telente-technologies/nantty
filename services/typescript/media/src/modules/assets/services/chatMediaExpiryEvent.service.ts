import { deleteMediaJobType, mediaJobQueueName } from "../../../constants/media.constant.js";
import type { HandlerContext } from "../../../types/handlerContext.type.js";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function extractExpiredMediaIds(body: unknown): { readonly eventId: string; readonly mediaIds: readonly string[] } | undefined {
  const envelope = body as { id?: unknown; type?: unknown; data?: { mediaIds?: unknown } } | null;
  if (envelope === null || typeof envelope !== "object" || envelope.type !== "chatMedia.expired" || typeof envelope.id !== "string") return undefined;
  const mediaIds = Array.isArray(envelope.data?.mediaIds) ? envelope.data.mediaIds.filter((value): value is string => typeof value === "string" && uuidPattern.test(value)) : [];
  return mediaIds.length === 0 ? undefined : { eventId: envelope.id, mediaIds };
}

export async function handleDomainEventForMedia(context: HandlerContext, body: unknown): Promise<void> {
  const expired = extractExpiredMediaIds(body);
  if (expired === undefined) return;
  await context.jobs.enqueueJob(mediaJobQueueName, { id: expired.eventId, type: deleteMediaJobType, payload: { mediaIds: expired.mediaIds, reason: "chatMediaExpired" } });
}

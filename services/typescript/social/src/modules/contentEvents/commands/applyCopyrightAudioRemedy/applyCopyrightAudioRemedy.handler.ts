import { socialEventTypes } from "../../../../events/eventTypes.event.js";
import { appendDomainEventsToOutbox } from "../../../../events/outbox.event.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { ApplyCopyrightAudioRemedyCommand, CopyrightAudioRemedyResult } from "./applyCopyrightAudioRemedy.command.js";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const mediaIdsPerEvent = 500;
const emptyResult: CopyrightAudioRemedyResult = { soundId: null, postIds: [], mediaIds: [] };

export const clipAudioEventTypes = { muteRequested: "clipAudio.muteRequested", restoreRequested: "clipAudio.restoreRequested" } as const;

export function chunkMediaIdsForEvents(mediaIds: readonly string[], size = mediaIdsPerEvent): string[][] {
  const chunks: string[][] = [];
  for (let start = 0; start < mediaIds.length; start += size) chunks.push(mediaIds.slice(start, start + size));
  return chunks;
}

export function createApplyCopyrightAudioRemedyHandler(context: HandlerContext): Handler<ApplyCopyrightAudioRemedyCommand, CopyrightAudioRemedyResult> {
  return async ({ claimId, targetType, targetId, mode, occurredAt }) => {
    if (!uuidPattern.test(targetId)) return emptyResult;
    return context.database.client.$transaction(async (db) => {
      const postIds = new Set<string>();
      let soundId: string | null = null;
      if (targetType === "sound") soundId = targetId;
      else if (targetType === "clip" || targetType === "post") {
        const post = await db.post.findUnique({ where: { id: targetId }, select: { id: true, soundId: true } });
        if (post === null) return emptyResult;
        postIds.add(post.id);
        soundId = post.soundId;
      } else return emptyResult;
      if (soundId !== null) {
        await db.sound.updateMany({ where: { id: soundId }, data: mode === "mute" ? { status: "removed", allowReuse: false } : { status: "available", allowReuse: true } });
        for (const row of await db.post.findMany({ where: { soundId }, select: { id: true } })) postIds.add(row.id);
        await appendDomainEventsToOutbox(db, [{ eventType: socialEventTypes.soundUpdated, subject: soundId, occurredAt, data: { soundId, copyrightAudio: mode === "mute" ? "disabled" : "available", claimId } }]);
      }
      const media = await db.postMedia.findMany({ where: { postId: { in: [...postIds] }, type: "video" }, select: { mediaId: true } });
      const mediaIds = [...new Set(media.map((row) => row.mediaId))];
      const eventType = mode === "mute" ? clipAudioEventTypes.muteRequested : clipAudioEventTypes.restoreRequested;
      await appendDomainEventsToOutbox(db, chunkMediaIdsForEvents(mediaIds).map((chunk) => ({ eventType, subject: claimId, occurredAt, data: { claimId, soundId, targetType, targetId, mediaIds: chunk } })));
      return { soundId, postIds: [...postIds], mediaIds };
    });
  };
}

import { socialEventTypes } from "../../../../events/eventTypes.event.js";
import { appendDomainEventsToOutbox } from "../../../../events/outbox.event.js";
import type { SoundStatus } from "../../../../generated/prisma/client.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { ApplyContentVisibilityCommand, ModerationVisibilityValue } from "./applyContentVisibility.command.js";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function soundStatusForVisibility(visibility: ModerationVisibilityValue): SoundStatus {
  return visibility === "visible" || visibility === "restricted" ? "available" : "removed";
}

export function createApplyContentVisibilityHandler(context: HandlerContext): Handler<ApplyContentVisibilityCommand, boolean> {
  return async ({ targetType, targetId, visibility, occurredAt }) => {
    if (!uuidPattern.test(targetId)) return false;
    return context.database.client.$transaction(async (db) => {
      if (targetType === "post" || targetType === "clip") {
        const updated = await db.post.updateMany({ where: { id: targetId }, data: { moderationVisibility: visibility } });
        if (updated.count === 0) return false;
        const post = await db.post.findUniqueOrThrow({ where: { id: targetId }, select: { authorId: true, kind: true } });
        await appendDomainEventsToOutbox(db, [{ eventType: socialEventTypes.postUpdated, subject: targetId, occurredAt, data: { postId: targetId, authorId: post.authorId, kind: post.kind, moderationVisibility: visibility } }]);
        return true;
      }
      if (targetType === "comment") {
        return (await db.comment.updateMany({ where: { id: targetId }, data: { moderationVisibility: visibility } })).count > 0;
      }
      if (targetType === "sound") {
        const updated = await db.sound.updateMany({ where: { id: targetId, status: { not: "under_copyright_review" } }, data: { status: soundStatusForVisibility(visibility) } });
        if (updated.count === 0) return false;
        await appendDomainEventsToOutbox(db, [{ eventType: socialEventTypes.soundUpdated, subject: targetId, occurredAt, data: { soundId: targetId, moderationVisibility: visibility } }]);
        return true;
      }
      return false;
    });
  };
}

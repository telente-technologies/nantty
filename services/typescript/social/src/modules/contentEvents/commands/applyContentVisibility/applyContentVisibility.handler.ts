import { socialEventTypes } from "../../../../events/eventTypes.event.js";
import { appendDomainEventsToOutbox } from "../../../../events/outbox.event.js";
import { viewableModerationVisibilities } from "../../../../constants/moderation.constant.js";
import { commentRepository } from "../../../comments/repositories/comment.repository.js";
import { postRepository } from "../../../posts/repositories/post.repository.js";
import { messageRepository } from "../../../messages/repositories/message.repository.js";
import { activeMemberIds, messageRemovedEvent, messageUpdatedEvent } from "../../../messages/services/chatRealtimeEvents.service.js";
import type { SoundStatus } from "../../../../generated/prisma/client.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { ApplyContentVisibilityCommand, ModerationVisibilityValue } from "./applyContentVisibility.command.js";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isShownToViewers = (visibility: ModerationVisibilityValue): boolean => (viewableModerationVisibilities as readonly string[]).includes(visibility);

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
        if (!isShownToViewers(visibility)) await postRepository.clearProfilePin(db, targetId);
        const post = await db.post.findUniqueOrThrow({ where: { id: targetId }, select: { authorId: true, kind: true } });
        await appendDomainEventsToOutbox(db, [{ eventType: socialEventTypes.postUpdated, subject: targetId, occurredAt, data: { postId: targetId, authorId: post.authorId, kind: post.kind, moderationVisibility: visibility } }]);
        return true;
      }
      if (targetType === "comment") {
        if ((await db.comment.updateMany({ where: { id: targetId }, data: { moderationVisibility: visibility } })).count === 0) return false;
        if (!isShownToViewers(visibility)) await commentRepository.clearPins(db, [targetId]);
        return true;
      }
      if (targetType === "message") {
        const hiddenAt = visibility === "hidden" || visibility === "removed" ? occurredAt : null;
        if ((await db.message.updateMany({ where: { id: targetId }, data: { hiddenAt } })).count === 0) return false;
        const row = await messageRepository.findById(db, targetId, targetId);
        if (row === null) return true;
        const memberIds = await activeMemberIds(db, row.conversationId);
        await appendDomainEventsToOutbox(db, [hiddenAt === null ? messageUpdatedEvent(row, memberIds, occurredAt) : messageRemovedEvent(row.conversationId, row.id, "moderation", memberIds, occurredAt)]);
        return true;
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

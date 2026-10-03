import { socialEventTypes } from "../../../../events/eventTypes.event.js";
import { appendDomainEventsToOutbox } from "../../../../events/outbox.event.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { ConversationView } from "../../models/conversation.model.js";
import { conversationRepository } from "../../repositories/conversation.repository.js";
import { loadConversationViewForMember } from "../../services/conversationViewById.service.js";
import { resolveAddableMemberIds } from "../../services/groupMembers.service.js";
import type { CreateGroupConversationCommand } from "./createGroupConversation.command.js";

export function createCreateGroupConversationHandler(context: HandlerContext): Handler<CreateGroupConversationCommand, ConversationView> {
  return async ({ creatorId, name, photoMediaId, memberIds }) => {
    const addable = await resolveAddableMemberIds(context, creatorId, memberIds, [creatorId]);
    const now = context.clock.now();
    const conversation = await context.database.transaction(async (transaction) => {
      const created = await conversationRepository.create(transaction, { kind: "group", title: name.trim(), createdById: creatorId, lastMessageAt: now, createdAt: now, ...(photoMediaId === undefined ? {} : { photoMediaId }) }, [
        { accountId: creatorId, role: "owner", inboxFolder: "chats" },
        ...addable.map((accountId) => ({ accountId, role: "member" as const, inboxFolder: "chats" as const })),
      ]);
      await appendDomainEventsToOutbox(transaction, [{ eventType: socialEventTypes.conversationCreated, subject: created.id, occurredAt: now, data: { conversationId: created.id, kind: "group", createdBy: creatorId, memberIds: [creatorId, ...addable] } }]);
      return created;
    });
    return loadConversationViewForMember(context, conversation.id, creatorId);
  };
}

import { forbidden, notFound, unprocessable } from "../../../../errors/social.error.js";
import { socialEventTypes } from "../../../../events/eventTypes.event.js";
import { appendDomainEventsToOutbox } from "../../../../events/outbox.event.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { blockRepository } from "../../../blocks/repositories/block.repository.js";
import { chatSettingsRepository } from "../../../chatSettings/repositories/chatSettings.repository.js";
import { toChatSettingsView } from "../../../chatSettings/models/chatSettingsView.model.js";
import { followRepository } from "../../../follows/repositories/follow.repository.js";
import type { ConversationView } from "../../models/conversation.model.js";
import { buildDirectKey, conversationRepository } from "../../repositories/conversation.repository.js";
import { loadConversationViewForMember } from "../../services/conversationViewById.service.js";
import { decideMessageRouting } from "../../services/messageRequestRules.service.js";
import { registerNewRecipientAndEvaluate } from "../../services/senderBehaviour.service.js";
import type { StartDirectConversationCommand } from "./startDirectConversation.command.js";

export function createStartDirectConversationHandler(context: HandlerContext): Handler<StartDirectConversationCommand, ConversationView> {
  return async ({ senderId, peerId }) => {
    if (senderId === peerId) throw unprocessable("CANNOT_MESSAGE_SELF", "You can't message yourself.");
    const db = context.database.client;
    if (!(await context.directory.findUserSummaries([peerId])).has(peerId)) throw notFound("USER_NOT_FOUND", "User not found.");
    const directKey = buildDirectKey(senderId, peerId);
    const existing = await conversationRepository.findDirectByKey(db, directKey);
    if (existing !== null) {
      if (!existing.members.some((member) => member.accountId === senderId)) await conversationRepository.upsertMember(db, existing.id, senderId, "member", "chats");
      return loadConversationViewForMember(context, existing.id, senderId);
    }
    const [settings, recipientFollowsSender, senderFollowsRecipient, blockedEitherWay] = await Promise.all([
      chatSettingsRepository.find(db, peerId),
      followRepository.find(db, peerId, senderId),
      followRepository.find(db, senderId, peerId),
      blockRepository.eitherDirection(db, senderId, peerId),
    ]);
    const trusted = recipientFollowsSender?.state === "accepted";
    const spam = trusted || blockedEitherWay ? { spam: false, reason: null } : await registerNewRecipientAndEvaluate(context, senderId);
    const decision = decideMessageRouting({
      audience: toChatSettingsView(settings).messageRequestsFrom,
      recipientFollowsSender: trusted,
      senderFollowsRecipient: senderFollowsRecipient?.state === "accepted",
      blockedEitherWay,
      senderFlaggedAsSpam: spam.spam,
    });
    if (decision.kind === "refused") {
      throw forbidden(decision.reason === "BLOCKED" ? "MESSAGE_NOT_ALLOWED" : "MESSAGE_REQUESTS_CLOSED", decision.reason === "BLOCKED" ? "You can't message this account." : "This account isn't accepting message requests from you.");
    }
    const now = context.clock.now();
    const created = await context.database.transaction(async (transaction) => {
      const conversation = await conversationRepository.create(transaction, { kind: "direct", directKey, createdById: senderId, lastMessageAt: now, createdAt: now }, [
        { accountId: senderId, role: "member", inboxFolder: "chats" },
        { accountId: peerId, role: "member", inboxFolder: decision.folder, spamReason: decision.folder === "spam" ? spam.reason : null },
      ]);
      await appendDomainEventsToOutbox(transaction, [{ eventType: socialEventTypes.conversationCreated, subject: conversation.id, occurredAt: now, data: { conversationId: conversation.id, kind: "direct", createdBy: senderId, memberIds: [senderId, peerId], recipientFolder: decision.folder } }]);
      return conversation;
    });
    return loadConversationViewForMember(context, created.id, senderId);
  };
}

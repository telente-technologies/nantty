import { badRequest, notFound } from "../../../../errors/social.error.js";
import { appendDomainEventsToOutbox } from "../../../../events/outbox.event.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { applyMessageDelivery } from "../../../messages/services/messageDelivery.service.js";
import { messageRepository } from "../../../messages/repositories/message.repository.js";
import { storePlaintextProtocol, type StoreMessageView } from "../../models/storeInbox.model.js";
import { storeInboxRepository } from "../../repositories/storeInbox.repository.js";
import { buildStoreMessageView, buyerIdOf, cleanStoreMessageBody } from "../../services/storeInboxView.service.js";
import type { SendStoreMessageCommand } from "./sendStoreMessage.command.js";

export function createSendStoreMessageHandler(context: HandlerContext): Handler<SendStoreMessageCommand, StoreMessageView> {
  return async (command) => {
    const db = context.database.client;
    const conversation = await storeInboxRepository.findForStore(db, command.storeId, command.conversationId);
    if (conversation === null) throw notFound("CONVERSATION_NOT_FOUND", "That conversation could not be found.");
    if (command.senderId !== command.storeId && buyerIdOf(conversation, command.storeId) !== command.senderId) throw notFound("CONVERSATION_NOT_FOUND", "That conversation could not be found.");
    const body = cleanStoreMessageBody(command.body);
    if (body === "") throw badRequest("VALIDATION_FAILED", "Write a message.");
    const now = context.clock.now();
    const created = await context.database.transaction(async (transaction) => {
      const priorMessageCount = await transaction.message.count({ where: { conversationId: conversation.id } });
      const message = await messageRepository.create(transaction, {
        conversationId: conversation.id, senderId: command.senderId, kind: "text", createdAt: now, protocol: storePlaintextProtocol, ciphertext: body, senderLabel: command.senderLabel,
      }, []);
      const envelope = { id: message.id, conversationId: conversation.id, senderId: message.senderId, kind: message.kind, createdAt: now.toISOString(), encryption: { deviceId: null, ciphertext: body, protocol: storePlaintextProtocol }, mentions: [] };
      await appendDomainEventsToOutbox(transaction, await applyMessageDelivery(transaction, {
        conversation, message, mentions: { entities: [], userIdsToNotify: [], mentionsAll: false }, isNewConversation: priorMessageCount === 0, now, messageEnvelope: envelope,
        actor: { id: command.senderId, name: command.actorName },
      }));
      return message;
    });
    return buildStoreMessageView({ ...created, senderLabel: command.senderLabel }, command.storeId, command.actorName);
  };
}

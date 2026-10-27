import { forbidden, notFound, unprocessable } from "../../../../errors/social.error.js";
import { appendDomainEventsToOutbox } from "../../../../events/outbox.event.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { isUniqueConstraintViolationError } from "../../../../utils/prismaError.util.js";
import { resolveEncryptionRecipients } from "../../../conversations/services/encryptionRecipients.service.js";
import { deviceKeyRepository } from "../../../messagingKeys/repositories/deviceKey.repository.js";
import { messageRepository, type MessageRow } from "../../../messages/repositories/message.repository.js";
import { verifyChatMediaOwnership } from "../../../messages/services/chatMediaOwnership.service.js";
import { applyMessageDelivery } from "../../../messages/services/messageDelivery.service.js";
import { validateOutgoingMessage } from "../../../messages/services/messageValidation.service.js";
import type { StoreMessageView } from "../../models/storeInbox.model.js";
import { storeInboxRepository } from "../../repositories/storeInbox.repository.js";
import { buildStoreMessageViews, buyerIdOf } from "../../services/storeInboxView.service.js";
import type { SendStoreMessageCommand } from "./sendStoreMessage.command.js";

export function createSendStoreMessageHandler(context: HandlerContext): Handler<SendStoreMessageCommand, StoreMessageView> {
  return async (command) => {
    const db = context.database.client;
    const conversation = await storeInboxRepository.findForStore(db, command.storeId, command.conversationId);
    if (conversation === null) throw notFound("CONVERSATION_NOT_FOUND", "That conversation could not be found.");
    const buyerId = buyerIdOf(conversation, command.storeId);
    const customerName = (await context.directory.findUserSummaries([buyerId])).get(buyerId)?.name ?? "Nantty user";
    const view = async (row: MessageRow) => (await buildStoreMessageViews(context, command.senderAccountId, [row], buyerId, customerName))[0] as StoreMessageView;
    if (command.idempotencyKey !== undefined) {
      const existing = await messageRepository.findByClientId(db, conversation.id, command.senderAccountId, command.idempotencyKey);
      if (existing !== null) return view(existing);
    }
    const now = context.clock.now();
    const validated = validateOutgoingMessage(command.message, now);
    const storeTeamIds = (await resolveEncryptionRecipients(context, conversation)).storeTeamUserIds;
    if (!storeTeamIds.includes(command.senderAccountId)) throw forbidden("NOT_STORE_INBOX_MEMBER", "You don't have access to this store's messages.");
    if ((await deviceKeyRepository.find(db, command.senderAccountId, validated.deviceId)) === null) throw forbidden("DEVICE_NOT_REGISTERED", "This device is not registered for secure chat. Sign in again on this device.");
    if (validated.kind === "control" && (await db.message.count({ where: { conversationId: conversation.id, kind: { not: "control" } } })) === 0) throw unprocessable("NOTHING_TO_UPDATE", "There's no message here to react to or update yet.");
    const media = validated.media === undefined ? undefined : await verifyChatMediaOwnership(context.chatMedia, command.senderAccountId, validated.kind, validated.media.mediaId);
    const duration = media?.durationSeconds ?? validated.media?.durationSeconds;
    const expiresAt = conversation.disappearingMessagesSeconds ? new Date(now.getTime() + conversation.disappearingMessagesSeconds * 1000) : null;
    try {
      const created = await context.database.transaction(async (transaction) => {
        const message = await messageRepository.create(transaction, {
          conversationId: conversation.id, senderId: command.senderAccountId, senderLabel: command.senderLabel, kind: validated.kind, createdAt: now, expiresAt,
          protocol: validated.protocol, ciphertext: validated.ciphertext, deviceId: validated.deviceId,
          ...(command.idempotencyKey === undefined ? {} : { clientMessageId: command.idempotencyKey }),
          ...(media === undefined ? {} : { mediaId: media.mediaId, mediaStatus: media.ready ? "ready" : "processing", mediaType: validated.mediaType, mediaDurationSeconds: duration === undefined ? null : Math.round(duration) }),
          ...(validated.linkPreviewEnvelope === null ? {} : { linkPreviewEnvelope: validated.linkPreviewEnvelope }),
          ...(validated.mediaExpiresAt === null ? {} : { mediaExpiresAt: validated.mediaExpiresAt }),
        });
        const envelope = { id: message.id, conversationId: conversation.id, senderId: message.senderId, kind: message.kind, createdAt: now.toISOString(), encryption: { deviceId: message.deviceId, ciphertext: message.ciphertext, protocol: message.protocol }, linkPreview: message.linkPreviewEnvelope, mentions: [] };
        await appendDomainEventsToOutbox(transaction, await applyMessageDelivery(transaction, {
          conversation, message: { ...message, senderId: command.storeId }, mentions: { entities: [], userIdsToNotify: [], mentionsAll: false }, isNewConversation: false, now, messageEnvelope: envelope,
          actor: { id: command.storeId, name: command.senderLabel }, storeTeamIds,
        }));
        return message;
      });
      return view(created);
    } catch (error) {
      const existing = isUniqueConstraintViolationError(error) && command.idempotencyKey !== undefined ? await messageRepository.findByClientId(db, conversation.id, command.senderAccountId, command.idempotencyKey) : null;
      if (existing === null) throw error;
      return view(existing);
    }
  };
}

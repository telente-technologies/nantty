import { forbidden } from "../../../../errors/social.error.js";
import { resolveEventActor } from "../../../../events/actor.event.js";
import { appendDomainEventsToOutbox } from "../../../../events/outbox.event.js";
import type { Prisma } from "../../../../generated/prisma/client.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { isUniqueConstraintViolationError } from "../../../../utils/prismaError.util.js";
import { blockRepository } from "../../../blocks/repositories/block.repository.js";
import { findDirectPeerId, requireConversationMember } from "../../../conversations/services/conversationAccess.service.js";
import { conversationRepository } from "../../../conversations/repositories/conversation.repository.js";
import { prepareMentionsForWrite } from "../../../mentions/services/mentionWrite.service.js";
import type { MessageView } from "../../models/message.model.js";
import { messageRepository } from "../../repositories/message.repository.js";
import { applyMessageDelivery } from "../../services/messageDelivery.service.js";
import { validateOutgoingMessage } from "../../services/messageValidation.service.js";
import { buildMessageViews } from "../../services/messageView.service.js";
import type { SendMessageCommand } from "./sendMessage.command.js";

export function createSendMessageHandler(context: HandlerContext): Handler<SendMessageCommand, MessageView> {
  return async (command) => {
    const db = context.database.client;
    const { conversation, member } = await requireConversationMember(db, command.conversationId, command.senderId);
    const now = context.clock.now();
    const peerId = findDirectPeerId(conversation, command.senderId);
    if (peerId !== undefined && (await blockRepository.eitherDirection(db, command.senderId, peerId))) throw forbidden("MESSAGE_NOT_ALLOWED", "You can't message this account.");
    if (command.idempotencyKey !== undefined) {
      const existing = await messageRepository.findByClientId(db, conversation.id, command.senderId, command.idempotencyKey);
      if (existing !== null) return (await buildMessageViews(context, command.senderId, [existing], { peerLastReadAt: null, isDirect: peerId !== undefined }))[0] as MessageView;
    }
    const validated = validateOutgoingMessage(command.message, now);
    const mentions = await prepareMentionsForWrite(context, {
      surface: conversation.kind === "direct" ? "direct" : "group", authorId: command.senderId, text: null, entities: command.mentions,
      group: conversation.kind === "direct" ? undefined : { memberIds: new Set(conversation.members.map((candidate) => candidate.accountId)), authorRole: member.role === "subscriber" ? "member" : member.role, onlyAdminsCanMentionAll: conversation.onlyAdminsCanMentionAll },
    });
    const actor = await resolveEventActor(context.directory, command.senderId);
    const expiresAt = conversation.disappearingMessagesSeconds === null || conversation.disappearingMessagesSeconds === 0 ? null : new Date(now.getTime() + conversation.disappearingMessagesSeconds * 1000);
    try {
      const created = await context.database.transaction(async (transaction) => {
        const priorMessageCount = await transaction.message.count({ where: { conversationId: conversation.id } });
        const peerMember = peerId === undefined ? null : await transaction.conversationMember.findUnique({ where: { conversationId_accountId: { conversationId: conversation.id, accountId: peerId } } });
        if (peerMember !== null && peerMember.leftAt !== null) await conversationRepository.upsertMember(transaction, conversation.id, peerId as string, "member", "requests");
        const message = await messageRepository.create(transaction, {
          conversationId: conversation.id, senderId: command.senderId, kind: validated.kind, createdAt: now, expiresAt,
          mentions: mentions.entities as unknown as Prisma.InputJsonValue, protocol: validated.protocol,
          ...(command.idempotencyKey === undefined ? {} : { clientMessageId: command.idempotencyKey }),
          ...(validated.ciphertext === null ? {} : { ciphertext: validated.ciphertext }),
          ...(validated.deviceId === null ? {} : { deviceId: validated.deviceId }),
          ...(validated.media === undefined ? {} : { mediaId: validated.media.mediaId, mediaUrl: validated.media.url ?? null, mediaDurationSeconds: validated.media.durationSeconds === undefined ? null : Math.round(validated.media.durationSeconds), mediaType: validated.mediaType }),
          ...(validated.linkPreviewEnvelope === null ? {} : { linkPreviewEnvelope: validated.linkPreviewEnvelope }),
          ...(validated.sharedContent === null ? {} : { sharedContent: validated.sharedContent as unknown as Prisma.InputJsonValue }),
          ...(validated.location === null ? {} : { location: validated.location as unknown as Prisma.InputJsonValue }),
          ...(validated.document === null ? {} : { document: validated.document as unknown as Prisma.InputJsonValue }),
          ...(validated.mediaExpiresAt === null ? {} : { mediaExpiresAt: validated.mediaExpiresAt }),
          ...(validated.poll === null ? {} : { pollQuestion: validated.poll.question, pollAllowMultiple: validated.poll.allowMultipleAnswers }),
        }, validated.poll?.options ?? []);
        const envelope = { id: message.id, conversationId: message.conversationId, senderId: message.senderId, kind: message.kind, createdAt: message.createdAt.toISOString(), encryption: { deviceId: message.deviceId, ciphertext: message.ciphertext, protocol: message.protocol }, mentions: mentions.entities };
        await appendDomainEventsToOutbox(transaction, await applyMessageDelivery(transaction, { conversation, message, mentions, isNewConversation: priorMessageCount === 0, now, messageEnvelope: envelope, actor }));
        return message.id;
      });
      const row = await messageRepository.findById(db, created, command.senderId);
      return (await buildMessageViews(context, command.senderId, [row as NonNullable<typeof row>], { peerLastReadAt: null, isDirect: peerId !== undefined }))[0] as MessageView;
    } catch (error) {
      if (!isUniqueConstraintViolationError(error) || command.idempotencyKey === undefined) throw error;
      const existing = await messageRepository.findByClientId(db, conversation.id, command.senderId, command.idempotencyKey);
      if (existing === null) throw error;
      return (await buildMessageViews(context, command.senderId, [existing], { peerLastReadAt: null, isDirect: peerId !== undefined }))[0] as MessageView;
    }
  };
}

import { forbidden, unprocessable } from "../../../../errors/social.error.js";
import { resolveEventActor } from "../../../../events/actor.event.js";
import { appendDomainEventsToOutbox } from "../../../../events/outbox.event.js";
import type { Prisma } from "../../../../generated/prisma/client.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { isUniqueConstraintViolationError } from "../../../../utils/prismaError.util.js";
import { blockRepository } from "../../../blocks/repositories/block.repository.js";
import { findDirectPeerId, requireConversationMember } from "../../../conversations/services/conversationAccess.service.js";
import { conversationRepository } from "../../../conversations/repositories/conversation.repository.js";
import { prepareMentionsForWrite } from "../../../mentions/services/mentionWrite.service.js";
import { deviceKeyRepository } from "../../../messagingKeys/repositories/deviceKey.repository.js";
import type { MessageView } from "../../models/message.model.js";
import { messageRepository } from "../../repositories/message.repository.js";
import { applyMessageDelivery } from "../../services/messageDelivery.service.js";
import { storeTeamAudience } from "../../../storeInbox/services/storeInboxAudience.service.js";
import { verifyChatMediaOwnership } from "../../services/chatMediaOwnership.service.js";
import { validateOutgoingMessage } from "../../services/messageValidation.service.js";
import { buildMessageViews } from "../../services/messageView.service.js";
import type { SendMessageCommand } from "./sendMessage.command.js";

export function createSendMessageHandler(context: HandlerContext): Handler<SendMessageCommand, MessageView> {
  return async (command) => {
    const db = context.database.client;
    const { conversation, member } = await requireConversationMember(db, command.conversationId, command.senderId);
    if (conversation.kind === "channel" && member.role !== "owner" && member.role !== "admin") throw forbidden("CHANNEL_READ_ONLY", "Only channel admins can post here.");
    const now = context.clock.now();
    const peerId = findDirectPeerId(conversation, command.senderId);
    if (peerId !== undefined && (await blockRepository.eitherDirection(db, command.senderId, peerId))) throw forbidden("MESSAGE_NOT_ALLOWED", "You can't message this account.");
    if (command.idempotencyKey !== undefined) {
      const existing = await messageRepository.findByClientId(db, conversation.id, command.senderId, command.idempotencyKey);
      if (existing !== null) return (await buildMessageViews(context, command.senderId, [existing], { peerLastReadAt: null, isDirect: peerId !== undefined }))[0] as MessageView;
    }
    const validated = validateOutgoingMessage(command.message, now);
    if (validated.kind === "control" && (command.mentions?.length ?? 0) > 0) throw unprocessable("MENTIONS_NOT_ALLOWED", "Control messages can't mention anyone.");
    if ((await deviceKeyRepository.find(db, command.senderId, validated.deviceId)) === null) {
      throw forbidden("DEVICE_NOT_REGISTERED", "This device is not registered for secure chat. Sign in again on this device.");
    }
    const verifiedMedia = validated.media === undefined ? undefined : await verifyChatMediaOwnership(context.chatMedia, command.senderId, validated.kind, validated.media.mediaId);
    const mediaDuration = verifiedMedia?.durationSeconds ?? validated.media?.durationSeconds;
    const mentions = await prepareMentionsForWrite(context, {
      surface: conversation.kind === "direct" ? "direct" : "group", authorId: command.senderId, text: null, entities: command.mentions,
      group: conversation.kind === "direct" ? undefined : { memberIds: new Set(conversation.members.map((candidate) => candidate.accountId)), authorRole: member.role === "subscriber" ? "member" : member.role, onlyAdminsCanMentionAll: conversation.onlyAdminsCanMentionAll },
    });
    const actor = await resolveEventActor(context.directory, command.senderId);
    const storeTeamIds = await storeTeamAudience(context, conversation);
    const expiresAt = conversation.disappearingMessagesSeconds === null || conversation.disappearingMessagesSeconds === 0 ? null : new Date(now.getTime() + conversation.disappearingMessagesSeconds * 1000);
    try {
      const created = await context.database.transaction(async (transaction) => {
        const priorMessageCount = await transaction.message.count({ where: { conversationId: conversation.id, kind: { not: "control" } } });
        const peerMember = peerId === undefined ? null : await transaction.conversationMember.findUnique({ where: { conversationId_accountId: { conversationId: conversation.id, accountId: peerId } } });
        if (validated.kind === "control" && priorMessageCount === 0) throw unprocessable("NOTHING_TO_UPDATE", "There's no message here to react to or update yet.");
        if (validated.kind !== "control" && peerMember !== null && peerMember.leftAt !== null) await conversationRepository.upsertMember(transaction, conversation.id, peerId as string, "member", "requests");
        const message = await messageRepository.create(transaction, {
          conversationId: conversation.id, senderId: command.senderId, kind: validated.kind, createdAt: now, expiresAt,
          mentions: mentions.entities as unknown as Prisma.InputJsonValue, protocol: validated.protocol,
          ...(command.idempotencyKey === undefined ? {} : { clientMessageId: command.idempotencyKey }),
          ciphertext: validated.ciphertext, deviceId: validated.deviceId,
          ...(verifiedMedia === undefined ? {} : { mediaId: verifiedMedia.mediaId, mediaUrl: null, mediaStatus: verifiedMedia.ready ? "ready" : "processing", mediaDurationSeconds: mediaDuration === undefined ? null : Math.round(mediaDuration), mediaType: validated.mediaType }),
          ...(validated.linkPreviewEnvelope === null ? {} : { linkPreviewEnvelope: validated.linkPreviewEnvelope }),
          ...(validated.mediaExpiresAt === null ? {} : { mediaExpiresAt: validated.mediaExpiresAt }),
        });
        const envelope = { id: message.id, conversationId: message.conversationId, senderId: message.senderId, kind: message.kind, createdAt: message.createdAt.toISOString(), encryption: { deviceId: message.deviceId, ciphertext: message.ciphertext, protocol: message.protocol }, linkPreview: message.linkPreviewEnvelope, mentions: mentions.entities };
        await appendDomainEventsToOutbox(transaction, await applyMessageDelivery(transaction, { conversation, message, mentions, isNewConversation: priorMessageCount === 0, now, messageEnvelope: envelope, actor, storeTeamIds }));
        return message.id;
      });
      const row = await messageRepository.findById(db, created);
      return (await buildMessageViews(context, command.senderId, [row as NonNullable<typeof row>], { peerLastReadAt: null, isDirect: peerId !== undefined }))[0] as MessageView;
    } catch (error) {
      if (!isUniqueConstraintViolationError(error) || command.idempotencyKey === undefined) throw error;
      const existing = await messageRepository.findByClientId(db, conversation.id, command.senderId, command.idempotencyKey);
      if (existing === null) throw error;
      return (await buildMessageViews(context, command.senderId, [existing], { peerLastReadAt: null, isDirect: peerId !== undefined }))[0] as MessageView;
    }
  };
}

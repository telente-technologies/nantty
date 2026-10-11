import { socialEventTypes } from "../../../events/eventTypes.event.js";
import type { DomainEventInput } from "../../../events/outbox.event.js";
import type { Message } from "../../../generated/prisma/client.js";
import type { Db } from "../../../types/database.type.js";
import type { MentionPolicyResult } from "../../mentions/services/mentionPolicy.service.js";
import type { ConversationRow } from "../../conversations/repositories/conversation.repository.js";
import { conversationRepository } from "../../conversations/repositories/conversation.repository.js";
import { chatSettingsRepository } from "../../chatSettings/repositories/chatSettings.repository.js";
import { recordDirectSendForStreak } from "../../streaks/services/streakTracking.service.js";

export interface DeliveryRequest {
  readonly conversation: ConversationRow;
  readonly message: Message;
  readonly mentions: MentionPolicyResult;
  readonly isNewConversation: boolean;
  readonly now: Date;
  readonly messageEnvelope: unknown;
  readonly actor: { readonly id: string; readonly name: string };
  readonly storeTeamIds?: readonly string[];
}

export async function applyMessageDelivery(db: Db, request: DeliveryRequest): Promise<DomainEventInput[]> {
  const { conversation, message, now } = request;
  const senderId = message.senderId;
  const teamAudience = request.storeTeamIds !== undefined && request.storeTeamIds.length > 0 ? { memberIds: [...request.storeTeamIds] } : {};
  const recipientIdsForControl = conversation.members.filter((member) => member.accountId !== senderId).map((member) => member.accountId);
  if (message.kind === "control") {
    return [{ eventType: socialEventTypes.messageCreated, subject: conversation.id, occurredAt: now, data: { conversationId: conversation.id, message: request.messageEnvelope as never, recipientIds: recipientIdsForControl, ...teamAudience } }];
  }
  await conversationRepository.touchLastMessage(db, conversation.id, message.kind, now);
  await conversationRepository.incrementUnreadForOthers(db, conversation.id, senderId);
  const recipients = conversation.members.filter((member) => member.accountId !== senderId);
  const events: DomainEventInput[] = [];
  const bothInChats = conversation.kind === "direct" && conversation.members.every((member) => member.inboxFolder === "chats");
  if (bothInChats && recipients[0] !== undefined) events.push(...(await recordDirectSendForStreak(db, conversation.id, senderId, recipients[0].accountId, now)));
  const recipientIds = recipients.map((member) => member.accountId);
  const pushRecipients = await selectPushRecipients(db, conversation, recipients, now);
  events.push({
    eventType: socialEventTypes.messageSent,
    subject: conversation.id,
    occurredAt: now,
    data: {
      conversationId: conversation.id, messageId: message.id, senderId, kind: message.kind, recipientIds, isNewConversation: request.isNewConversation,
      inboxFolderByRecipient: Object.fromEntries(recipients.map((member) => [member.accountId, member.inboxFolder])), sentAt: message.createdAt.toISOString(),
      conversationKind: conversation.kind, conversationTitle: conversation.kind === "group" ? null : (conversation.title ?? null), senderName: request.actor.name, pushRecipients,
    },
  });
  events.push({ eventType: socialEventTypes.messageCreated, subject: conversation.id, occurredAt: now, data: { conversationId: conversation.id, message: request.messageEnvelope as never, recipientIds, ...teamAudience } });
  const actor = request.actor;
  if (request.isNewConversation) {
    for (const member of recipients.filter((candidate) => candidate.inboxFolder === "requests")) {
      events.push({ eventType: socialEventTypes.messageRequestReceived, subject: conversation.id, occurredAt: now, data: { recipientUserId: member.accountId, actor, url: `/chats/requests/${conversation.id}`, conversationId: conversation.id } });
    }
  }
  if (conversation.kind !== "direct") {
    for (const userId of request.mentions.userIdsToNotify) {
      events.push({ eventType: socialEventTypes.mentionCreated, subject: message.id, occurredAt: now, data: { recipientUserId: userId, mentionedUserId: userId, actor, authorId: senderId, surface: "group", conversationId: conversation.id, excerpt: "", url: `/chats/${conversation.id}` } });
    }
    if (request.mentions.mentionsAll) {
      for (const recipientUserId of recipientIds) events.push({ eventType: socialEventTypes.mentionCreated, subject: message.id, occurredAt: now, data: { recipientUserId, actor, authorId: senderId, surface: "group", conversationId: conversation.id, excerpt: "", url: `/chats/${conversation.id}`, mentionedEveryone: true } });
    }
  }
  return events;
}

type Member = ConversationRow["members"][number];

async function selectPushRecipients(db: Db, conversation: ConversationRow, recipients: readonly Member[], now: Date): Promise<{ readonly userId: string; readonly showPreview: boolean }[]> {
  const audible = recipients.filter((member) => member.inboxFolder === "chats" && !member.mutedAlways && (member.mutedUntil === null || member.mutedUntil <= now));
  if (audible.length === 0) return [];
  const settings = new Map((await chatSettingsRepository.findMany(db, audible.map((member) => member.accountId))).map((row) => [row.accountId, row]));
  return audible.flatMap((member) => {
    const row = settings.get(member.accountId);
    const wanted = row === undefined || (conversation.kind === "direct" || conversation.kind === "business" ? row.notifyMessages : row.notifyGroups);
    return wanted ? [{ userId: member.accountId, showPreview: row?.showMessagePreview ?? true }] : [];
  });
}

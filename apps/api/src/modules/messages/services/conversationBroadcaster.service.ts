import { NotificationRequestedEvent } from "../../../events/notificationRequested.event.js";
import { publishEvent } from "../../../loaders/events.loader.js";
import { describeMessagePreview } from "../dtos/messages.dto.js";
import { MessageSentEvent } from "../events/messageSent.event.js";
import { SYSTEM_SENDER_ID, type ConversationRecord, type MessageRecord } from "../models/messages.model.js";
import { summarizeReactions } from "./messagePresenter.service.js";
import type { MessagesService } from "./messages.service.js";

const NOTIFICATION_PREVIEW_LENGTH = 80;
const MAXIMUM_PERSONALISED_UPDATES = 200;

export class ConversationBroadcaster {
  public constructor(private readonly messagesService: MessagesService) {}

  public async postSystemNotice(conversation: ConversationRecord, text: string): Promise<MessageRecord> {
    const { messages, conversations, clock } = this.messagesService.dependencies;
    const now = clock.now();
    const notice = await messages.appendMessage(
      {
        conversationId: conversation.id,
        senderId: SYSTEM_SENDER_ID,
        senderStoreId: null,
        kind: "system",
        text,
        media: [],
        voiceMediaId: null,
        voiceDurationSeconds: null,
        expiresAt: conversation.disappearingMessagesSeconds === null ? null : new Date(now.getTime() + conversation.disappearingMessagesSeconds * 1000),
      },
      now,
    );
    await conversations.touchLastMessageAt(conversation.id, now);
    await this.announceNewMessage(conversation, notice, []);
    return notice;
  }

  public async announceNewMessage(conversation: ConversationRecord, message: MessageRecord, notifyUserIds: readonly string[]): Promise<void> {
    const { realtime, events, userDirectory } = this.messagesService.dependencies;
    const audience = await this.messagesService.listAudienceUserIds(conversation);
    const [dto] = await this.messagesService.messagePresenter.presentMessages([message], message.senderId);
    for (const userId of audience) realtime.publishToUser(userId, { type: "message.created", message: dto });
    if (notifyUserIds.length === 0) return;
    const [sender] = await userDirectory.findUserSummaries([message.senderId]);
    const senderName = dto?.senderStore?.name ?? (sender === undefined ? "Someone" : sender.name || `@${sender.username}`);
    const where = conversation.title === null ? "" : ` in ${conversation.title}`;
    for (const recipientId of notifyUserIds) {
      await publishEvent(events, NotificationRequestedEvent, {
        userId: recipientId,
        category: "messages",
        title: `New message from ${senderName}${where}`,
        body: describeMessagePreview(message.kind, message.text).slice(0, NOTIFICATION_PREVIEW_LENGTH),
        data: { conversationId: conversation.id, messageId: message.id },
      });
    }
    await publishEvent(events, MessageSentEvent, {
      conversationId: conversation.id,
      conversationKind: conversation.kind,
      messageId: message.id,
      senderId: message.senderId,
      recipientIds: notifyUserIds,
    });
  }

  public async announceReactions(conversation: ConversationRecord, messageId: string): Promise<void> {
    const { realtime, messages } = this.messagesService.dependencies;
    const audience = await this.messagesService.listAudienceUserIds(conversation);
    const reactions = await messages.listReactions([messageId]);
    for (const userId of audience.slice(0, MAXIMUM_PERSONALISED_UPDATES)) {
      realtime.publishToUser(userId, { type: "reaction", conversationId: conversation.id, messageId, reactions: summarizeReactions(reactions, userId) });
    }
  }

  public async announceMessageRemoved(conversation: ConversationRecord, messageId: string): Promise<void> {
    const { realtime } = this.messagesService.dependencies;
    const audience = await this.messagesService.listAudienceUserIds(conversation);
    for (const userId of audience) realtime.publishToUser(userId, { type: "message.removed", conversationId: conversation.id, messageId });
  }

  public async announceConversationChanged(conversation: ConversationRecord, extraUserIds: readonly string[] = []): Promise<void> {
    const { realtime } = this.messagesService.dependencies;
    const audience = [...new Set([...(await this.messagesService.listAudienceUserIds(conversation)), ...extraUserIds])].slice(0, MAXIMUM_PERSONALISED_UPDATES);
    for (const userId of audience) {
      const [dto] = await this.messagesService.conversationPresenter.presentConversations([conversation], userId);
      realtime.publishToUser(userId, { type: "conversation.updated", conversation: dto });
    }
  }

  public async announceReadReceipt(conversation: ConversationRecord, readerId: string, readAt: Date): Promise<void> {
    if (conversation.kind === "channel") return;
    const { realtime } = this.messagesService.dependencies;
    const audience = await this.messagesService.listAudienceUserIds(conversation);
    for (const userId of audience) {
      if (userId !== readerId) realtime.publishToUser(userId, { type: "read", conversationId: conversation.id, userId: readerId, readAt: readAt.toISOString() });
    }
  }

  public async relayTypingSignal(conversationId: string, typingUserId: string, isTyping: boolean): Promise<void> {
    const { realtime, userDirectory } = this.messagesService.dependencies;
    const access = await this.messagesService.requireConversationAccess(conversationId, typingUserId);
    if (access.conversation.kind === "channel") return;
    const [user] = await userDirectory.findUserSummaries([typingUserId]);
    if (user === undefined) return;
    const audience = await this.messagesService.listAudienceUserIds(access.conversation);
    for (const userId of audience) {
      if (userId !== typingUserId) realtime.publishToUser(userId, { type: "typing", conversationId, user, isTyping });
    }
  }
}

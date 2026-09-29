import { CommandHandler } from "@zudojs/cqrs";

import { forbidden } from "../../../../errors/domain.error.js";
import { NotificationRequestedEvent } from "../../../../events/notificationRequested.event.js";
import { publishEvent } from "../../../../loaders/events.loader.js";
import { MessageSentEvent } from "../../events/messageSent.event.js";
import type { MessageRecord } from "../../models/messages.model.js";
import type { MessagesService } from "../../services/messages.service.js";
import type { SendMessageCommand } from "./sendMessage.command.js";

const NOTIFICATION_PREVIEW_LENGTH = 80;

export class SendMessageHandler extends CommandHandler<SendMessageCommand, MessageRecord> {
  public readonly commandType = "messages.sendMessage" as const;

  public constructor(private readonly messagesService: MessagesService) {
    super();
  }

  public async execute(command: SendMessageCommand): Promise<MessageRecord> {
    const { messages, socialGraph, userDirectory, events, clock } = this.messagesService.dependencies;
    const senderId = command.principal.userId;
    const conversation = await this.messagesService.requireConversationForParticipant(command.conversationId, senderId);
    const recipientIds = conversation.participantIds.filter((participantId) => participantId !== senderId);
    for (const recipientId of recipientIds) {
      if (await socialGraph.isBlockedEitherWay(senderId, recipientId)) throw forbidden("You cannot message this user.");
    }
    const message = await messages.appendMessage(
      { conversationId: conversation.id, senderId, text: command.input.text.trim(), media: command.input.media ?? [] },
      clock.now(),
    );
    const [sender] = await userDirectory.findUserSummaries([senderId]);
    const senderName = sender === undefined ? "Someone" : sender.name || `@${sender.username}`;
    for (const recipientId of recipientIds) {
      await publishEvent(events, NotificationRequestedEvent, {
        userId: recipientId,
        category: "messages",
        title: `New message from ${senderName}`,
        body: message.text.slice(0, NOTIFICATION_PREVIEW_LENGTH),
        data: { conversationId: conversation.id, messageId: message.id },
      });
    }
    await publishEvent(events, MessageSentEvent, { conversationId: conversation.id, messageId: message.id, senderId, recipientIds });
    return message;
  }
}

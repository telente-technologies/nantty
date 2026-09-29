import { CommandHandler } from "@zudojs/cqrs";

import { notFound, unprocessable } from "../../../../errors/domain.error.js";
import type { MessageDto } from "../../dtos/messages.dto.js";
import type { MessageKind } from "../../models/messages.model.js";
import type { ConversationAccess, MessagesService } from "../../services/messages.service.js";
import type { SendMessageBody } from "../../validators/messages.validator.js";
import type { SendMessageCommand } from "./sendMessage.command.js";

interface VoiceNoteAttachment {
  readonly mediaId: string;
  readonly durationSeconds: number;
}

export class SendMessageHandler extends CommandHandler<SendMessageCommand, MessageDto> {
  public readonly commandType = "messages.sendMessage" as const;

  public constructor(private readonly messagesService: MessagesService) {
    super();
  }

  public async execute(command: SendMessageCommand): Promise<MessageDto> {
    const { messages, conversations, clock } = this.messagesService.dependencies;
    const senderId = command.principal.userId;
    const access = await this.messagesService.requireConversationAccess(command.conversationId, senderId);
    await this.messagesService.assertMayPostMessage(access);
    const voiceNote = await this.findVoiceNoteAttachment(command.input, senderId);
    const text = command.input.text?.trim() ?? "";
    const attachments = command.input.media ?? [];
    if (voiceNote === undefined && text === "" && attachments.length === 0) throw unprocessable("Write a message or attach a voice note.");
    const kind: MessageKind = voiceNote !== undefined ? "voice" : attachments.length > 0 && text === "" ? "image" : "text";
    const now = clock.now();
    const { conversation } = access;
    const message = await messages.appendMessage(
      {
        conversationId: conversation.id,
        senderId,
        senderStoreId: access.actsForStoreId,
        kind,
        text,
        media: attachments,
        voiceMediaId: voiceNote?.mediaId ?? null,
        voiceDurationSeconds: voiceNote?.durationSeconds ?? null,
        expiresAt: conversation.disappearingMessagesSeconds === null ? null : new Date(now.getTime() + conversation.disappearingMessagesSeconds * 1000),
      },
      now,
    );
    await conversations.touchLastMessageAt(conversation.id, now);
    await conversations.markRead(conversation.id, senderId, now);
    const recipients = await this.findRecipientsToNotify(access, senderId);
    await this.messagesService.broadcaster.announceNewMessage(conversation, message, recipients);
    const [dto] = await this.messagesService.messagePresenter.presentMessages([message], senderId);
    if (dto === undefined) throw notFound("Message");
    return dto;
  }

  private async findVoiceNoteAttachment(input: SendMessageBody, senderId: string): Promise<VoiceNoteAttachment | undefined> {
    if (input.kind !== "voice" && input.mediaId === undefined) return undefined;
    if (input.mediaId === undefined || input.durationSeconds === undefined) throw unprocessable("A voice note needs mediaId and durationSeconds.");
    const [media] = await this.messagesService.dependencies.mediaLibrary.findMediaByIds([input.mediaId]);
    const usable = media !== undefined && media.ownerId === senderId && media.purpose === "voice" && media.type === "audio" && media.status !== "failed";
    if (!usable) throw unprocessable("Upload the voice note with purpose \"voice\" before sending it.");
    return { mediaId: input.mediaId, durationSeconds: input.durationSeconds };
  }

  private async findRecipientsToNotify(access: ConversationAccess, senderId: string): Promise<readonly string[]> {
    if (access.conversation.kind === "channel") return [];
    const audience = await this.messagesService.listAudienceUserIds(access.conversation);
    return audience.filter((userId) => userId !== senderId);
  }
}

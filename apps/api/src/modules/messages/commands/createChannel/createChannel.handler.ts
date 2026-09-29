import { CommandHandler } from "@zudojs/cqrs";

import { notFound } from "../../../../errors/domain.error.js";
import type { ConversationDto } from "../../dtos/messages.dto.js";
import type { MessagesService } from "../../services/messages.service.js";
import type { CreateChannelCommand } from "./createChannel.command.js";

export class CreateChannelHandler extends CommandHandler<CreateChannelCommand, ConversationDto> {
  public readonly commandType = "messages.createChannel" as const;

  public constructor(private readonly messagesService: MessagesService) {
    super();
  }

  public async execute(command: CreateChannelCommand): Promise<ConversationDto> {
    const { conversations, clock } = this.messagesService.dependencies;
    const ownerId = command.principal.userId;
    if (command.input.photoMediaId !== undefined) await this.messagesService.assertOwnedImageMedia(command.input.photoMediaId, ownerId);
    const channel = await conversations.createConversation(
      {
        kind: "channel",
        pairKey: null,
        title: command.input.name.trim(),
        description: command.input.description?.trim() ?? "",
        photoMediaId: command.input.photoMediaId ?? null,
        ownerId,
        storeId: null,
        disappearingMessagesSeconds: null,
      },
      [{ userId: ownerId, role: "owner" }],
      clock.now(),
    );
    const [summary] = await this.messagesService.conversationPresenter.presentConversations([channel], ownerId);
    if (summary === undefined) throw notFound("Channel");
    return summary;
  }
}

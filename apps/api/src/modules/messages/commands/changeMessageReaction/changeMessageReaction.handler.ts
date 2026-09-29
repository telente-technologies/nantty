import { CommandHandler } from "@zudojs/cqrs";

import { notFound } from "../../../../errors/domain.error.js";
import type { MessageReactionSummaryDto } from "../../dtos/messages.dto.js";
import { isMessageVisibleAt } from "../../models/messages.model.js";
import { summarizeReactions } from "../../services/messagePresenter.service.js";
import type { MessagesService } from "../../services/messages.service.js";
import type { ChangeMessageReactionCommand } from "./changeMessageReaction.command.js";

export class ChangeMessageReactionHandler extends CommandHandler<ChangeMessageReactionCommand, readonly MessageReactionSummaryDto[]> {
  public readonly commandType = "messages.changeMessageReaction" as const;

  public constructor(private readonly messagesService: MessagesService) {
    super();
  }

  public async execute(command: ChangeMessageReactionCommand): Promise<readonly MessageReactionSummaryDto[]> {
    const { messages, clock } = this.messagesService.dependencies;
    const userId = command.principal.userId;
    const message = await messages.findById(command.messageId);
    if (message === undefined || !isMessageVisibleAt(message, clock.now())) throw notFound("Message");
    const { conversation } = await this.messagesService.requireConversationAccess(message.conversationId, userId);
    if (command.react) await messages.addReaction(message.id, userId, command.emoji, clock.now());
    else await messages.removeReaction(message.id, userId, command.emoji);
    await this.messagesService.broadcaster.announceReactions(conversation, message.id);
    return summarizeReactions(await messages.listReactions([message.id]), userId);
  }
}

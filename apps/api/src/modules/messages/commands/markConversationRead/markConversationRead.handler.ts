import { CommandHandler } from "@zudojs/cqrs";

import type { MessagesService } from "../../services/messages.service.js";
import type { MarkConversationReadCommand } from "./markConversationRead.command.js";

export class MarkConversationReadHandler extends CommandHandler<MarkConversationReadCommand, void> {
  public readonly commandType = "messages.markConversationRead" as const;

  public constructor(private readonly messagesService: MessagesService) {
    super();
  }

  public async execute(command: MarkConversationReadCommand): Promise<void> {
    const { conversations, clock } = this.messagesService.dependencies;
    const access = await this.messagesService.requireConversationAccess(command.conversationId, command.principal.userId);
    if (access.participant === undefined) return;
    const readAt = clock.now();
    await conversations.markRead(access.conversation.id, command.principal.userId, readAt);
    await this.messagesService.broadcaster.announceReadReceipt(access.conversation, command.principal.userId, readAt);
  }
}

import { CommandHandler } from "@zudojs/cqrs";

import type { MessagesService } from "../../services/messages.service.js";
import type { MarkConversationReadCommand } from "./markConversationRead.command.js";

export class MarkConversationReadHandler extends CommandHandler<MarkConversationReadCommand, void> {
  public readonly commandType = "messages.markConversationRead" as const;

  public constructor(private readonly messagesService: MessagesService) {
    super();
  }

  public async execute(command: MarkConversationReadCommand): Promise<void> {
    const { messages, clock } = this.messagesService.dependencies;
    const conversation = await this.messagesService.requireConversationForParticipant(command.conversationId, command.principal.userId);
    await messages.markConversationRead(conversation.id, command.principal.userId, clock.now());
  }
}

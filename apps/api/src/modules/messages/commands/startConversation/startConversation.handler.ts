import { CommandHandler } from "@zudojs/cqrs";

import { forbidden, notFound, unprocessable } from "../../../../errors/domain.error.js";
import type { ConversationSummaryDto } from "../../dtos/messages.dto.js";
import { createDirectConversationPairKey } from "../../models/messages.model.js";
import type { MessagesService } from "../../services/messages.service.js";
import type { StartConversationCommand } from "./startConversation.command.js";

export class StartConversationHandler extends CommandHandler<StartConversationCommand, ConversationSummaryDto> {
  public readonly commandType = "messages.startConversation" as const;

  public constructor(private readonly messagesService: MessagesService) {
    super();
  }

  public async execute(command: StartConversationCommand): Promise<ConversationSummaryDto> {
    const { messages, userDirectory, socialGraph, clock } = this.messagesService.dependencies;
    const userId = command.principal.userId;
    if (command.otherUserId === userId) throw unprocessable("You cannot start a conversation with yourself.");
    const [otherUser] = await userDirectory.findUserSummaries([command.otherUserId]);
    if (otherUser === undefined) throw notFound("User");
    if (await socialGraph.isBlockedEitherWay(userId, otherUser.id)) throw forbidden("You cannot message this user.");
    const conversation = await messages.findOrCreateDirectConversation(
      createDirectConversationPairKey(userId, otherUser.id),
      [userId, otherUser.id],
      clock.now(),
    );
    const [summary] = await this.messagesService.buildConversationSummaries([conversation], userId);
    if (summary === undefined) throw notFound("Conversation");
    return summary;
  }
}

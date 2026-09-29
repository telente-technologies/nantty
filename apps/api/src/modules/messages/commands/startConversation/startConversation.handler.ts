import { CommandHandler } from "@zudojs/cqrs";

import { forbidden, notFound, unprocessable } from "../../../../errors/domain.error.js";
import type { ConversationDto } from "../../dtos/messages.dto.js";
import { createDirectConversationPairKey } from "../../models/messages.model.js";
import type { MessagesService } from "../../services/messages.service.js";
import type { StartConversationCommand } from "./startConversation.command.js";

export class StartConversationHandler extends CommandHandler<StartConversationCommand, ConversationDto> {
  public readonly commandType = "messages.startConversation" as const;

  public constructor(private readonly messagesService: MessagesService) {
    super();
  }

  public async execute(command: StartConversationCommand): Promise<ConversationDto> {
    const { conversations, userDirectory, socialGraph, clock } = this.messagesService.dependencies;
    const userId = command.principal.userId;
    if (command.otherUserId === userId) throw unprocessable("You cannot start a conversation with yourself.");
    const [otherUser] = await userDirectory.findUserSummaries([command.otherUserId]);
    if (otherUser === undefined) throw notFound("User");
    if (await socialGraph.isBlockedEitherWay(userId, otherUser.id)) throw forbidden("You cannot message this user.");
    const conversation = await conversations.findOrCreateByPairKey(
      {
        kind: "direct",
        pairKey: createDirectConversationPairKey(userId, otherUser.id),
        title: null,
        description: "",
        photoMediaId: null,
        ownerId: null,
        storeId: null,
        disappearingMessagesSeconds: null,
      },
      [{ userId, role: "member" }, { userId: otherUser.id, role: "member" }],
      clock.now(),
    );
    const [summary] = await this.messagesService.conversationPresenter.presentConversations([conversation], userId);
    if (summary === undefined) throw notFound("Conversation");
    return summary;
  }
}

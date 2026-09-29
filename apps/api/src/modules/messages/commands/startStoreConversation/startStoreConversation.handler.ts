import { CommandHandler } from "@zudojs/cqrs";

import { notFound, unprocessable } from "../../../../errors/domain.error.js";
import type { ConversationDto } from "../../dtos/messages.dto.js";
import { createBusinessConversationPairKey } from "../../models/messages.model.js";
import type { MessagesService } from "../../services/messages.service.js";
import type { StartStoreConversationCommand } from "./startStoreConversation.command.js";

export class StartStoreConversationHandler extends CommandHandler<StartStoreConversationCommand, ConversationDto> {
  public readonly commandType = "messages.startStoreConversation" as const;

  public constructor(private readonly messagesService: MessagesService) {
    super();
  }

  public async execute(command: StartStoreConversationCommand): Promise<ConversationDto> {
    const { conversations, storeAccess, clock } = this.messagesService.dependencies;
    const customerId = command.principal.userId;
    const [store] = await storeAccess.findStoreSummaries([command.storeId]);
    if (store === undefined || store.status !== "active") throw notFound("Store");
    const isStoreMember = await storeAccess.assertStoreMember(customerId, store.id).then(() => true, () => false);
    if (isStoreMember) throw unprocessable("You cannot start a customer chat with your own store.");
    const conversation = await conversations.findOrCreateByPairKey(
      {
        kind: "business",
        pairKey: createBusinessConversationPairKey(store.id, customerId),
        title: store.name,
        description: "",
        photoMediaId: null,
        ownerId: store.ownerId,
        storeId: store.id,
        disappearingMessagesSeconds: null,
      },
      [{ userId: customerId, role: "customer" }],
      clock.now(),
    );
    const [summary] = await this.messagesService.conversationPresenter.presentConversations([conversation], customerId);
    if (summary === undefined) throw notFound("Conversation");
    return summary;
  }
}

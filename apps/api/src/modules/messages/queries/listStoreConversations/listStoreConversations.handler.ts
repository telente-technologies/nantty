import { QueryHandler } from "@zudojs/cqrs";

import { resolveSellerStoreIdForUser } from "../../../../utils/sellerStore.util.js";
import type { ConversationDto } from "../../dtos/messages.dto.js";
import type { MessagesService } from "../../services/messages.service.js";
import type { ListStoreConversationsQuery } from "./listStoreConversations.query.js";

const STORE_INBOX_LIMIT = 200;

export class ListStoreConversationsHandler extends QueryHandler<ListStoreConversationsQuery, readonly ConversationDto[]> {
  public readonly queryType = "messages.listStoreConversations" as const;

  public constructor(private readonly messagesService: MessagesService) {
    super();
  }

  public async execute(query: ListStoreConversationsQuery): Promise<readonly ConversationDto[]> {
    const { storeAccess, conversations } = this.messagesService.dependencies;
    const userId = query.principal.userId;
    const storeId = await resolveSellerStoreIdForUser(storeAccess, userId, query.storeId);
    const inbox = await conversations.listConversationsForStore(storeId, STORE_INBOX_LIMIT);
    return this.messagesService.conversationPresenter.presentConversations(inbox, userId);
  }
}

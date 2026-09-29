import { QueryHandler } from "@zudojs/cqrs";

import type { Page } from "../../../../types/pagination.type.js";
import type { MessageRecord } from "../../models/messages.model.js";
import type { MessagesService } from "../../services/messages.service.js";
import type { ListMessagesQuery } from "./listMessages.query.js";

export class ListMessagesHandler extends QueryHandler<ListMessagesQuery, Page<MessageRecord>> {
  public readonly queryType = "messages.listMessages" as const;

  public constructor(private readonly messagesService: MessagesService) {
    super();
  }

  public async execute(query: ListMessagesQuery): Promise<Page<MessageRecord>> {
    const conversation = await this.messagesService.requireConversationForParticipant(query.conversationId, query.principal.userId);
    return this.messagesService.dependencies.messages.listMessages(conversation.id, query.page);
  }
}

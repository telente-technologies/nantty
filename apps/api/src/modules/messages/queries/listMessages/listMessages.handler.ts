import { QueryHandler } from "@zudojs/cqrs";

import { unprocessable } from "../../../../errors/domain.error.js";
import type { Page } from "../../../../types/pagination.type.js";
import type { MessageDto } from "../../dtos/messages.dto.js";
import type { MessageSyncPosition } from "../../models/messages.model.js";
import type { MessagesService } from "../../services/messages.service.js";
import type { ListMessagesQuery } from "./listMessages.query.js";

function parseSyncCursor(after: string): MessageSyncPosition {
  const [createdAtText = "", messageId = ""] = after.split("|");
  const createdAt = new Date(createdAtText);
  if (Number.isNaN(createdAt.getTime())) throw unprocessable("after must look like <createdAt>|<messageId>.");
  return { createdAt, messageId };
}

export class ListMessagesHandler extends QueryHandler<ListMessagesQuery, Page<MessageDto>> {
  public readonly queryType = "messages.listMessages" as const;

  public constructor(private readonly messagesService: MessagesService) {
    super();
  }

  public async execute(query: ListMessagesQuery): Promise<Page<MessageDto>> {
    const { messages, clock } = this.messagesService.dependencies;
    const viewerId = query.principal.userId;
    const { conversation } = await this.messagesService.requireConversationAccess(query.conversationId, viewerId);
    const now = clock.now();
    if (query.after !== undefined) {
      const newer = await messages.listVisibleMessagesAfter(conversation.id, now, parseSyncCursor(query.after), query.page.limit);
      return { data: await this.messagesService.messagePresenter.presentMessages(newer, viewerId), nextCursor: null };
    }
    const page = await messages.listVisibleMessages(conversation.id, now, query.page);
    return { data: await this.messagesService.messagePresenter.presentMessages(page.data, viewerId), nextCursor: page.nextCursor };
  }
}

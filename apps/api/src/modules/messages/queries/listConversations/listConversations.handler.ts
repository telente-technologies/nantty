import { QueryHandler } from "@zudojs/cqrs";

import type { ConversationSummaryDto } from "../../dtos/messages.dto.js";
import type { MessagesService } from "../../services/messages.service.js";
import type { ListConversationsQuery } from "./listConversations.query.js";

export class ListConversationsHandler extends QueryHandler<ListConversationsQuery, readonly ConversationSummaryDto[]> {
  public readonly queryType = "messages.listConversations" as const;

  public constructor(private readonly messagesService: MessagesService) {
    super();
  }

  public async execute(query: ListConversationsQuery): Promise<readonly ConversationSummaryDto[]> {
    const conversations = await this.messagesService.dependencies.messages.listConversationsForUser(query.principal.userId);
    const summaries = await this.messagesService.buildConversationSummaries(conversations, query.principal.userId);
    const needle = query.searchTerm?.trim().toLowerCase() ?? "";
    return summaries
      .filter((summary) => query.filter === "all" || summary.friendship.following)
      .filter((summary) =>
        needle === ""
          || (summary.otherParticipant?.username.toLowerCase().includes(needle) ?? false)
          || (summary.otherParticipant?.name.toLowerCase().includes(needle) ?? false));
  }
}

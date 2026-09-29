import { QueryHandler } from "@zudojs/cqrs";

import { convertMessageToDto, type MessageSearchResultDto } from "../../dtos/messages.dto.js";
import type { MessagesService } from "../../services/messages.service.js";
import type { SearchMessagesQuery } from "./searchMessages.query.js";

const SEARCH_RESULT_LIMIT = 20;

export class SearchMessagesHandler extends QueryHandler<SearchMessagesQuery, MessageSearchResultDto> {
  public readonly queryType = "messages.searchMessages" as const;

  public constructor(private readonly messagesService: MessagesService) {
    super();
  }

  public async execute(query: SearchMessagesQuery): Promise<MessageSearchResultDto> {
    const { messages, userDirectory } = this.messagesService.dependencies;
    const userId = query.principal.userId;
    const conversationIds = (await messages.listConversationsForUser(userId)).map((conversation) => conversation.id);
    const [matchingMessages, people] = await Promise.all([
      messages.searchMessagesInConversations(conversationIds, query.searchTerm, SEARCH_RESULT_LIMIT),
      userDirectory.searchUsers(query.searchTerm, SEARCH_RESULT_LIMIT),
    ]);
    return { messages: matchingMessages.map(convertMessageToDto), people: people.filter((person) => person.id !== userId) };
  }
}

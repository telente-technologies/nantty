import { QueryHandler } from "@zudojs/cqrs";

import type { MessageSearchResultDto } from "../../dtos/messages.dto.js";
import type { MessagesService } from "../../services/messages.service.js";
import type { SearchMessagesQuery } from "./searchMessages.query.js";

const SEARCH_RESULT_LIMIT = 20;
const CONVERSATION_SCAN_LIMIT = 200;

export class SearchMessagesHandler extends QueryHandler<SearchMessagesQuery, MessageSearchResultDto> {
  public readonly queryType = "messages.searchMessages" as const;

  public constructor(private readonly messagesService: MessagesService) {
    super();
  }

  public async execute(query: SearchMessagesQuery): Promise<MessageSearchResultDto> {
    const { conversations, messages, userDirectory, clock } = this.messagesService.dependencies;
    const userId = query.principal.userId;
    const joined = await conversations.listConversationsForUser(userId, CONVERSATION_SCAN_LIMIT);
    const [found, people] = await Promise.all([
      messages.searchVisibleMessages(joined.map((conversation) => conversation.id), query.searchTerm, clock.now(), SEARCH_RESULT_LIMIT),
      userDirectory.searchUsers(query.searchTerm, SEARCH_RESULT_LIMIT),
    ]);
    const matchedConversations = joined.filter((conversation) => found.some((message) => message.conversationId === conversation.id));
    const summaries = await this.messagesService.conversationPresenter.presentConversations(matchedConversations, userId);
    return {
      conversations: summaries.map((summary) => ({
        id: summary.id,
        peer: summary.peer,
        snippet: found.find((message) => message.conversationId === summary.id)?.text ?? summary.lastMessage,
      })),
      messages: await this.messagesService.messagePresenter.presentMessages(found, userId),
      people: people.filter((person) => person.id !== userId),
    };
  }
}

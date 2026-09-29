import { QueryHandler } from "@zudojs/cqrs";

import type { ConversationDto } from "../../dtos/messages.dto.js";
import type { ConversationKind } from "../../models/messages.model.js";
import type { MessagesService } from "../../services/messages.service.js";
import type { ConversationListFilter } from "../../validators/messages.validator.js";
import type { ListConversationsQuery } from "./listConversations.query.js";

const CONVERSATION_LIST_LIMIT = 200;
const KIND_BY_FILTER: Readonly<Record<Exclude<ConversationListFilter, "all" | "direct">, ConversationKind>> = {
  groups: "group",
  channels: "channel",
  business: "business",
};

export class ListConversationsHandler extends QueryHandler<ListConversationsQuery, readonly ConversationDto[]> {
  public readonly queryType = "messages.listConversations" as const;

  public constructor(private readonly messagesService: MessagesService) {
    super();
  }

  public async execute(query: ListConversationsQuery): Promise<readonly ConversationDto[]> {
    const userId = query.principal.userId;
    const conversations = await this.messagesService.dependencies.conversations.listConversationsForUser(userId, CONVERSATION_LIST_LIMIT);
    const wantedKind = query.filter === "all" || query.filter === "direct" ? undefined : KIND_BY_FILTER[query.filter];
    const matchingKind = wantedKind === undefined ? conversations : conversations.filter((conversation) => conversation.kind === wantedKind);
    const summaries = await this.messagesService.conversationPresenter.presentConversations(matchingKind, userId);
    const term = query.searchTerm?.trim().toLowerCase() ?? "";
    return summaries.filter((summary) => {
      if (query.filter === "direct" && (summary.kind !== "direct" || !summary.friendship.following)) return false;
      if (term === "") return true;
      const label = `${summary.title ?? ""} ${summary.peer?.name ?? ""} ${summary.peer?.username ?? ""}`.toLowerCase();
      return label.includes(term);
    });
  }
}

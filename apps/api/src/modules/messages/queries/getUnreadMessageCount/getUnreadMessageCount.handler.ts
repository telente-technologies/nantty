import { QueryHandler } from "@zudojs/cqrs";

import type { MessagesService } from "../../services/messages.service.js";
import type { GetUnreadMessageCountQuery } from "./getUnreadMessageCount.query.js";

export interface UnreadMessageCounts {
  readonly total: number;
  readonly conversationsWithUnread: number;
}

export class GetUnreadMessageCountHandler extends QueryHandler<GetUnreadMessageCountQuery, UnreadMessageCounts> {
  public readonly queryType = "messages.getUnreadMessageCount" as const;

  public constructor(private readonly messagesService: MessagesService) {
    super();
  }

  public async execute(query: GetUnreadMessageCountQuery): Promise<UnreadMessageCounts> {
    const { messages } = this.messagesService.dependencies;
    const userId = query.principal.userId;
    const conversations = await messages.listConversationsForUser(userId);
    const counts = await Promise.all(
      conversations.map(async (conversation) => {
        const participant = await messages.findParticipant(conversation.id, userId);
        return messages.countUnreadMessages(conversation.id, userId, participant?.lastReadAt ?? conversation.createdAt);
      }),
    );
    return { total: counts.reduce((sum, count) => sum + count, 0), conversationsWithUnread: counts.filter((count) => count > 0).length };
  }
}

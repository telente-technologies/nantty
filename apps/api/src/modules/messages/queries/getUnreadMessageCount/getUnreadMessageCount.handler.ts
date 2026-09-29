import { QueryHandler } from "@zudojs/cqrs";

import type { MessagesService } from "../../services/messages.service.js";
import type { GetUnreadMessageCountQuery } from "./getUnreadMessageCount.query.js";

export interface UnreadMessageCounts {
  readonly total: number;
  readonly conversationsWithUnread: number;
}

const CONVERSATION_SCAN_LIMIT = 200;

export class GetUnreadMessageCountHandler extends QueryHandler<GetUnreadMessageCountQuery, UnreadMessageCounts> {
  public readonly queryType = "messages.getUnreadMessageCount" as const;

  public constructor(private readonly messagesService: MessagesService) {
    super();
  }

  public async execute(query: GetUnreadMessageCountQuery): Promise<UnreadMessageCounts> {
    const { conversations, messages, clock } = this.messagesService.dependencies;
    const userId = query.principal.userId;
    const now = clock.now();
    const joined = await conversations.listConversationsForUser(userId, CONVERSATION_SCAN_LIMIT);
    const counts = await Promise.all(
      joined.map(async (conversation) => {
        const participant = await conversations.findParticipant(conversation.id, userId);
        return messages.countUnreadMessages(conversation.id, userId, participant?.lastReadAt ?? conversation.createdAt, now);
      }),
    );
    return { total: counts.reduce((sum, count) => sum + count, 0), conversationsWithUnread: counts.filter((count) => count > 0).length };
  }
}

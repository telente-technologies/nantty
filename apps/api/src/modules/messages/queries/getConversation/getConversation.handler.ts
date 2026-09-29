import { QueryHandler } from "@zudojs/cqrs";

import { notFound } from "../../../../errors/domain.error.js";
import type { ConversationSummaryDto } from "../../dtos/messages.dto.js";
import type { MessagesService } from "../../services/messages.service.js";
import type { GetConversationQuery } from "./getConversation.query.js";

export class GetConversationHandler extends QueryHandler<GetConversationQuery, ConversationSummaryDto> {
  public readonly queryType = "messages.getConversation" as const;

  public constructor(private readonly messagesService: MessagesService) {
    super();
  }

  public async execute(query: GetConversationQuery): Promise<ConversationSummaryDto> {
    const conversation = await this.messagesService.requireConversationForParticipant(query.conversationId, query.principal.userId);
    const [summary] = await this.messagesService.buildConversationSummaries([conversation], query.principal.userId);
    if (summary === undefined) throw notFound("Conversation");
    return summary;
  }
}

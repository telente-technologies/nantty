import { QueryHandler } from "@zudojs/cqrs";

import type { DisputeConversationService } from "../../services/disputeConversation.service.js";
import type { DisputeMessageRecord } from "../../models/escrows.model.js";
import type { ListDisputeMessagesQuery } from "./listDisputeMessages.query.js";

export class ListDisputeMessagesHandler extends QueryHandler<ListDisputeMessagesQuery, readonly DisputeMessageRecord[]> {
  public readonly queryType = "escrows.listDisputeMessages" as const;

  public constructor(private readonly service: DisputeConversationService) {
    super();
  }

  public execute(query: ListDisputeMessagesQuery): Promise<readonly DisputeMessageRecord[]> {
    return this.service.listDisputeMessages(query.principal, query.disputeId);
  }
}

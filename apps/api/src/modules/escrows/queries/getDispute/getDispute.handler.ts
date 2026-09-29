import { QueryHandler } from "@zudojs/cqrs";

import type { DisputeConversationService } from "../../services/disputeConversation.service.js";
import type { DisputeForViewer } from "../../services/disputeConversation.service.js";
import type { GetDisputeQuery } from "./getDispute.query.js";

export class GetDisputeHandler extends QueryHandler<GetDisputeQuery, DisputeForViewer> {
  public readonly queryType = "escrows.getDispute" as const;

  public constructor(private readonly service: DisputeConversationService) {
    super();
  }

  public execute(query: GetDisputeQuery): Promise<DisputeForViewer> {
    return this.service.findDisputeForViewer(query.principal, query.disputeId);
  }
}

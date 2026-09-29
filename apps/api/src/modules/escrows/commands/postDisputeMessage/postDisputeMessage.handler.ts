import { CommandHandler } from "@zudojs/cqrs";

import type { DisputeConversationService } from "../../services/disputeConversation.service.js";
import type { DisputeMessageRecord } from "../../models/escrows.model.js";
import type { PostDisputeMessageCommand } from "./postDisputeMessage.command.js";

export class PostDisputeMessageHandler extends CommandHandler<PostDisputeMessageCommand, DisputeMessageRecord> {
  public readonly commandType = "escrows.postDisputeMessage" as const;

  public constructor(private readonly service: DisputeConversationService) {
    super();
  }

  public execute(command: PostDisputeMessageCommand): Promise<DisputeMessageRecord> {
    return this.service.postDisputeMessage(command.principal, command.disputeId, command.text, command.attachmentMediaIds);
  }
}

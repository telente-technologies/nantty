import { CommandHandler } from "@zudojs/cqrs";

import type { DisputeRecord } from "../../models/escrows.model.js";
import type { DisputesService } from "../../services/disputes.service.js";
import type { ResolveDisputeCommand } from "./resolveDispute.command.js";

export class ResolveDisputeHandler extends CommandHandler<ResolveDisputeCommand, DisputeRecord> {
  public readonly commandType = "escrows.resolveDispute" as const;

  public constructor(private readonly service: DisputesService) {
    super();
  }

  public execute(command: ResolveDisputeCommand): Promise<DisputeRecord> {
    return this.service.resolveDispute(command.principal.userId, command.disputeId, command.outcome, command.note);
  }
}

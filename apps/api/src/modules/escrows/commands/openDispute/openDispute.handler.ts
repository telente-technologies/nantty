import { CommandHandler } from "@zudojs/cqrs";

import type { DisputeRecord } from "../../models/escrows.model.js";
import type { DisputesService } from "../../services/disputes.service.js";
import type { OpenDisputeCommand } from "./openDispute.command.js";

export class OpenDisputeHandler extends CommandHandler<OpenDisputeCommand, DisputeRecord> {
  public readonly commandType = "escrows.openDispute" as const;

  public constructor(private readonly service: DisputesService) {
    super();
  }

  public execute(command: OpenDisputeCommand): Promise<DisputeRecord> {
    return this.service.openDisputeForOrder(command.principal.userId, command.orderId, command.reason, command.details);
  }
}

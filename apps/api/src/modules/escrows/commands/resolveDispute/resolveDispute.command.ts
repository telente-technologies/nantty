import { Command } from "@zudojs/cqrs";

import type { DisputeOutcome } from "../../services/disputes.service.js";
import type { Principal } from "../../../../interfaces/principal.interface.js";

export class ResolveDisputeCommand extends Command<"escrows.resolveDispute"> {
  public constructor(
    public readonly principal: Principal,
    public readonly disputeId: string,
    public readonly outcome: DisputeOutcome,
    public readonly note: string,
  ) {
    super("escrows.resolveDispute");
  }
}
